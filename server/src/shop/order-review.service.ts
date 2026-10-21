import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { asc, inArray, and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../common/database/database.module';
import * as schema from '../db/schema';
import { CouponService } from '../coupon/coupon.service';
import { allocateCoupon } from './coupon-pricing';
import type { ReviewOrderDto } from './order-review.controller';

@Injectable()
export class OrderReviewService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly coupons: CouponService,
  ) {}

  // Read-only preview: never reserve/redeem a coupon or register a provider order here.
  async preview(dto: ReviewOrderDto, userId?: string) {
    if (!userId && dto.userCouponId)
      throw new UnauthorizedException('쿠폰을 적용하려면 로그인해 주세요.');
    const ids = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.db.query.products.findMany({
      where: inArray(schema.products.id, ids),
      with: {
        images: { orderBy: [asc(schema.productImages.sortOrder)] },
        options: true,
      },
    });
    const seen = new Set<string>(),
      counts = new Map<string, number>();
    const items = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const quantity = (counts.get(item.productId) ?? 0) + item.quantity;
      const key = `${item.productId}:${item.optionId ?? ''}`;
      if (seen.has(key))
        throw new BadRequestException(
          '같은 상품 옵션을 중복 요청할 수 없습니다.',
        );
      seen.add(key);
      counts.set(item.productId, quantity);
      if (
        !product?.isActive ||
        product.price < 1 ||
        quantity > 999 ||
        quantity > product.stockQuantity
      )
        throw new BadRequestException(
          '구매할 수 없거나 재고가 부족한 상품이 있습니다.',
        );
      const option = product.options.find((o) => o.id === item.optionId);
      if (
        (product.options.length > 0 && !option) ||
        (!product.options.length && item.optionId)
      )
        throw new BadRequestException('상품 옵션을 다시 선택해 주세요.');
      return {
        productId: product.id,
        optionId: option?.id ?? null,
        name: product.name,
        slug: product.slug,
        imageUrl: product.images[0]?.url ?? null,
        optionLabel: option ? `${option.name}: ${option.value}` : null,
        quantity: item.quantity,
        unitPrice: product.price,
        amount: product.price * item.quantity,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const owned = userId ? await this.coupons.getMyCoupons(userId) : [];
    const holds = userId
      ? await this.db
          .select({ id: schema.naverCouponCheckouts.userCouponId })
          .from(schema.naverCouponCheckouts)
          .where(
            and(
              eq(schema.naverCouponCheckouts.userId, userId),
              eq(schema.naverCouponCheckouts.mode, 'production'),
              isNull(schema.naverCouponCheckouts.releasedAt),
            ),
          )
      : [];
    const allocations = new Map<
      string,
      ReturnType<typeof allocateCoupon<(typeof items)[number]>>
    >();
    const coupons = await Promise.all(
      owned.map(async (row) => {
        const base = {
          userCouponId: row.id,
          code: row.coupon.code,
          validUntil: row.coupon.validUntil,
        };
        try {
          if (holds.some((h) => h.id === row.id))
            throw new BadRequestException(
              '네이버페이 주문에서 사용 대기 중입니다.',
            );
          const result = await this.coupons.validateCode(
            userId!,
            row.coupon.code,
            subtotal,
          );
          const allocation = allocateCoupon(items, result.discountAmount);
          allocations.set(row.id, allocation);
          return {
            ...base,
            discountAmount: allocation.discountAmount,
            reason: null as string | null,
          };
        } catch (error) {
          if (!(error instanceof BadRequestException)) throw error;
          return { ...base, discountAmount: 0, reason: error.message };
        }
      }),
    );
    let selected =
      dto.useCoupon === false
        ? undefined
        : dto.userCouponId
          ? coupons.find((c) => c.userCouponId === dto.userCouponId)
          : coupons
              .filter((c) => !c.reason && c.discountAmount > 0)
              .sort(
                (a, b) =>
                  b.discountAmount - a.discountAmount ||
                  a.validUntil.localeCompare(b.validUntil),
              )[0];
    if (
      dto.useCoupon !== false &&
      dto.userCouponId &&
      (!selected || selected.reason)
    )
      throw new BadRequestException(
        selected?.reason ?? '보유한 쿠폰을 다시 선택해 주세요.',
      );
    if (dto.useCoupon === false) selected = undefined;
    const allocation = selected
      ? allocations.get(selected.userCouponId)!
      : allocateCoupon(items, 0);
    const discountAmount = allocation.discountAmount;
    const discountedSubtotal = subtotal - discountAmount;
    // Preview follows the existing site checkout's post-discount free-shipping threshold.
    const shippingFee = discountedSubtotal >= 100000 ? 0 : 4000;
    return {
      items: allocation.items,
      coupons,
      selectedUserCouponId: selected?.userCouponId ?? null,
      subtotal,
      discountAmount,
      discountedSubtotal,
      shippingFee,
      total: discountedSubtotal + shippingFee,
      isMember: !!userId,
      paymentEnabled: false,
      previewOnly: true,
      roundingPolicy:
        '상품별 개당 정수 금액으로 할인하며, 나눌 수 없는 원 단위 차액은 할인액에서 제외됩니다.',
    };
  }
}
