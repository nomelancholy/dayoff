import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { inArray, asc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../common/database/database.module';
import * as schema from '../db/schema';
import { NaverOrderClient } from './naver-order.client';
import { RegisterNaverOrderDto } from './dto/naver-order.dto';
import { documentXml, shippingXml, tag } from './naver-order.xml';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// UUID를 22자 base64url로 표현하여 주문형 상품 ID 제한 안에 넣습니다.
export const payProductId = (id: string) =>
  Buffer.from(id.replace(/-/g, ''), 'hex').toString('base64url');
export function databaseProductId(id: string) {
  if (!/^[A-Za-z0-9_-]{22}$/.test(id))
    throw new BadRequestException('상품 번호가 올바르지 않습니다.');
  const hex = Buffer.from(id, 'base64url').toString('hex');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  if (!UUID.test(uuid) || payProductId(uuid) !== id)
    throw new BadRequestException('상품 번호가 올바르지 않습니다.');
  return uuid;
}

@Injectable()
export class NaverOrderService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly client: NaverOrderClient,
  ) {}

  private load(ids: string[]) {
    return this.db.query.products.findMany({
      where: inArray(schema.products.id, ids),
      with: {
        images: { orderBy: [asc(schema.productImages.sortOrder)] },
        options: { orderBy: [asc(schema.productOptions.sortOrder)] },
      },
    });
  }

  private base(
    product: Awaited<ReturnType<NaverOrderService['load']>>[number],
  ) {
    const origin = new URL(this.client.value('FRONTEND_URL')).origin;
    const image = product.images[0]?.url;
    if (!image || product.price < 1)
      throw new BadRequestException('상품 이미지와 판매 가격을 확인해 주세요.');
    const imageUrl = new URL(image, origin);
    if (!['https:', 'http:'].includes(imageUrl.protocol))
      throw new BadRequestException('상품 이미지 주소가 올바르지 않습니다.');
    return (
      tag('id', payProductId(product.id)) +
      tag('merchantProductId', product.id) +
      tag('name', Array.from(product.name).slice(0, 100).join('')) +
      tag('basePrice', product.price) +
      tag('taxType', 'TAX') +
      tag('infoUrl', `${origin}/shop/${encodeURIComponent(product.slug)}`) +
      tag('imageUrl', imageUrl.href)
    );
  }

  // 현재 카탈로그는 하나의 선택 목록 + 상품 전체 공유 재고입니다.
  // manageCode를 발급하면 네이버가 본상품 재고를 무시하므로 사용하지 않습니다.
  private optionName() {
    return '옵션';
  }
  private optionText(option: { name: string; value: string }) {
    const text = `${option.name}: ${option.value}`;
    if (Array.from(text).length > 50)
      throw new BadRequestException(
        '상품 옵션 표시명을 50자 이내로 설정해 주세요.',
      );
    return text;
  }

  async register(dto: RegisterNaverOrderDto) {
    this.client.assertEnabled();
    const ids = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.load(ids);
    // 이전 버전 화면도 안전한 사이트 내 주소로 복귀하도록 기본값을 제공합니다.
    const source = dto.source ?? (ids.length === 1 ? 'product' : 'cart');
    if (source === 'product' && ids.length !== 1)
      throw new BadRequestException(
        '상품 상세에서는 한 상품만 주문할 수 있습니다.',
      );
    const productXml: string[] = [];
    for (const id of ids) {
      const product = products.find((p) => p.id === id);
      const lines = dto.items.filter((i) => i.productId === id);
      const quantity = lines.reduce((n, i) => n + i.quantity, 0);
      if (
        !product?.isActive ||
        product.price < 1 ||
        product.stockQuantity < quantity ||
        quantity > 999
      ) {
        throw new BadRequestException(
          '구매할 수 없거나 재고가 부족한 상품이 있습니다.',
        );
      }
      const optionIds = new Set(lines.map((i) => i.optionId ?? ''));
      if (optionIds.size !== lines.length)
        throw new BadRequestException(
          '같은 상품 옵션을 중복 요청할 수 없습니다.',
        );
      let selection = '';
      for (const line of lines) {
        if (product.options.length) {
          const option = product.options.find((o) => o.id === line.optionId);
          if (!option)
            throw new BadRequestException('상품 옵션을 다시 선택해 주세요.');
          selection += `<option>${tag('quantity', line.quantity)}<selectedItem><type>SELECT</type>${tag('name', this.optionName())}<value>${tag('id', option.id)}${tag('text', this.optionText(option))}</value></selectedItem></option>`;
        } else {
          if (line.optionId)
            throw new BadRequestException('상품 옵션이 올바르지 않습니다.');
          selection += `<single>${tag('quantity', line.quantity)}</single>`;
        }
      }
      productXml.push(
        `<product>${this.base(product)}${selection}${shippingXml()}</product>`,
      );
    }
    const origin = new URL(this.client.value('FRONTEND_URL')).origin;
    const backUrl =
      source === 'cart'
        ? `${origin}/cart`
        : `${origin}/shop/${encodeURIComponent(products.find((p) => p.id === ids[0])!.slug)}`;
    const body = documentXml(
      `<order>${tag('merchantId', this.client.value('NAVER_ORDER_MERCHANT_ID'))}${tag('certiKey', this.client.value('NAVER_ORDER_CERTI_KEY'))}${productXml.join('')}${tag('backUrl', backUrl)}<interface>${tag('naverInflowCode', dto.naverInflowCode ?? '')}${tag('cpaInflowCode', dto.cpaInflowCode ?? '')}${tag('saClickId', dto.saClickId ?? '')}</interface></order>`,
    );
    // 주문서 등록은 결제가 아닙니다. 자체 주문 paid 처리/재고 차감/장바구니 삭제 금지.
    return this.client.register(body);
  }

  async productInfo(requests: Array<{ id: string }>, optionSearch: boolean) {
    const ids = requests.map((r) => databaseProductId(r.id));
    const products = await this.load(ids);
    return documentXml(
      `<products>${requests
        .map((r, index) => {
          const product = products.find((p) => p.id === ids[index]);
          if (!product)
            return `<product>${tag('id', r.id)}<status>NOT_SALE</status></product>`;
          const status =
            !this.client.getStatus().enabled ||
            !product.isActive ||
            product.price < 1 ||
            !product.images.length
              ? 'NOT_SALE'
              : product.stockQuantity > 0
                ? 'ON_SALE'
                : 'SOLD_OUT';
          if (status === 'NOT_SALE')
            return `<product>${tag('id', r.id)}<status>NOT_SALE</status></product>`;
          const options =
            optionSearch && product.options.length
              ? `<option><optionItem><type>SELECT</type>${tag('name', this.optionName())}${product.options.map((o) => `<value>${tag('id', o.id)}${tag('text', this.optionText(o))}<status>true</status></value>`).join('')}</optionItem></option>`
              : '';
          return `<product>${this.base(product)}${tag('status', status)}${tag('stockQuantity', Math.max(0, product.stockQuantity))}<supplementSupport>false</supplementSupport>${tag('optionSupport', !!product.options.length)}${options}${shippingXml()}</product>`;
        })
        .join('')}</products>`,
    );
  }
}
