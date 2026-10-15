import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  eq,
  and,
  asc,
  desc,
  isNull,
  sql,
  inArray,
  or,
  ne,
  gt,
  gte,
  lte,
  lt,
} from 'drizzle-orm';
import { DRIZZLE } from '../common/database/database.module';
import { CouponService } from '../coupon/coupon.service';
import * as schema from '../db/schema';
import { isOutOfDeliveryPostalCode } from './out-of-delivery-areas';
import { EmailService } from '../common/email/email.service';
import { NaverPayClient, NaverPayRejectedException } from './naver-pay.client';
import { SpacesStorageService } from './spaces-storage.service';
import { MediaCleanupService } from './media-cleanup.service';
import { CART_MAX_QUANTITY } from './dto/cart.dto';
import { REVIEW_MAX_IMAGES } from './dto/review.dto';

const PRODUCT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// 상품 페이지 주소는 /shop/<slug> 입니다. 아래 단어는 같은 위치의 API·관리자 경로
// (/shop/cart, /shop/admin/... 등)와 겹쳐 운영 Nginx가 페이지 대신 API로 보내므로 쓸 수 없습니다.
const RESERVED_PRODUCT_SLUGS = new Set([
  'admin',
  'categories',
  'products',
  'upload',
  'my-reviews',
  'orders',
  'cart',
  'checkout',
  'naver-order',
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAVER_PAY_PRODUCT_NAME_MAX_LENGTH = 128;
// Postgres integer 컬럼 범위를 넘는 값이 500 오류로 이어지지 않도록 하는 상한
const MAX_INT_VALUE = 2_000_000_000;
const MAX_PRODUCT_IMAGES = 50;
const MAX_PRODUCT_OPTIONS = 50;
const MAX_URL_LENGTH = 2048;
// 결제창이 열려 있을 수 있는 최근 주문 초안은 관리자 일괄 삭제에서 보호합니다.
const PENDING_ORDER_PROTECTION_MS = 60 * 60 * 1000;
// 메일 서비스의 초당 발송 제한에 걸리지 않도록 재입고 알림 사이에 두는 간격
const RESTOCK_MAIL_INTERVAL_MS = 600;

type Tx = Parameters<
  Parameters<NodePgDatabase<typeof schema>['transaction']>[0]
>[0];

type ProductImageInput = { url: string; alt: string | null; sortOrder: number };
type ProductOptionInput = {
  id?: string;
  name: string;
  value: string;
  sortOrder: number;
};
type RestockMailTarget = {
  email: string;
  name: string | null;
  productName: string;
  productSlug: string;
};

function naverPayProductName(value: string) {
  return Array.from(value).slice(0, NAVER_PAY_PRODUCT_NAME_MAX_LENGTH).join('');
}

function discountedPrice(originalPrice: number, discountRate: number) {
  return Math.floor((originalPrice * (100 - discountRate)) / 100);
}

/** 0 이상의 정수로 해석할 수 있는 값만 받아들입니다. (null·빈 문자열·음수·범위 초과는 거부) */
function parseNonNegativeInt(value: unknown, message: string): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_INT_VALUE) {
    throw new BadRequestException(message);
  }
  return Math.floor(parsed);
}

function assertProductPayload(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('상품 정보가 올바르지 않습니다.');
  }
  return body as Record<string, unknown>;
}

function assertProductSlugNotReserved(slug: string) {
  if (RESERVED_PRODUCT_SLUGS.has(slug)) {
    throw new BadRequestException(
      `"${slug}"는 쇼핑몰 주소로 이미 사용 중인 단어라 slug로 쓸 수 없습니다.`,
    );
  }
}

function parseDiscountRate(value: unknown): number {
  const message = '할인율은 0~100 사이여야 합니다.';
  const rate = parseNonNegativeInt(value, message);
  if (rate > 100) throw new BadRequestException(message);
  return rate;
}

function parseSortOrder(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  if (!Number.isFinite(parsed) || Math.abs(parsed) > MAX_INT_VALUE) {
    return fallback;
  }
  return Math.floor(parsed);
}

/** 설명·안내문처럼 비워둘 수 있는 텍스트 필드 */
function parseOptionalText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  throw new BadRequestException('텍스트 항목의 형식이 올바르지 않습니다.');
}

function parseImageList(raw: unknown, label: string): ProductImageInput[] {
  if (!Array.isArray(raw)) {
    throw new BadRequestException(`${label} 형식이 올바르지 않습니다.`);
  }
  if (raw.length > MAX_PRODUCT_IMAGES) {
    throw new BadRequestException(
      `${label}는 최대 ${MAX_PRODUCT_IMAGES}장까지 등록할 수 있습니다.`,
    );
  }
  return raw.map((item: unknown, index) => {
    const image = (item ?? {}) as Record<string, unknown>;
    const url = typeof image.url === 'string' ? image.url.trim() : '';
    if (!url || url.length > MAX_URL_LENGTH) {
      throw new BadRequestException(`${label} 주소가 올바르지 않습니다.`);
    }
    return {
      url,
      alt: typeof image.alt === 'string' ? image.alt : null,
      sortOrder: parseSortOrder(image.sortOrder, index + 1),
    };
  });
}

function parseOptionList(raw: unknown): ProductOptionInput[] {
  if (!Array.isArray(raw)) {
    throw new BadRequestException('상품 옵션 형식이 올바르지 않습니다.');
  }
  if (raw.length > MAX_PRODUCT_OPTIONS) {
    throw new BadRequestException(
      `상품 옵션은 최대 ${MAX_PRODUCT_OPTIONS}개까지 등록할 수 있습니다.`,
    );
  }
  return raw.map((item: unknown, index) => {
    const option = (item ?? {}) as Record<string, unknown>;
    const name = typeof option.name === 'string' ? option.name.trim() : '';
    const value = typeof option.value === 'string' ? option.value.trim() : '';
    if (!name || !value) {
      throw new BadRequestException(
        '상품 옵션의 이름과 값은 비워둘 수 없습니다.',
      );
    }
    const id =
      typeof option.id === 'string' && option.id ? option.id : undefined;
    if (id !== undefined && !UUID_PATTERN.test(id)) {
      throw new BadRequestException(
        '다른 상품에 속하거나 존재하지 않는 옵션입니다.',
      );
    }
    return {
      id,
      name,
      value,
      sortOrder: parseSortOrder(option.sortOrder, index + 1),
    };
  });
}

/** 공개 응답에 회원 이메일 원문이 실리지 않도록 일부만 남깁니다. */
function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at <= 0) return null;
  const domain = email.slice(at + 1);
  // 소셜 로그인에서 이메일을 받지 못한 계정의 내부용 주소는 노출하지 않습니다.
  if (!domain || domain.endsWith('.placeholder')) return null;
  const local = email.slice(0, at);
  const visible = local.slice(0, local.length > 2 ? 2 : 1);
  return `${visible}***@${domain}`;
}

/** 여러 상품 행을 갱신할 때 트랜잭션마다 같은 순서로 잠그기 위한 정렬 */
function sortByProductId<T extends { productId: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0,
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class ShopService {
  private readonly logger = new Logger(ShopService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly couponService: CouponService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly naverPayClient: NaverPayClient,
    private readonly spacesStorageService: SpacesStorageService,
    private readonly mediaCleanupService: MediaCleanupService,
  ) {}

  getNaverPayStatus() {
    return this.naverPayClient.getConfigurationStatus();
  }

  /** [Admin] 주문 목록 조회 (관리자용) */
  async getAdminOrders(params?: { status?: string }) {
    const allowedStatuses = [
      'pending',
      'paid',
      'shipped',
      'delivered',
      'cancelled',
    ] as const;
    const status =
      params?.status &&
      (allowedStatuses as readonly string[]).includes(params.status)
        ? (params.status as (typeof allowedStatuses)[number])
        : undefined;

    const orders = await this.db.query.orders.findMany({
      where: status ? eq(schema.orders.status, status) : undefined,
      orderBy: [desc(schema.orders.createdAt)],
      with: {
        shippingAddress: {
          columns: {
            id: true,
            label: true,
            recipientName: true,
            phone: true,
            postalCode: true,
            addressLine1: true,
            addressLine2: true,
          },
        },
        orderItems: true,
      },
    });

    // 배송지는 주문 시점 스냅샷을 우선 사용합니다. 주소록이 이후에 수정·삭제되어도
    // 관리자 화면에는 고객이 주문할 때 지정한 배송지가 그대로 보입니다.
    return orders.map((order) => {
      const {
        shippingRecipientName,
        shippingPhone,
        shippingPostalCode,
        shippingAddressLine1,
        shippingAddressLine2,
        shippingAddress,
        ...rest
      } = order;
      return {
        ...rest,
        shippingAddress:
          shippingAddressLine1 != null
            ? {
                id: order.shippingAddressId ?? order.id,
                label: shippingAddress?.label ?? '주문 배송지',
                recipientName: shippingRecipientName,
                phone: shippingPhone,
                postalCode: shippingPostalCode,
                addressLine1: shippingAddressLine1,
                addressLine2: shippingAddressLine2,
              }
            : (shippingAddress ?? null),
      };
    });
  }

  /** [Admin] 송장번호 입력 후 발송 완료 처리 */
  async updateAdminOrderShipment(orderId: string, rawTrackingNumber: string) {
    const trackingNumber = rawTrackingNumber.trim();
    if (!trackingNumber) {
      throw new BadRequestException('송장번호를 입력해 주세요.');
    }

    const order = await this.db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      columns: { id: true, status: true, cancelRequestedAt: true },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    if (order.status === 'pending' || order.status === 'cancelled') {
      throw new BadRequestException(
        '발송 처리는 결제 완료된 주문부터 가능합니다.',
      );
    }

    const cancelInProgress = new ConflictException(
      '고객이 결제 취소를 요청한 주문이라 발송 처리할 수 없습니다. 잠시 후 주문 목록을 새로고침해 취소 여부를 확인해 주세요.',
    );
    if (order.status === 'paid' && order.cancelRequestedAt) {
      throw cancelInProgress;
    }

    // 조회 이후 고객의 결제 취소가 끼어들 수 있으므로 조건을 건 UPDATE로만 전환합니다.
    // 취소가 결정된(cancel_requested_at) 주문은 환불 중이거나 환불 결과를 확인하지 못한
    // 상태이므로 발송 완료로 바꾸지 않습니다.
    const [firstShipment] = await this.db
      .update(schema.orders)
      .set({ status: 'shipped', trackingNumber, updatedAt: new Date() })
      .where(
        and(
          eq(schema.orders.id, orderId),
          eq(schema.orders.status, 'paid'),
          isNull(schema.orders.cancelRequestedAt),
        ),
      )
      .returning();

    if (!firstShipment) {
      // 이미 발송된 주문의 송장번호 정정: 상태는 유지하고 메일은 다시 보내지 않습니다.
      const [corrected] = await this.db
        .update(schema.orders)
        .set({ trackingNumber, updatedAt: new Date() })
        .where(
          and(
            eq(schema.orders.id, orderId),
            inArray(schema.orders.status, ['shipped', 'delivered']),
          ),
        )
        .returning();
      if (!corrected) {
        const current = await this.db.query.orders.findFirst({
          where: eq(schema.orders.id, orderId),
          columns: { status: true, cancelRequestedAt: true },
        });
        if (current?.status === 'paid' && current.cancelRequestedAt) {
          throw cancelInProgress;
        }
        throw new ConflictException(
          '주문 상태가 변경되어 발송 처리할 수 없습니다. 주문 목록을 새로고침해 주세요.',
        );
      }
      return corrected;
    }

    const shippedOrder = await this.db.query.orders.findFirst({
      where: eq(schema.orders.id, firstShipment.id),
      columns: {
        orderNumber: true,
        trackingNumber: true,
      },
      with: {
        user: {
          columns: {
            email: true,
            fullName: true,
          },
        },
        orderItems: {
          columns: {
            productName: true,
            optionLabel: true,
            quantity: true,
            lineTotal: true,
          },
        },
      },
    });

    if (shippedOrder?.user?.email && shippedOrder.trackingNumber) {
      // 메일 지연이 발송 처리 응답을 붙잡지 않도록 기다리지 않습니다.
      void this.emailService.sendOrderShippedEmail({
        to: shippedOrder.user.email,
        name: shippedOrder.user.fullName,
        orderNumber: shippedOrder.orderNumber,
        trackingNumber: shippedOrder.trackingNumber,
        items: shippedOrder.orderItems,
      });
    }

    return firstShipment;
  }

  /**
   * [Admin] pending 주문(초안) 일괄 삭제.
   * 결제창이 열려 있을 수 있는 최근 초안과, 네이버페이 결제번호가 연결되어
   * 대사가 필요한 주문은 지우지 않습니다.
   */
  async deleteAdminPendingOrders() {
    const protectedAfter = new Date(Date.now() - PENDING_ORDER_PROTECTION_MS);
    return this.db.transaction(async (tx) => {
      const pendingOrders = await tx
        .select({ id: schema.orders.id })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.status, 'pending'),
            isNull(schema.orders.naverPaymentId),
            lt(schema.orders.createdAt, protectedAfter),
          ),
        )
        .for('update');
      if (pendingOrders.length === 0) {
        return { deletedOrders: 0 };
      }

      const pendingIds = pendingOrders.map((o) => o.id);

      await tx
        .delete(schema.orderItems)
        .where(inArray(schema.orderItems.orderId, pendingIds));
      await tx
        .delete(schema.orders)
        .where(inArray(schema.orders.id, pendingIds));

      return { deletedOrders: pendingIds.length };
    });
  }

  /** 카테고리 목록 조회 */
  async getCategories() {
    return this.db.query.productCategories.findMany({
      orderBy: [asc(schema.productCategories.sortOrder)],
    });
  }

  /** [Admin] 카테고리 생성 */
  async createCategory(data: {
    slug: string;
    name: string;
    sortOrder?: number;
  }) {
    const normalizedSlug = data.slug.trim();
    const normalizedName = data.name.trim();
    if (!normalizedSlug || !normalizedName) {
      throw new BadRequestException('카테고리 이름과 slug를 입력해 주세요.');
    }
    const existing = await this.db.query.productCategories.findFirst({
      where: eq(schema.productCategories.slug, normalizedSlug),
    });
    if (existing) {
      throw new ConflictException('이미 존재하는 카테고리 slug 입니다.');
    }
    const [created] = await this.db
      .insert(schema.productCategories)
      .values({
        slug: normalizedSlug,
        name: normalizedName,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();
    return created;
  }

  /** [Admin] 카테고리 수정 */
  async updateCategory(
    id: string,
    data: {
      slug?: string | null;
      name?: string | null;
      sortOrder?: number | null;
    },
  ) {
    const category = await this.db.query.productCategories.findFirst({
      where: eq(schema.productCategories.id, id),
    });
    if (!category) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }

    // null은 "보내지 않음"과 같게 취급합니다.
    const slug = data.slug ?? undefined;
    const name = data.name ?? undefined;
    if (
      (slug !== undefined && !slug.trim()) ||
      (name !== undefined && !name.trim())
    ) {
      throw new BadRequestException('카테고리 이름과 slug를 입력해 주세요.');
    }

    if (slug !== undefined) {
      const normalizedSlug = slug.trim();
      const existing = await this.db.query.productCategories.findFirst({
        where: eq(schema.productCategories.slug, normalizedSlug),
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('이미 존재하는 카테고리 slug 입니다.');
      }
    }

    const [updated] = await this.db
      .update(schema.productCategories)
      .set({
        ...(slug !== undefined && { slug: slug.trim() }),
        ...(name !== undefined && { name: name.trim() }),
        ...(data.sortOrder != null && { sortOrder: data.sortOrder }),
      })
      .where(eq(schema.productCategories.id, id))
      .returning();
    return updated;
  }

  /** [Admin] 카테고리 삭제 */
  async deleteCategory(id: string) {
    const category = await this.db.query.productCategories.findFirst({
      where: eq(schema.productCategories.id, id),
    });
    if (!category) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }

    const linkedProduct = await this.db.query.products.findFirst({
      where: eq(schema.products.categoryId, id),
    });
    if (linkedProduct) {
      throw new BadRequestException(
        '이 카테고리를 사용하는 상품이 있어 삭제할 수 없습니다.',
      );
    }

    const [deleted] = await this.db
      .delete(schema.productCategories)
      .where(eq(schema.productCategories.id, id))
      .returning();
    return deleted;
  }

  /** 상품 목록 조회 (카테고리 필터링 포함) */
  async getProducts(categoryId?: string) {
    // 잘못된 형식의 카테고리 ID는 조회 오류 대신 빈 목록으로 응답합니다.
    if (categoryId && !UUID_PATTERN.test(categoryId)) return [];

    return this.db.query.products.findMany({
      where: categoryId
        ? and(
            eq(schema.products.categoryId, categoryId),
            eq(schema.products.isActive, true),
          )
        : eq(schema.products.isActive, true),
      with: {
        category: true,
        images: {
          orderBy: [asc(schema.productImages.sortOrder)],
          limit: 1,
        },
      },
      orderBy: [desc(schema.products.createdAt)],
    });
  }

  /** 상품 상세 조회 (slug 또는 id, 상세 이미지/구매평 포함). 판매 중인 상품만 노출합니다. */
  async getProduct(slugOrId: string) {
    const byId = UUID_PATTERN.test(slugOrId);
    const product = await this.loadProductDetail(
      and(
        byId
          ? eq(schema.products.id, slugOrId)
          : eq(schema.products.slug, slugOrId),
        eq(schema.products.isActive, true),
      ),
    );

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    return {
      ...product,
      // 누구나 볼 수 있는 응답이므로 작성자 이메일은 일부만 남깁니다.
      reviews: product.reviews.map((review) => ({
        ...review,
        user: review.user
          ? { ...review.user, email: maskEmail(review.user.email) }
          : review.user,
      })),
    };
  }

  /** [Admin] 수정 직후 응답용 상세 조회 (판매 여부와 무관) */
  private async getProductForAdmin(id: string) {
    const product = await this.loadProductDetail(eq(schema.products.id, id));
    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }
    return product;
  }

  private async loadProductDetail(where: ReturnType<typeof and>) {
    const product = await this.db.query.products.findFirst({
      where,
      with: {
        category: true,
        images: {
          orderBy: [asc(schema.productImages.sortOrder)],
        },
        options: {
          orderBy: [asc(schema.productOptions.sortOrder)],
        },
        detailImages: {
          orderBy: [asc(schema.productDetailImages.sortOrder)],
        },
      },
    });
    if (!product) return null;

    const reviews = await this.db.query.productReviews.findMany({
      where: eq(schema.productReviews.productId, product.id),
      orderBy: [desc(schema.productReviews.createdAt)],
      with: {
        user: {
          columns: { id: true, fullName: true, email: true },
        },
        images: {
          orderBy: [asc(schema.productReviewImages.sortOrder)],
        },
      },
    });

    return { ...product, reviews };
  }

  async hasMyRestockSubscription(userId: string, productId: string) {
    const row = await this.db.query.productRestockSubscriptions.findFirst({
      where: and(
        eq(schema.productRestockSubscriptions.userId, userId),
        eq(schema.productRestockSubscriptions.productId, productId),
      ),
      columns: { id: true },
    });
    return { subscribed: !!row };
  }

  async subscribeRestockNotification(userId: string, productId: string) {
    const product = await this.db.query.products.findFirst({
      where: eq(schema.products.id, productId),
      columns: { id: true, stockQuantity: true, isActive: true },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }
    if (product.stockQuantity > 0) {
      throw new BadRequestException('현재 구매 가능한 상품입니다.');
    }

    // 버튼 연타 등 동시 요청에서도 (회원, 상품) 유니크 제약 오류가 나지 않도록 합니다.
    await this.db
      .insert(schema.productRestockSubscriptions)
      .values({ userId, productId })
      .onConflictDoNothing();
    return { subscribed: true };
  }

  /** 장바구니 목록 조회 */
  async getCartItems(userId: string) {
    return this.db.query.cartItems.findMany({
      where: eq(schema.cartItems.userId, userId),
      with: {
        product: {
          with: {
            images: {
              limit: 1,
              orderBy: [asc(schema.productImages.sortOrder)],
            },
          },
        },
        option: true,
      },
      orderBy: [desc(schema.cartItems.createdAt)],
    });
  }

  /** 장바구니 아이템 추가/수정 */
  async addToCart(
    userId: string,
    productId: string,
    quantity: number,
    optionId?: string,
  ) {
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > CART_MAX_QUANTITY
    ) {
      throw new BadRequestException('수량은 1 이상의 정수로 입력해 주세요.');
    }

    const product = await this.db.query.products.findFirst({
      where: eq(schema.products.id, productId),
      columns: { id: true, isActive: true, stockQuantity: true },
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    if (!product.isActive) {
      throw new BadRequestException('판매가 중지된 상품입니다.');
    }

    if (product.stockQuantity <= 0) {
      throw new BadRequestException('재고가 없습니다. (품절)');
    }

    if (quantity > product.stockQuantity) {
      throw new BadRequestException(
        `재고가 부족합니다. (구매 가능 수량: ${product.stockQuantity}개)`,
      );
    }

    // 상품에 옵션이 존재한다면, optionId를 반드시 선택해야 장바구니에 담을 수 있게 방어
    const productOptions = await this.db.query.productOptions.findMany({
      where: eq(schema.productOptions.productId, productId),
      columns: { id: true },
    });

    if (productOptions.length > 0) {
      if (!optionId) {
        throw new BadRequestException('옵션을 선택해 주세요.');
      }

      // 선택된 optionId가 해당 상품의 옵션인지 검증
      if (!productOptions.some((option) => option.id === optionId)) {
        throw new BadRequestException('잘못된 옵션입니다.');
      }
    } else if (optionId) {
      // 옵션이 없는 상품에 다른 상품의 옵션이 붙어 저장되지 않도록 막습니다.
      throw new BadRequestException(
        '상품 옵션 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.',
      );
    }

    // 동일한 상품/옵션이 이미 있는지 확인
    const existing = await this.db.query.cartItems.findFirst({
      where: and(
        eq(schema.cartItems.userId, userId),
        eq(schema.cartItems.productId, productId),
        optionId
          ? eq(schema.cartItems.optionId, optionId)
          : isNull(schema.cartItems.optionId),
      ),
    });

    if (existing) {
      // 수량 업데이트 (동시 요청에서도 누락되지 않도록 DB에서 더합니다).
      // 같은 상품을 여러 번 담아도 재고를 넘지 않게 하되, 이미 담겨 있던 수량은 줄이지 않습니다.
      const maxQuantity = Math.min(product.stockQuantity, CART_MAX_QUANTITY);
      const [updated] = await this.db
        .update(schema.cartItems)
        .set({
          quantity: sql`GREATEST(${schema.cartItems.quantity}, LEAST(${schema.cartItems.quantity} + ${quantity}, ${maxQuantity}))`,
          updatedAt: new Date(),
        })
        .where(eq(schema.cartItems.id, existing.id))
        .returning();
      if (updated) return updated;
    }

    // 신규 추가
    const [created] = await this.db
      .insert(schema.cartItems)
      .values({
        userId,
        productId,
        optionId: optionId ?? null,
        quantity,
      })
      .returning();
    return created;
  }

  /** 장바구니 아이템 수량 변경 */
  async updateCartItemQuantity(
    userId: string,
    cartItemId: string,
    quantity: number,
  ) {
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > CART_MAX_QUANTITY
    ) {
      throw new BadRequestException('수량은 1 이상의 정수로 입력해 주세요.');
    }

    const item = await this.db.query.cartItems.findFirst({
      where: and(
        eq(schema.cartItems.id, cartItemId),
        eq(schema.cartItems.userId, userId),
      ),
      columns: { id: true, quantity: true },
      with: { product: { columns: { stockQuantity: true } } },
    });
    if (!item) {
      throw new NotFoundException('장바구니 아이템을 찾을 수 없습니다.');
    }

    // 수량을 줄이는 것은 언제나 허용하고, 늘릴 때만 재고를 확인합니다.
    if (quantity > item.quantity && quantity > item.product.stockQuantity) {
      throw new BadRequestException(
        `재고가 부족합니다. (구매 가능 수량: ${Math.max(0, item.product.stockQuantity)}개)`,
      );
    }

    const [updated] = await this.db
      .update(schema.cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(
        and(
          eq(schema.cartItems.id, cartItemId),
          eq(schema.cartItems.userId, userId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundException('장바구니 아이템을 찾을 수 없습니다.');
    }
    return updated;
  }

  /** 장바구니 아이템 삭제 */
  async removeFromCart(userId: string, cartItemId: string) {
    const [deleted] = await this.db
      .delete(schema.cartItems)
      .where(
        and(
          eq(schema.cartItems.id, cartItemId),
          eq(schema.cartItems.userId, userId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new NotFoundException('장바구니 아이템을 찾을 수 없습니다.');
    }
    return deleted;
  }

  /** [Admin] 상품 생성 */
  async createProduct(body: unknown) {
    const data = assertProductPayload(body);
    // 요청 본문에서 허용한 필드만 골라 저장합니다. (id·생성일 등 임의 필드는 무시)
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const slug = typeof data.slug === 'string' ? data.slug.trim() : '';

    if (!name || !slug) {
      throw new BadRequestException('상품명과 slug는 필수입니다.');
    }
    if (!PRODUCT_SLUG_PATTERN.test(slug)) {
      throw new BadRequestException(
        'slug는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.',
      );
    }
    assertProductSlugNotReserved(slug);
    const categoryId =
      typeof data.categoryId === 'string' ? data.categoryId.trim() : '';
    if (!UUID_PATTERN.test(categoryId)) {
      throw new BadRequestException('카테고리를 선택해 주세요.');
    }
    const submittedPrice = parseNonNegativeInt(
      data.price,
      '가격은 0 이상이어야 합니다.',
    );
    const discountRate =
      data.discountRate == null ? 0 : parseDiscountRate(data.discountRate);
    const originalPrice =
      data.originalPrice == null
        ? submittedPrice
        : parseNonNegativeInt(
            data.originalPrice,
            '정상가는 0 이상이어야 합니다.',
          );
    const stockQuantity =
      data.stockQuantity == null
        ? 999
        : parseNonNegativeInt(
            data.stockQuantity,
            '재고 수량은 0 이상이어야 합니다.',
          );
    const images =
      data.images == null ? [] : parseImageList(data.images, '상품 이미지');
    const options = data.options == null ? [] : parseOptionList(data.options);
    const detailImages =
      data.detailImages == null
        ? []
        : parseImageList(data.detailImages, '상세 이미지');

    await this.assertCategoryExists(categoryId);
    await this.assertProductSlugAvailable(slug);

    return await this.db.transaction(async (tx) => {
      const [product] = await tx
        .insert(schema.products)
        .values({
          categoryId,
          name,
          slug,
          description: parseOptionalText(data.description),
          price:
            discountRate > 0
              ? discountedPrice(originalPrice, discountRate)
              : submittedPrice,
          originalPrice: discountRate > 0 ? originalPrice : null,
          discountRate,
          stockQuantity,
          isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
          purchaseNotice: parseOptionalText(data.purchaseNotice),
          handlingNotice: parseOptionalText(data.handlingNotice),
          shippingNotice: parseOptionalText(data.shippingNotice),
          exchangeReturnNotice: parseOptionalText(data.exchangeReturnNotice),
          careGuide: parseOptionalText(data.careGuide),
        })
        .returning();

      if (images.length > 0) {
        await tx
          .insert(schema.productImages)
          .values(images.map((image) => ({ ...image, productId: product.id })));
      }

      if (options.length > 0) {
        await tx.insert(schema.productOptions).values(
          options.map((option) => ({
            productId: product.id,
            name: option.name,
            value: option.value,
            sortOrder: option.sortOrder,
          })),
        );
      }

      if (detailImages.length > 0) {
        await tx
          .insert(schema.productDetailImages)
          .values(
            detailImages.map((image) => ({ ...image, productId: product.id })),
          );
      }

      const created = await tx.query.products.findFirst({
        where: eq(schema.products.id, product.id),
        with: {
          category: true,
          images: {
            orderBy: [asc(schema.productImages.sortOrder)],
          },
          options: {
            orderBy: [asc(schema.productOptions.sortOrder)],
          },
          detailImages: {
            orderBy: [asc(schema.productDetailImages.sortOrder)],
          },
        },
      });
      if (!created) {
        throw new NotFoundException('상품을 찾을 수 없습니다.');
      }
      return { ...created, reviews: [] };
    });
  }

  /** [Admin] 상품 수정 */
  async updateProduct(id: string, body: unknown) {
    const data = assertProductPayload(body);
    // 요청 본문에서 허용한 필드만 골라 반영합니다. (id·생성일 등 임의 필드는 무시)
    const updates: Partial<typeof schema.products.$inferInsert> = {};

    if (data.name !== undefined) {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name) {
        throw new BadRequestException('상품명은 비워둘 수 없습니다.');
      }
      updates.name = name;
    }

    if (data.slug !== undefined) {
      const slug = typeof data.slug === 'string' ? data.slug.trim() : '';
      if (!slug) {
        throw new BadRequestException('slug는 비워둘 수 없습니다.');
      }
      if (!PRODUCT_SLUG_PATTERN.test(slug)) {
        throw new BadRequestException(
          'slug는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.',
        );
      }
      updates.slug = slug;
    }

    if (data.categoryId !== undefined) {
      const categoryId =
        typeof data.categoryId === 'string' ? data.categoryId.trim() : '';
      if (!UUID_PATTERN.test(categoryId)) {
        throw new BadRequestException('카테고리를 선택해 주세요.');
      }
      updates.categoryId = categoryId;
    }

    const price =
      data.price !== undefined
        ? parseNonNegativeInt(data.price, '가격은 0 이상이어야 합니다.')
        : undefined;
    const originalPrice =
      data.originalPrice != null
        ? parseNonNegativeInt(
            data.originalPrice,
            '정상가는 0 이상이어야 합니다.',
          )
        : undefined;
    const discountRate =
      data.discountRate === undefined
        ? undefined
        : data.discountRate === null
          ? 0
          : parseDiscountRate(data.discountRate);

    if (data.stockQuantity !== undefined) {
      updates.stockQuantity = parseNonNegativeInt(
        data.stockQuantity,
        '재고 수량은 0 이상이어야 합니다.',
      );
    }
    if (typeof data.isActive === 'boolean') updates.isActive = data.isActive;
    if (data.description !== undefined) {
      updates.description = parseOptionalText(data.description);
    }
    if (data.purchaseNotice !== undefined) {
      updates.purchaseNotice = parseOptionalText(data.purchaseNotice);
    }
    if (data.handlingNotice !== undefined) {
      updates.handlingNotice = parseOptionalText(data.handlingNotice);
    }
    if (data.shippingNotice !== undefined) {
      updates.shippingNotice = parseOptionalText(data.shippingNotice);
    }
    if (data.exchangeReturnNotice !== undefined) {
      updates.exchangeReturnNotice = parseOptionalText(
        data.exchangeReturnNotice,
      );
    }
    if (data.careGuide !== undefined) {
      updates.careGuide = parseOptionalText(data.careGuide);
    }

    // images는 값이 있을 때만 교체하고, detailImages는 null이면 모두 비웁니다. (기존 동작 유지)
    const images =
      data.images == null
        ? undefined
        : parseImageList(data.images, '상품 이미지');
    const options =
      data.options == null ? undefined : parseOptionList(data.options);
    const detailImages =
      data.detailImages === undefined
        ? undefined
        : data.detailImages === null
          ? []
          : parseImageList(data.detailImages, '상세 이미지');

    if (updates.categoryId) await this.assertCategoryExists(updates.categoryId);
    if (updates.slug) {
      const current = await this.db.query.products.findFirst({
        where: eq(schema.products.id, id),
        columns: { slug: true },
      });
      if (!current) {
        throw new NotFoundException('상품을 찾을 수 없습니다.');
      }
      // slug를 실제로 바꿀 때만 검사해, 기존 상품의 다른 항목 수정이 막히지 않게 합니다.
      if (current.slug !== updates.slug) {
        assertProductSlugNotReserved(updates.slug);
        await this.assertProductSlugAvailable(updates.slug, id);
      }
    }

    const updateResult = await this.db.transaction(async (tx) => {
      const before = await tx.query.products.findFirst({
        where: eq(schema.products.id, id),
        columns: {
          stockQuantity: true,
          price: true,
          originalPrice: true,
          discountRate: true,
        },
        with: {
          images: { columns: { url: true } },
          detailImages: { columns: { url: true } },
        },
      });
      if (!before) {
        throw new NotFoundException('상품을 찾을 수 없습니다.');
      }

      const pricingTouched =
        price !== undefined ||
        originalPrice !== undefined ||
        discountRate !== undefined;
      if (pricingTouched) {
        const nextDiscountRate = discountRate ?? before.discountRate;
        if (nextDiscountRate > 0) {
          const nextOriginalPrice =
            originalPrice ?? before.originalPrice ?? price ?? before.price;
          updates.originalPrice = nextOriginalPrice;
          updates.discountRate = nextDiscountRate;
          updates.price = discountedPrice(nextOriginalPrice, nextDiscountRate);
        } else {
          updates.discountRate = 0;
          updates.originalPrice = null;
          updates.price = price ?? before.price;
        }
      }

      if (Object.keys(updates).length > 0) {
        await tx
          .update(schema.products)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(schema.products.id, id));
      }

      if (images) {
        await tx
          .delete(schema.productImages)
          .where(eq(schema.productImages.productId, id));
        if (images.length > 0) {
          await tx
            .insert(schema.productImages)
            .values(images.map((image) => ({ ...image, productId: id })));
        }
      }

      if (options) {
        const existingOptions = await tx.query.productOptions.findMany({
          where: eq(schema.productOptions.productId, id),
          orderBy: [asc(schema.productOptions.sortOrder)],
        });
        const existingById = new Map(
          existingOptions.map((option) => [option.id, option]),
        );
        const retainedOptionIds = new Set<string>();

        // ID가 있는 옵션을 먼저 확정해, ID 없는 새 옵션이 기존 옵션 행을 가로채지 않게 합니다.
        for (const option of options) {
          if (!option.id) continue;
          if (!existingById.has(option.id)) {
            throw new BadRequestException(
              '다른 상품에 속하거나 존재하지 않는 옵션입니다.',
            );
          }
          if (retainedOptionIds.has(option.id)) {
            throw new BadRequestException(
              '동일한 상품 옵션이 요청에 중복되어 있습니다.',
            );
          }
          retainedOptionIds.add(option.id);
        }

        for (const option of options) {
          const { name, value, sortOrder } = option;

          // ID 없이 온 옵션은 이름·값이 완전히 같은 기존 옵션만 재사용합니다.
          // 위치가 같다는 이유로 다른 옵션 행을 덮어쓰면, 그 옵션을 담아 둔 고객의
          // 장바구니가 조용히 다른 옵션으로 바뀌므로 그 외에는 새 옵션으로 추가합니다.
          const existingOption = option.id
            ? existingById.get(option.id)
            : existingOptions.find(
                (candidate) =>
                  !retainedOptionIds.has(candidate.id) &&
                  candidate.name === name &&
                  candidate.value === value,
              );

          if (existingOption) {
            retainedOptionIds.add(existingOption.id);
            await tx
              .update(schema.productOptions)
              .set({ name, value, sortOrder })
              .where(
                and(
                  eq(schema.productOptions.id, existingOption.id),
                  eq(schema.productOptions.productId, id),
                ),
              );
          } else {
            const [createdOption] = await tx
              .insert(schema.productOptions)
              .values({ productId: id, name, value, sortOrder })
              .returning({ id: schema.productOptions.id });
            retainedOptionIds.add(createdOption.id);
          }
        }

        const removedOptionIds = existingOptions
          .filter((option) => !retainedOptionIds.has(option.id))
          .map((option) => option.id);

        if (removedOptionIds.length > 0) {
          // 삭제된 옵션이 담긴 장바구니 항목은 더 이상 구매할 수 없으므로 제거합니다.
          await tx
            .delete(schema.cartItems)
            .where(inArray(schema.cartItems.optionId, removedOptionIds));

          // 주문 내역에는 optionLabel 스냅샷이 남아 있으므로 FK만 해제합니다.
          await tx
            .update(schema.orderItems)
            .set({ productOptionId: null })
            .where(
              inArray(schema.orderItems.productOptionId, removedOptionIds),
            );

          await tx
            .delete(schema.productOptions)
            .where(inArray(schema.productOptions.id, removedOptionIds));
        }
      }

      if (detailImages !== undefined) {
        await tx
          .delete(schema.productDetailImages)
          .where(eq(schema.productDetailImages.productId, id));
        if (detailImages.length > 0) {
          await tx
            .insert(schema.productDetailImages)
            .values(detailImages.map((image) => ({ ...image, productId: id })));
        }
      }
      const after = await tx.query.products.findFirst({
        where: eq(schema.products.id, id),
        columns: {
          id: true,
          stockQuantity: true,
          isActive: true,
        },
      });
      if (!after) {
        throw new NotFoundException('상품을 찾을 수 없습니다.');
      }

      const previousImageUrls = [
        ...before.images.map((image) => image.url),
        ...before.detailImages.map((image) => image.url),
      ];
      const retainedImageUrls = new Set([
        ...(images !== undefined
          ? images.map((image) => image.url)
          : before.images.map((image) => image.url)),
        ...(detailImages !== undefined
          ? detailImages.map((image) => image.url)
          : before.detailImages.map((image) => image.url)),
      ]);
      const removedImageUrls = previousImageUrls.filter(
        (url) => !retainedImageUrls.has(url),
      );

      const becameInStock =
        before.stockQuantity <= 0 && after.stockQuantity > 0;
      const restockMailTargets = becameInStock
        ? await this.takeRestockMailTargets(tx, [after.id])
        : [];

      return { restockMailTargets, removedImageUrls };
    });
    const { restockMailTargets, removedImageUrls } = updateResult;

    await this.mediaCleanupService.removeUnreferenced(
      removedImageUrls,
      'product',
    );
    this.sendRestockMails(restockMailTargets);

    return this.getProductForAdmin(id);
  }

  /** 내가 작성한 구매평 목록 (productId별 1개, 상품 정보 포함) */
  async getMyReviews(userId: string) {
    return this.db.query.productReviews.findMany({
      where: eq(schema.productReviews.userId, userId),
      orderBy: [desc(schema.productReviews.createdAt)],
      with: {
        product: {
          columns: { id: true, name: true, slug: true },
        },
        images: {
          orderBy: [asc(schema.productReviewImages.sortOrder)],
        },
      },
    });
  }

  /** 내 구매평 수정 */
  async updateMyReview(
    userId: string,
    reviewId: string,
    data: { body: string; rating?: number | null; imageUrls?: string[] },
    baseUrl: string,
  ) {
    const existing = await this.db.query.productReviews.findFirst({
      where: eq(schema.productReviews.id, reviewId),
      with: {
        images: {
          orderBy: [asc(schema.productReviewImages.sortOrder)],
        },
      },
      columns: { id: true, userId: true },
    });

    if (!existing) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다.');
    }

    if (existing.userId !== userId) {
      throw new BadRequestException('잘못된 접근입니다.');
    }

    await this.saveReviewChanges(existing, data, baseUrl);

    return this.db.query.productReviews.findFirst({
      where: eq(schema.productReviews.id, reviewId),
      with: {
        product: {
          columns: { id: true, name: true, slug: true },
        },
        images: {
          orderBy: [asc(schema.productReviewImages.sortOrder)],
        },
      },
    });
  }

  /** 내 구매평 삭제 */
  async deleteMyReview(userId: string, reviewId: string) {
    const existing = await this.db.query.productReviews.findFirst({
      where: and(
        eq(schema.productReviews.id, reviewId),
        eq(schema.productReviews.userId, userId),
      ),
      columns: { id: true },
      with: { images: { columns: { url: true } } },
    });

    if (!existing) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다.');
    }

    await this.db
      .delete(schema.productReviews)
      .where(eq(schema.productReviews.id, reviewId));

    await this.mediaCleanupService.removeUnreferenced(
      existing.images.map((image) => image.url),
      'review',
    );

    return { id: reviewId };
  }

  /** [Admin] 구매평 목록 */
  async getAdminReviews() {
    return this.db.query.productReviews.findMany({
      orderBy: [desc(schema.productReviews.createdAt)],
      with: {
        product: {
          columns: { id: true, name: true, slug: true },
        },
        user: {
          columns: { id: true, fullName: true, email: true },
        },
        images: {
          orderBy: [asc(schema.productReviewImages.sortOrder)],
        },
      },
    });
  }

  /** [Admin] 구매평 수정 */
  async updateAdminReview(
    reviewId: string,
    data: { body: string; rating?: number | null; imageUrls?: string[] },
    baseUrl: string,
  ) {
    const existing = await this.db.query.productReviews.findFirst({
      where: eq(schema.productReviews.id, reviewId),
      columns: { id: true },
      with: { images: { columns: { url: true } } },
    });

    if (!existing) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다.');
    }

    await this.saveReviewChanges(existing, data, baseUrl);

    return this.db.query.productReviews.findFirst({
      where: eq(schema.productReviews.id, reviewId),
      with: {
        product: {
          columns: { id: true, name: true, slug: true },
        },
        user: {
          columns: { id: true, fullName: true, email: true },
        },
        images: {
          orderBy: [asc(schema.productReviewImages.sortOrder)],
        },
      },
    });
  }

  /** [Admin] 구매평 삭제 */
  async deleteAdminReview(reviewId: string) {
    const existing = await this.db.query.productReviews.findFirst({
      where: eq(schema.productReviews.id, reviewId),
      columns: { id: true },
      with: { images: { columns: { url: true } } },
    });

    if (!existing) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다.');
    }

    await this.db
      .delete(schema.productReviews)
      .where(eq(schema.productReviews.id, reviewId));

    await this.mediaCleanupService.removeUnreferenced(
      existing.images.map((image) => image.url),
      'review',
    );

    return { id: reviewId };
  }

  /** 구매평 본문·별점·이미지 변경을 저장하고, 빠진 이미지는 저장소에서 정리합니다. */
  private async saveReviewChanges(
    existing: { id: string; images: Array<{ url: string }> },
    data: { body: string; rating?: number | null; imageUrls?: string[] },
    baseUrl: string,
  ): Promise<void> {
    const reviewId = existing.id;
    const existingUrls = existing.images.map((image) => image.url);
    const imageUrls =
      data.imageUrls === undefined
        ? undefined
        : await this.resolveReviewImageUrls(
            data.imageUrls,
            baseUrl,
            existingUrls,
          );

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.productReviews)
        .set({
          body: data.body,
          rating: data.rating ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.productReviews.id, reviewId));

      if (imageUrls !== undefined) {
        await tx
          .delete(schema.productReviewImages)
          .where(eq(schema.productReviewImages.reviewId, reviewId));

        if (imageUrls.length > 0) {
          await tx.insert(schema.productReviewImages).values(
            imageUrls.map((url, i) => ({
              reviewId,
              url,
              sortOrder: i + 1,
            })),
          );
        }
      }
    });

    if (imageUrls !== undefined) {
      const retained = new Set(imageUrls);
      await this.mediaCleanupService.removeUnreferenced(
        existingUrls.filter((url) => !retained.has(url)),
        'review',
      );
    }
  }

  /**
   * 구매평에 붙일 이미지 주소를 확인합니다.
   * 이미 이 구매평에 붙어 있던 주소는 그대로 두고, 새로 추가된 주소는
   * 이 서버의 구매평 업로드로 저장된 파일만 허용합니다.
   */
  private async resolveReviewImageUrls(
    imageUrls: string[],
    baseUrl: string,
    alreadyAttached: string[] = [],
  ): Promise<string[]> {
    if (imageUrls.length > REVIEW_MAX_IMAGES) {
      throw new BadRequestException(
        `사진은 최대 ${REVIEW_MAX_IMAGES}장까지 첨부할 수 있습니다.`,
      );
    }
    const attached = new Set(alreadyAttached);
    const resolved: string[] = [];
    for (const url of imageUrls) {
      if (attached.has(url)) {
        resolved.push(url);
        continue;
      }
      const owned = await this.spacesStorageService.resolveUploadedUrl(
        url,
        'review',
        baseUrl,
      );
      if (!owned) {
        throw new BadRequestException(
          '첨부한 사진 주소가 올바르지 않습니다. 사진을 다시 첨부해 주세요.',
        );
      }
      resolved.push(owned);
    }
    return [...new Set(resolved)];
  }

  /** 내 주문 목록 (주문별 상세 아이템 포함) */
  async getMyOrders(userId: string) {
    const list = await this.db.query.orders.findMany({
      where: and(
        eq(schema.orders.userId, userId),
        or(
          eq(schema.orders.status, 'paid'),
          eq(schema.orders.status, 'shipped'),
          eq(schema.orders.status, 'delivered'),
          eq(schema.orders.status, 'cancelled'),
        ),
      ),
      orderBy: [desc(schema.orders.createdAt)],
      with: {
        orderItems: {
          with: {
            product: {
              with: {
                images: {
                  limit: 1,
                  orderBy: [asc(schema.productImages.sortOrder)],
                },
              },
            },
          },
        },
      },
    });
    return list;
  }

  /**
   * 내 결제 취소 (발송 전 paid 주문만 가능).
   *
   * 1) 취소 결정을 주문에 먼저 기록(커밋)해 발송 처리를 막고,
   * 2) DB 연결·잠금을 잡지 않은 상태에서 네이버페이에 취소를 요청한 뒤,
   * 3) 주문 취소 확정과 재고·쿠폰 원복을 한 트랜잭션으로 처리합니다.
   * 환불 뒤 3)이 실패해도 주문은 "취소 요청됨" 상태로 남아 발송되지 않으며, 다시 취소를
   * 요청하면 네이버페이가 "이미 취소됨"으로 응답하므로 3)만 마저 반영됩니다.
   */
  async cancelMyPaidOrder(userId: string, orderId: string) {
    const [order] = await this.db
      .update(schema.orders)
      .set({
        cancelRequestedAt: sql`COALESCE(${schema.orders.cancelRequestedAt}, now())`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.orders.id, orderId),
          eq(schema.orders.userId, userId),
          eq(schema.orders.status, 'paid'),
        ),
      )
      .returning({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        couponId: schema.orders.couponId,
        total: schema.orders.total,
        naverPaymentId: schema.orders.naverPaymentId,
        createdAt: schema.orders.createdAt,
      });

    if (!order) {
      const current = await this.db.query.orders.findFirst({
        where: and(
          eq(schema.orders.id, orderId),
          eq(schema.orders.userId, userId),
        ),
        columns: { orderNumber: true, status: true },
      });
      if (!current) {
        throw new NotFoundException('주문을 찾을 수 없습니다.');
      }
      if (current.status === 'cancelled') {
        return {
          orderNumber: current.orderNumber,
          status: 'cancelled' as const,
        };
      }
      throw new BadRequestException(
        '발송 전 결제 완료 주문만 취소할 수 있습니다.',
      );
    }

    // 여기서부터 주문은 발송 처리되지 않습니다. 네이버페이에 취소를 요청하지 못한 것이
    // 확실한 경우에만 표시를 풀어 주문을 원래 상태로 되돌립니다.
    let paymentId: string | null;
    try {
      paymentId =
        order.naverPaymentId ??
        (await this.naverPayClient.findPaymentIdByMerchantPayKey(
          order.orderNumber,
          order.createdAt,
        ));
    } catch (error) {
      await this.releaseCancelRequest(order.id);
      throw error;
    }
    if (!paymentId) {
      await this.releaseCancelRequest(order.id);
      throw new BadRequestException(
        '네이버페이 결제번호를 찾을 수 없습니다. 관리자에게 문의해 주세요.',
      );
    }

    try {
      await this.naverPayClient.cancelPayment({
        paymentId,
        amount: order.total,
        reason: '고객 요청으로 결제를 취소했습니다.',
        requester: '1',
        idempotencyKey: `cancel-${order.id}`,
      });
    } catch (error) {
      if (error instanceof NaverPayRejectedException) {
        // 네이버페이가 취소를 거절했으므로 결제는 그대로입니다. 주문을 다시 발송할 수 있게 되돌립니다.
        await this.releaseCancelRequest(order.id);
      } else {
        // 시간 초과·연결 오류: 환불됐는지 알 수 없으므로 표시를 남겨 발송을 막습니다.
        // 고객이 다시 취소를 요청하면 네이버페이 응답에 따라 마무리됩니다.
        this.logger.error(
          `결제 취소 결과 미확인(발송 차단 유지): order=${order.orderNumber}, paymentId=${paymentId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      throw error;
    }

    let restockMailTargets: RestockMailTarget[] = [];
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        restockMailTargets = await this.applyOrderCancellation(
          { id: order.id, userId, couponId: order.couponId },
          paymentId,
        );
        break;
      } catch (error) {
        // 교착 등 일시적인 DB 오류일 수 있어 한 번 더 시도합니다.
        if (attempt < maxAttempts) continue;
        this.logger.error(
          `결제 취소 후 주문 상태 반영 실패(발송 차단 유지): order=${order.orderNumber}, paymentId=${paymentId}`,
          error instanceof Error ? error.stack : undefined,
        );
        throw new InternalServerErrorException(
          '결제는 취소되었지만 주문 상태를 갱신하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        );
      }
    }

    this.sendRestockMails(restockMailTargets);

    return { orderNumber: order.orderNumber, status: 'cancelled' as const };
  }

  /** 취소 요청 표시를 풀어 주문을 다시 발송 가능한 결제 완료 상태로 되돌립니다. */
  private async releaseCancelRequest(orderId: string) {
    await this.db
      .update(schema.orders)
      .set({ cancelRequestedAt: null, updatedAt: new Date() })
      .where(
        and(eq(schema.orders.id, orderId), eq(schema.orders.status, 'paid')),
      );
  }

  /**
   * 환불이 끝난 주문을 취소 상태로 확정하고 재고·쿠폰을 되돌립니다.
   * 같은 주문의 취소 요청이 겹쳐도 상태 전환(paid → cancelled)에 성공한 한 건만 원복을 수행합니다.
   */
  private async applyOrderCancellation(
    order: { id: string; userId: string; couponId: string | null },
    paymentId: string,
  ): Promise<RestockMailTarget[]> {
    return this.db.transaction(async (tx) => {
      const [cancelled] = await tx
        .update(schema.orders)
        .set({
          status: 'cancelled',
          naverPaymentId: paymentId,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(schema.orders.id, order.id), eq(schema.orders.status, 'paid')),
        )
        .returning({ id: schema.orders.id });
      if (!cancelled) {
        const current = await tx.query.orders.findFirst({
          where: eq(schema.orders.id, order.id),
          columns: { status: true },
        });
        // 겹쳐 들어온 다른 취소 요청이 이미 확정한 경우
        if (current?.status === 'cancelled') return [];
        // 환불은 끝났는데 주문이 취소 가능한 상태가 아닙니다. 조용히 성공으로 넘기지 않습니다.
        throw new Error(
          `환불된 주문이 취소 상태로 전환되지 않았습니다: status=${current?.status ?? 'missing'}`,
        );
      }

      // 결제 확정과 같은 순서(쿠폰 → 상품 ID 순)로 행을 잠가 서로 교착되지 않게 합니다.
      // 쿠폰 사용 롤백
      if (order.couponId) {
        await tx
          .update(schema.coupons)
          .set({
            usedCount: sql`GREATEST(${schema.coupons.usedCount} - 1, 0)`,
          })
          .where(eq(schema.coupons.id, order.couponId));

        await tx
          .update(schema.userCoupons)
          .set({ usedAt: null, orderId: null })
          .where(
            and(
              eq(schema.userCoupons.userId, order.userId),
              eq(schema.userCoupons.couponId, order.couponId),
              eq(schema.userCoupons.orderId, order.id),
            ),
          );
      }

      const orderItems = await tx
        .select({
          productId: schema.orderItems.productId,
          quantity: schema.orderItems.quantity,
        })
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id));

      // 재고 원복 (품절이던 상품이 다시 구매 가능해지면 재입고 알림 대상)
      const restockedProductIds: string[] = [];
      for (const oi of sortByProductId(orderItems)) {
        const [product] = await tx
          .update(schema.products)
          .set({
            stockQuantity: sql`${schema.products.stockQuantity} + ${oi.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(schema.products.id, oi.productId))
          .returning({
            id: schema.products.id,
            stockQuantity: schema.products.stockQuantity,
          });
        if (
          product &&
          product.stockQuantity > 0 &&
          product.stockQuantity - oi.quantity <= 0
        ) {
          restockedProductIds.push(product.id);
        }
      }

      return this.takeRestockMailTargets(tx, restockedProductIds);
    });
  }

  /** 구매평 작성 (로그인 사용자) */
  async createReview(
    userId: string,
    productId: string,
    data: {
      body: string;
      rating?: number | null;
      imageUrls?: string[];
      orderItemId: string;
    },
    baseUrl: string,
  ) {
    const product = await this.db.query.products.findFirst({
      where: eq(schema.products.id, productId),
      columns: { id: true },
    });
    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    const orderItem = await this.db.query.orderItems.findFirst({
      where: and(
        eq(schema.orderItems.id, data.orderItemId),
        eq(schema.orderItems.productId, productId),
      ),
      with: {
        order: {
          columns: { userId: true, status: true },
        },
      },
    });

    if (!orderItem) {
      throw new BadRequestException('주문 상품을 찾을 수 없습니다.');
    }

    if (orderItem.order.userId !== userId) {
      throw new BadRequestException('잘못된 주문 상품입니다.');
    }

    // 리뷰는 발송 완료(shipped) 이후의 주문부터 작성 가능하도록 방어
    if (
      orderItem.order.status !== 'shipped' &&
      orderItem.order.status !== 'delivered'
    ) {
      throw new BadRequestException('아직 리뷰를 작성할 수 없습니다.');
    }

    const imageUrls = data.imageUrls?.length
      ? await this.resolveReviewImageUrls(data.imageUrls, baseUrl)
      : [];

    return await this.db.transaction(async (tx) => {
      // 주문 상품 행을 잠가 같은 주문 상품에 대한 동시 작성 요청을 한 건만 통과시킵니다.
      await tx
        .select({ id: schema.orderItems.id })
        .from(schema.orderItems)
        .where(eq(schema.orderItems.id, data.orderItemId))
        .for('update');

      const duplicate = await tx.query.productReviews.findFirst({
        where: eq(schema.productReviews.orderItemId, data.orderItemId),
        columns: { id: true },
      });
      if (duplicate) {
        throw new ConflictException('이미 구매평을 작성한 주문 상품입니다.');
      }

      const [review] = await tx
        .insert(schema.productReviews)
        .values({
          productId,
          orderItemId: data.orderItemId,
          userId,
          body: data.body,
          rating: data.rating ?? null,
        })
        .returning();

      if (imageUrls.length > 0) {
        await tx.insert(schema.productReviewImages).values(
          imageUrls.map((url, i) => ({
            reviewId: review.id,
            url,
            sortOrder: i + 1,
          })),
        );
      }

      // 아직 커밋 전이므로 같은 트랜잭션(tx)으로 읽어야 방금 저장한 구매평이 조회됩니다.
      return tx.query.productReviews.findFirst({
        where: eq(schema.productReviews.id, review.id),
        with: {
          user: { columns: { id: true, fullName: true, email: true } },
          images: {
            orderBy: [asc(schema.productReviewImages.sortOrder)],
          },
        },
      });
    });
  }

  async createNaverCheckoutOrder(
    userId: string,
    couponCode?: string | null,
    cartItemIds?: string[],
    cartItemQuantities?: number[],
    shippingAddressId?: string,
  ) {
    if (this.configService.get<string>('NAVER_PAY_LEGACY_CHECKOUT_ENABLED') !== 'true') {
      throw new BadRequestException('상품 상세 또는 장바구니에서 네이버페이 주문을 이용해 주세요.');
    }
    const ids = cartItemIds ?? [];
    if (ids.length === 0) {
      throw new BadRequestException('선택한 상품이 없습니다.');
    }
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        '같은 장바구니 상품이 중복 선택되었습니다.',
      );
    }

    if (!shippingAddressId) {
      throw new BadRequestException('배송지를 선택해 주세요.');
    }

    const address = await this.db.query.addresses.findFirst({
      where: and(
        eq(schema.addresses.id, shippingAddressId),
        eq(schema.addresses.userId, userId),
      ),
    });

    if (!address) {
      throw new BadRequestException('배송지를 찾을 수 없습니다.');
    }

    // 배송에 꼭 필요한 정보가 빠진 배송지로는 주문을 받지 않습니다.
    const shipping = {
      recipientName: address.recipientName?.trim() ?? '',
      phone: address.phone?.trim() ?? '',
      postalCode: address.postalCode?.trim() ?? '',
      addressLine1: address.addressLine1.trim(),
      addressLine2: address.addressLine2?.trim() || null,
    };
    if (
      !shipping.recipientName ||
      !shipping.phone ||
      !shipping.postalCode ||
      !shipping.addressLine1
    ) {
      throw new BadRequestException(
        '배송지에 받는 분 이름, 연락처, 우편번호가 모두 있어야 주문할 수 있습니다. 주소록에서 배송지를 수정한 뒤 다시 시도해 주세요.',
      );
    }

    if (cartItemQuantities && cartItemQuantities.length !== ids.length) {
      throw new BadRequestException(
        '구매 수량 정보가 상품 정보와 일치하지 않습니다.',
      );
    }

    const quantitiesById = new Map<string, number>();
    if (cartItemQuantities) {
      ids.forEach((id, idx) => {
        quantitiesById.set(id, cartItemQuantities[idx]);
      });
    }

    const cartItems = await this.db.query.cartItems.findMany({
      where: and(
        eq(schema.cartItems.userId, userId),
        inArray(schema.cartItems.id, ids),
      ),
      with: {
        product: {
          with: {
            images: {
              limit: 1,
              orderBy: [asc(schema.productImages.sortOrder)],
            },
            options: { columns: { id: true } },
          },
        },
        option: true,
      },
      orderBy: [desc(schema.cartItems.createdAt)],
    });
    if (!cartItems.length) {
      throw new BadRequestException('장바구니가 비어 있습니다.');
    }
    // 일부 항목만 남아 있는 상태로 진행하면 고객이 본 것과 다른 주문이 만들어집니다.
    if (cartItems.length !== ids.length) {
      throw new BadRequestException(
        '장바구니 정보가 변경되었습니다. 장바구니를 다시 확인해 주세요.',
      );
    }

    const lines = cartItems.map((item) => {
      if (!item.product.isActive) {
        throw new BadRequestException(
          `판매가 중지된 상품이 포함되어 있습니다: ${item.product.name}`,
        );
      }
      // 담은 뒤에 상품 옵션 구성이 바뀌었다면 어떤 옵션을 보내야 할지 알 수 없으므로 다시 담게 합니다.
      const optionIds = item.product.options.map((option) => option.id);
      const optionMatches = item.optionId
        ? optionIds.includes(item.optionId)
        : optionIds.length === 0;
      if (!optionMatches) {
        throw new BadRequestException(
          `옵션이 변경된 상품이 있습니다. 장바구니에서 삭제한 뒤 다시 담아 주세요: ${item.product.name}`,
        );
      }
      const quantity = quantitiesById.get(item.id) ?? item.quantity;
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new BadRequestException('구매 수량이 올바르지 않습니다.');
      }
      // 안전장치: 지정 구매 수량이 장바구니 수량보다 클 수 없도록 방어
      if (quantity > item.quantity) {
        throw new BadRequestException(
          '구매 수량이 장바구니 수량을 초과했습니다.',
        );
      }
      return { item, quantity };
    });

    // 옵션이 달라도 같은 상품일 수 있으므로,
    // "선택된 장바구니 아이템들에서 필요한 총 수량" 기준으로 재고를 한 번에 검증한다.
    const requiredByProductId = new Map<string, number>();
    const stockByProductId = new Map<string, number>();

    for (const { item, quantity } of lines) {
      requiredByProductId.set(
        item.productId,
        (requiredByProductId.get(item.productId) ?? 0) + quantity,
      );
      stockByProductId.set(item.productId, item.product.stockQuantity);
    }

    for (const [productId, requiredQty] of requiredByProductId.entries()) {
      const stockQty = stockByProductId.get(productId) ?? 0;
      if (stockQty <= 0) {
        throw new BadRequestException('재고가 없습니다. (품절)');
      }
      if (requiredQty > stockQty) {
        throw new BadRequestException('재고가 부족합니다.');
      }
    }

    const subtotal = lines.reduce(
      (sum, { item, quantity }) => sum + item.product.price * quantity,
      0,
    );
    if (subtotal > MAX_INT_VALUE) {
      throw new BadRequestException('주문 금액이 너무 큽니다.');
    }
    const isOutOfDelivery = isOutOfDeliveryPostalCode(shipping.postalCode);
    const shippingFee =
      subtotal === 0
        ? 0
        : subtotal >= 100000
          ? 0
          : isOutOfDelivery
            ? 5000
            : 4000;

    let couponId: string | null = null;
    let discountAmount = 0;
    const trimmedCoupon = couponCode?.trim() ? couponCode.trim() : '';
    if (trimmedCoupon) {
      const validation = await this.couponService.validateCode(
        userId,
        trimmedCoupon,
        subtotal,
      );
      couponId = validation.couponId;
      discountAmount = validation.discountAmount;
    }

    const total = Math.max(0, subtotal + shippingFee - discountAmount);
    if (total < 10) {
      throw new BadRequestException('네이버페이 최소 결제 금액은 10원입니다.');
    }

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 네이버페이 공식 규격은 대표 상품명에 "외 N건"을 붙이지 않도록 안내한다.
    const orderName = naverPayProductName(
      cartItems[0]?.product?.name ?? '도자기 상품',
    );

    const frontUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173'
    ).replace(/\/+$/, '');
    const checkoutConfig = this.naverPayClient.getCheckoutConfig();
    if (
      checkoutConfig.mode === 'production' &&
      !frontUrl.startsWith('https://')
    ) {
      throw new BadRequestException(
        '네이버페이 운영 결제의 FRONTEND_URL은 https:// 주소여야 합니다.',
      );
    }

    await this.db.transaction(async (tx) => {
      // 결제창이 열려 있는 주문을 삭제하면 승인 콜백을 복구할 수 없으므로,
      // paymentId가 없고 24시간이 지난 미완료 초안만 정리한다.
      const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
      // 주문 행을 먼저 잠급니다. 같은 초안에 대한 결제 확정이 동시에 들어와도
      // "주문은 결제 완료인데 주문 상품만 지워진" 상태가 되지 않습니다.
      const pendingOrders = await tx
        .select({ id: schema.orders.id })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.userId, userId),
            eq(schema.orders.status, 'pending'),
            isNull(schema.orders.naverPaymentId),
            lt(schema.orders.createdAt, staleBefore),
          ),
        )
        .for('update');

      if (pendingOrders.length > 0) {
        const pendingIds = pendingOrders.map((o) => o.id);
        await tx
          .delete(schema.orderItems)
          .where(inArray(schema.orderItems.orderId, pendingIds));
        await tx
          .delete(schema.orders)
          .where(inArray(schema.orders.id, pendingIds));
      }

      const [order] = await tx
        .insert(schema.orders)
        .values({
          userId,
          orderNumber,
          status: 'pending',
          shippingAddressId,
          // 주문 시점의 배송지를 주문에 고정합니다. (이후 주소록 수정·삭제와 무관)
          shippingRecipientName: shipping.recipientName,
          shippingPhone: shipping.phone,
          shippingPostalCode: shipping.postalCode,
          shippingAddressLine1: shipping.addressLine1,
          shippingAddressLine2: shipping.addressLine2,
          subtotal,
          shippingFee,
          discountAmount,
          total,
          couponId,
        })
        .returning();

      await tx.insert(schema.orderItems).values(
        lines.map(({ item, quantity }) => ({
          orderId: order.id,
          productId: item.productId,
          productOptionId: item.optionId ?? null,
          productName: item.product.name,
          optionLabel: item.option
            ? `${item.option.name}: ${item.option.value}`
            : null,
          price: item.product.price,
          quantity,
          lineTotal: item.product.price * quantity,
        })),
      );
    });

    return {
      ...checkoutConfig,
      merchantUserKey: userId,
      merchantPayKey: orderNumber,
      productName: orderName,
      productCount: lines.reduce((sum, { quantity }) => sum + quantity, 0),
      totalPayAmount: total,
      taxScopeAmount: total,
      taxExScopeAmount: 0,
      returnUrl: `${frontUrl}/checkout/success?merchantPayKey=${encodeURIComponent(orderNumber)}`,
      productItems: lines.map(({ item, quantity }) => ({
        categoryType: 'ETC',
        categoryId: 'ETC',
        uid: item.productId,
        name: naverPayProductName(
          item.option
            ? `${item.product.name} / ${item.option.name}: ${item.option.value}`
            : item.product.name,
        ),
        payReferrer: 'ETC',
        count: quantity,
      })),
    };
  }

  async confirmNaverPaymentAndFinalizeOrder(
    userId: string,
    params: { paymentId: string; merchantPayKey: string },
  ) {
    const { paymentId, merchantPayKey } = params;
    const order = await this.db.query.orders.findFirst({
      where: and(
        eq(schema.orders.orderNumber, merchantPayKey),
        eq(schema.orders.userId, userId),
      ),
      with: {
        orderItems: true,
      },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    // 결과 페이지 새로고침 등으로 같은 승인 요청이 다시 와도 이미 결제된 주문은 그대로 성공 처리합니다.
    if (
      order.status === 'paid' ||
      order.status === 'shipped' ||
      order.status === 'delivered'
    ) {
      return { orderNumber: order.orderNumber, status: 'paid' };
    }
    if (order.status !== 'pending') {
      throw new BadRequestException('승인할 수 없는 주문 상태입니다.');
    }
    if (order.naverPaymentId && order.naverPaymentId !== paymentId) {
      throw new BadRequestException(
        '주문에 이미 다른 네이버페이 결제번호가 연결되어 있습니다.',
      );
    }

    // 이전 승인 요청에서 이미 결제 취소가 결정된 주문입니다(자동취소가 끝나지 않은 상태).
    // 환불 여부가 불확실한 결제를 다시 "결제 완료"로 확정하지 않고, 취소를 마저 끝냅니다.
    if (order.cancelRequestedAt) {
      if (!order.naverPaymentId) {
        throw new InternalServerErrorException(
          `결제 처리 확인이 필요합니다. 주문번호 ${order.orderNumber}로 고객센터에 문의해 주세요.`,
        );
      }
      try {
        await this.cancelApprovedPaymentUnlessConfirmed({
          orderId: order.id,
          paymentId: order.naverPaymentId,
          payHistId: order.naverPayHistId,
          amount: order.total,
          reason: '가맹점 주문 확정 실패로 자동 취소합니다.',
          idempotencyKey: `rollback-${order.id}`,
        });
      } catch (cancelError) {
        this.logger.error(
          `자동취소 재시도 실패: order=${order.orderNumber}, paymentId=${order.naverPaymentId}`,
          cancelError instanceof Error ? cancelError.stack : undefined,
        );
        throw new InternalServerErrorException(
          `결제 처리 확인이 필요합니다. 주문번호 ${order.orderNumber}로 고객센터에 문의해 주세요.`,
        );
      }
      throw new BadRequestException(
        '주문을 확정하지 못해 결제를 자동 취소했습니다. 다시 주문해 주세요.',
      );
    }

    const approval = await this.naverPayClient.approvePayment(paymentId);

    // 다른 주문의 paymentId를 전달한 요청으로 타 주문 결제를 취소하지 않도록
    // 주문 식별값이 다르면 자동취소 없이 즉시 차단합니다.
    if (
      !approval.paymentId ||
      approval.paymentId !== paymentId ||
      !approval.merchantPayKey ||
      approval.merchantPayKey !== order.orderNumber
    ) {
      this.logger.error(
        `네이버페이 승인 주문 불일치: order=${order.orderNumber}, paymentId=${paymentId}, approvedMerchantPayKey=${approval.merchantPayKey ?? 'missing'}`,
      );
      throw new BadRequestException(
        '승인된 결제 정보가 주문 정보와 일치하지 않습니다.',
      );
    }

    let validationError: BadRequestException | null = null;
    if (
      approval.merchantUserKey !== userId ||
      approval.admissionState !== 'SUCCESS' ||
      approval.admissionTypeCode !== '01'
    ) {
      validationError = new BadRequestException(
        '승인된 결제 상태가 주문 정보와 일치하지 않습니다.',
      );
    }
    const approvedAmount = approval.totalPayAmount;
    if (
      typeof approvedAmount !== 'number' ||
      approvedAmount !== order.total ||
      approval.taxScopeAmount !== order.total ||
      approval.taxExScopeAmount !== 0
    ) {
      validationError = new BadRequestException(
        '결제 금액 또는 과세 정보가 주문 정보와 일치하지 않습니다.',
      );
    }
    // 결제창에는 주문 상품 중 하나의 이름을 대표 상품명으로 보냅니다. DB가 주문 상품을
    // 돌려주는 순서는 보장되지 않으므로 "첫 번째 행"이 아니라 주문 상품 전체와 대조합니다.
    const expectedProductNames = new Set(
      order.orderItems.map((item) => naverPayProductName(item.productName)),
    );
    if (
      !approval.productName ||
      !expectedProductNames.has(approval.productName)
    ) {
      validationError = new BadRequestException(
        '결제 상품 정보가 주문 정보와 일치하지 않습니다.',
      );
    }
    if (validationError) {
      let outcome: 'cancelled' | 'confirmed';
      try {
        outcome = await this.cancelApprovedPaymentUnlessConfirmed({
          orderId: order.id,
          paymentId,
          payHistId: approval.payHistId ?? null,
          amount:
            typeof approvedAmount === 'number' && approvedAmount > 0
              ? approvedAmount
              : order.total,
          reason: '가맹점 결제 검증 실패로 자동 취소합니다.',
          idempotencyKey: `validation-${order.id}`,
        });
      } catch (cancelError) {
        // 결제번호와 취소 결정은 이미 주문에 기록되어 있어 운영자가 바로 대사할 수 있습니다.
        this.logger.error(
          `결제 검증 실패 후 자동취소 실패: order=${order.orderNumber}, paymentId=${paymentId}`,
          cancelError instanceof Error ? cancelError.stack : undefined,
        );
        throw new InternalServerErrorException(
          `결제 정보 확인이 필요합니다. 주문번호 ${order.orderNumber}로 고객센터에 문의해 주세요.`,
        );
      }
      if (outcome === 'confirmed') {
        return { orderNumber: order.orderNumber, status: 'paid' };
      }
      throw validationError;
    }

    let finalized = false;
    try {
      // 원격 승인은 성공했지만 로컬 확정이 실패할 경우에도 결제번호를 남겨
      // 자동 취소 실패 시 운영자가 즉시 대사할 수 있게 한다.
      await this.db
        .update(schema.orders)
        .set({
          naverPaymentId: paymentId,
          naverPayHistId: approval.payHistId ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.orders.id, order.id),
            eq(schema.orders.status, 'pending'),
            isNull(schema.orders.cancelRequestedAt),
          ),
        );

      await this.db.transaction(async (tx) => {
        const [updatedOrder] = await tx
          .update(schema.orders)
          .set({
            status: 'paid',
            naverPaymentId: paymentId,
            naverPayHistId: approval.payHistId ?? null,
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.orders.id, order.id),
              eq(schema.orders.status, 'pending'),
              // 겹쳐 들어온 다른 요청이 이미 결제 취소를 결정했다면 확정하지 않습니다.
              isNull(schema.orders.cancelRequestedAt),
            ),
          )
          .returning();

        if (!updatedOrder) {
          const current = await tx.query.orders.findFirst({
            where: eq(schema.orders.id, order.id),
            columns: { status: true },
          });
          if (current?.status === 'paid') return;
          throw new BadRequestException(
            '주문 상태가 변경되어 확정할 수 없습니다.',
          );
        }
        finalized = true;

        if (order.couponId) {
          const couponClaimedAt = new Date();
          const [claimedCoupon] = await tx
            .update(schema.coupons)
            .set({ usedCount: sql`${schema.coupons.usedCount} + 1` })
            .where(
              and(
                eq(schema.coupons.id, order.couponId),
                eq(schema.coupons.isActive, true),
                lte(schema.coupons.validFrom, couponClaimedAt),
                gte(schema.coupons.validUntil, couponClaimedAt),
                or(
                  isNull(schema.coupons.usageLimit),
                  lt(schema.coupons.usedCount, schema.coupons.usageLimit),
                ),
              ),
            )
            .returning({ id: schema.coupons.id });
          if (!claimedCoupon) {
            throw new BadRequestException(
              '쿠폰을 더 이상 사용할 수 없습니다. (사용 기간 만료, 사용 중지 또는 사용 한도 초과)',
            );
          }

          // 회원별 1회 사용을 보장한다. 위의 coupons 행 UPDATE가 같은 쿠폰의 확정
          // 처리를 직렬화하므로, 아래 조회는 먼저 끝난 결제의 사용 기록을 볼 수 있다.
          const myCoupons = await tx.query.userCoupons.findMany({
            where: and(
              eq(schema.userCoupons.userId, userId),
              eq(schema.userCoupons.couponId, order.couponId),
            ),
            columns: { id: true, usedAt: true },
            orderBy: [asc(schema.userCoupons.createdAt)],
          });
          // 재지급 등으로 여러 장이 있으면 아직 쓰지 않은 쿠폰을 사용한다.
          const unusedCoupon = myCoupons.find((item) => item.usedAt == null);
          if (unusedCoupon) {
            const [claimedUserCoupon] = await tx
              .update(schema.userCoupons)
              .set({ usedAt: couponClaimedAt, orderId: updatedOrder.id })
              .where(
                and(
                  eq(schema.userCoupons.id, unusedCoupon.id),
                  isNull(schema.userCoupons.usedAt),
                ),
              )
              .returning({ id: schema.userCoupons.id });
            if (!claimedUserCoupon) {
              throw new BadRequestException('이미 사용한 쿠폰입니다.');
            }
          } else if (myCoupons.length > 0) {
            throw new BadRequestException('이미 사용한 쿠폰입니다.');
          } else {
            // 지급받지 않고 코드를 직접 입력한 공용 쿠폰도 사용 기록을 남겨
            // 같은 회원이 반복해서 쓰지 못하게 한다.
            await tx.insert(schema.userCoupons).values({
              userId,
              couponId: order.couponId,
              usedAt: couponClaimedAt,
              orderId: updatedOrder.id,
            });
          }
        }

        // 결제 승인 직후 조건부 UPDATE로 재고를 차감해 동시 초과판매를 막는다.
        // (여러 결제·취소가 겹쳐도 교착되지 않도록 항상 상품 ID 순으로 잠급니다.)
        for (const oi of sortByProductId(order.orderItems)) {
          const baseCond = and(
            eq(schema.cartItems.userId, userId),
            eq(schema.cartItems.productId, oi.productId),
            oi.productOptionId == null
              ? isNull(schema.cartItems.optionId)
              : eq(schema.cartItems.optionId, oi.productOptionId),
          );
          const [updatedProduct] = await tx
            .update(schema.products)
            .set({
              stockQuantity: sql`${schema.products.stockQuantity} - ${oi.quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.products.id, oi.productId),
                eq(schema.products.isActive, true),
                gte(schema.products.stockQuantity, oi.quantity),
              ),
            )
            .returning({ id: schema.products.id });

          if (!updatedProduct) {
            const current = await tx.query.products.findFirst({
              where: eq(schema.products.id, oi.productId),
              columns: { isActive: true },
            });
            throw new BadRequestException(
              current?.isActive
                ? '재고가 부족합니다.'
                : `판매가 중지된 상품이 포함되어 있습니다: ${oi.productName}`,
            );
          }

          await tx
            .delete(schema.cartItems)
            .where(and(baseCond, lte(schema.cartItems.quantity, oi.quantity)));
          await tx
            .update(schema.cartItems)
            .set({
              quantity: sql`${schema.cartItems.quantity} - ${oi.quantity}`,
            })
            .where(and(baseCond, gt(schema.cartItems.quantity, oi.quantity)));
        }
      });
    } catch (finalizeError) {
      // 재고 부족처럼 안내가 필요한 사유 외의 내부 오류는 운영 로그에만 남깁니다.
      const isBusinessError = finalizeError instanceof HttpException;
      if (!isBusinessError) {
        this.logger.error(
          `결제 승인 후 주문 확정 실패: order=${order.orderNumber}, paymentId=${paymentId}`,
          finalizeError instanceof Error ? finalizeError.stack : undefined,
        );
      }

      let outcome: 'cancelled' | 'confirmed';
      try {
        outcome = await this.cancelApprovedPaymentUnlessConfirmed({
          orderId: order.id,
          paymentId,
          payHistId: approval.payHistId ?? null,
          amount: order.total,
          reason: '가맹점 주문 확정 실패로 자동 취소합니다.',
          idempotencyKey: `rollback-${order.id}`,
        });
      } catch (cancelError) {
        this.logger.error(
          `결제 승인 후 주문 확정/자동취소 모두 실패: order=${order.orderNumber}, paymentId=${paymentId}`,
          cancelError instanceof Error ? cancelError.stack : undefined,
        );
        throw new InternalServerErrorException(
          `결제 처리 확인이 필요합니다. 주문번호 ${order.orderNumber}로 고객센터에 문의해 주세요.`,
        );
      }

      if (outcome === 'confirmed') {
        // 겹쳐 들어온 같은 결제의 다른 승인 요청이 이미 주문을 확정했습니다.
        return { orderNumber: order.orderNumber, status: 'paid' };
      }

      // DB 오류 문구(쿼리·파라미터)가 고객 화면에 노출되지 않도록 업무 오류만 사유로 덧붙입니다.
      const reason = isBusinessError ? ` ${finalizeError.message}` : '';
      throw new BadRequestException(
        `주문을 확정하지 못해 결제를 자동 취소했습니다.${reason}`,
      );
    }

    if (finalized) {
      const paidOrder = await this.db.query.orders.findFirst({
        where: eq(schema.orders.id, order.id),
        columns: {
          orderNumber: true,
          total: true,
        },
        with: {
          user: {
            columns: {
              email: true,
              fullName: true,
            },
          },
          orderItems: {
            columns: {
              productName: true,
              optionLabel: true,
              quantity: true,
              lineTotal: true,
            },
          },
        },
      });

      if (paidOrder?.user?.email) {
        // 결제는 이미 확정됐으므로 메일 지연·실패가 결제 결과 응답을 막지 않게 합니다.
        void this.emailService.sendOrderPaidEmail({
          to: paidOrder.user.email,
          name: paidOrder.user.fullName,
          orderNumber: paidOrder.orderNumber,
          total: paidOrder.total,
          items: paidOrder.orderItems,
        });
      }
    }

    return { orderNumber: order.orderNumber, status: 'paid' };
  }

  /**
   * [Admin] 상품 삭제.
   * 주문 이력이 있는 상품은 주문 내역(상품명·이미지·옵션)을 보존해야 하므로 행을 지우지 않고
   * 쇼핑몰과 관리자 목록에서 숨김 처리합니다. 주문 이력이 없으면 완전히 삭제합니다.
   */
  async deleteProduct(id: string) {
    const product = await this.db.query.products.findFirst({
      where: eq(schema.products.id, id),
      columns: { id: true, slug: true },
      with: {
        images: { columns: { url: true } },
        detailImages: { columns: { url: true } },
      },
    });
    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    const orderedItem = await this.db.query.orderItems.findFirst({
      where: eq(schema.orderItems.productId, id),
      columns: { id: true },
    });

    if (orderedItem) {
      return this.db.transaction(async (tx) => {
        // 결제 확정·주문 취소와 같은 순서(상품 → 장바구니·재입고 신청)로 잠가 교착을 피합니다.
        await tx
          .select({ id: schema.products.id })
          .from(schema.products)
          .where(eq(schema.products.id, id))
          .for('update');
        await tx
          .delete(schema.cartItems)
          .where(eq(schema.cartItems.productId, id));
        await tx
          .delete(schema.productRestockSubscriptions)
          .where(eq(schema.productRestockSubscriptions.productId, id));

        const [hidden] = await tx
          .update(schema.products)
          .set({
            isActive: false,
            // 같은 slug로 새 상품을 다시 등록할 수 있게 비워 주고,
            // 숨긴 상품이 카테고리 삭제를 막지 않도록 연결을 끊습니다.
            slug: `${product.slug}--deleted-${Date.now().toString(36)}`,
            categoryId: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.products.id, id))
          .returning();
        if (!hidden) {
          throw new NotFoundException('상품을 찾을 수 없습니다.');
        }
        return hidden;
      });
    }

    const reviewImages = await this.db
      .select({ url: schema.productReviewImages.url })
      .from(schema.productReviewImages)
      .innerJoin(
        schema.productReviews,
        eq(schema.productReviewImages.reviewId, schema.productReviews.id),
      )
      .where(eq(schema.productReviews.productId, id));

    const deleted = await this.db.transaction(async (tx) => {
      // 결제 확정·주문 취소와 같은 순서(상품 → 장바구니·재입고 신청)로 잠가 교착을 피합니다.
      await tx
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(eq(schema.products.id, id))
        .for('update');
      // 연관 데이터 삭제. 장바구니가 옵션을 참조하므로 옵션보다 먼저 지웁니다.
      await tx
        .delete(schema.cartItems)
        .where(eq(schema.cartItems.productId, id));
      await tx
        .delete(schema.productQa)
        .where(eq(schema.productQa.productId, id));
      await tx
        .delete(schema.productRestockSubscriptions)
        .where(eq(schema.productRestockSubscriptions.productId, id));
      await tx
        .delete(schema.productImages)
        .where(eq(schema.productImages.productId, id));
      await tx
        .delete(schema.productDetailImages)
        .where(eq(schema.productDetailImages.productId, id));
      await tx
        .delete(schema.productOptions)
        .where(eq(schema.productOptions.productId, id));

      // 구매평과 구매평 이미지는 FK(ON DELETE CASCADE)로 함께 삭제됩니다.
      const [deleted] = await tx
        .delete(schema.products)
        .where(eq(schema.products.id, id))
        .returning();

      if (!deleted) {
        throw new NotFoundException('상품을 찾을 수 없습니다.');
      }
      return deleted;
    });

    await this.mediaCleanupService.removeUnreferenced(
      [
        ...product.images.map((image) => image.url),
        ...product.detailImages.map((image) => image.url),
      ],
      'product',
    );
    await this.mediaCleanupService.removeUnreferenced(
      reviewImages.map((image) => image.url),
      'review',
    );

    return deleted;
  }

  /**
   * 승인된 결제를 되돌리고 주문을 취소 처리합니다.
   *
   * 취소 결정을 먼저 주문에 기록(커밋)한 뒤 네이버페이에 취소를 요청합니다.
   * - 겹쳐 들어온 다른 승인 요청이 이미 확정한 주문(paid)이면 결제를 되돌리지 않고 'confirmed'를 돌려줍니다.
   * - 결정이 기록된 뒤에는 어떤 요청도 이 주문을 결제 완료로 확정할 수 없으므로,
   *   취소 요청이 실패하거나 결과를 알 수 없어도 "환불됐는데 결제 완료"인 주문이 생기지 않습니다.
   * - DB 연결이나 행 잠금을 잡은 채 외부 호출을 기다리지 않습니다.
   */
  private async cancelApprovedPaymentUnlessConfirmed(params: {
    orderId: string;
    paymentId: string;
    payHistId: string | null;
    amount: number;
    reason: string;
    idempotencyKey: string;
  }): Promise<'cancelled' | 'confirmed'> {
    const [decided] = await this.db
      .update(schema.orders)
      .set({
        cancelRequestedAt: sql`COALESCE(${schema.orders.cancelRequestedAt}, now())`,
        naverPaymentId: params.paymentId,
        naverPayHistId: params.payHistId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.orders.id, params.orderId),
          eq(schema.orders.status, 'pending'),
        ),
      )
      .returning({ id: schema.orders.id });

    if (!decided) {
      const current = await this.db.query.orders.findFirst({
        where: eq(schema.orders.id, params.orderId),
        columns: { status: true },
      });
      if (current?.status === 'cancelled') return 'cancelled';
      if (current) return 'confirmed';
      // 주문 초안이 정리되어 행이 없는 경우: 승인된 결제만 되돌립니다.
    }

    await this.naverPayClient.cancelPayment({
      paymentId: params.paymentId,
      amount: params.amount,
      reason: params.reason,
      requester: '2',
      idempotencyKey: params.idempotencyKey,
    });

    await this.db
      .update(schema.orders)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.orders.id, params.orderId),
          eq(schema.orders.status, 'pending'),
        ),
      );
    return 'cancelled';
  }

  private async assertCategoryExists(categoryId: string) {
    const category = await this.db.query.productCategories.findFirst({
      where: eq(schema.productCategories.id, categoryId),
      columns: { id: true },
    });
    if (!category) {
      throw new BadRequestException('카테고리를 찾을 수 없습니다.');
    }
  }

  private async assertProductSlugAvailable(slug: string, exceptId?: string) {
    const existing = await this.db.query.products.findFirst({
      where: exceptId
        ? and(eq(schema.products.slug, slug), ne(schema.products.id, exceptId))
        : eq(schema.products.slug, slug),
      columns: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        '이미 사용 중인 slug입니다. 다른 slug를 입력해 주세요.',
      );
    }
  }

  /**
   * 다시 구매할 수 있게 된 상품의 재입고 알림 신청을 꺼내(삭제하고) 발송 대상을 돌려줍니다.
   * 숨김 처리되었거나 여전히 품절인 상품의 신청은 그대로 둡니다.
   */
  private async takeRestockMailTargets(
    tx: Tx,
    productIds: string[],
  ): Promise<RestockMailTarget[]> {
    if (productIds.length === 0) return [];

    const subscriptions = await tx.query.productRestockSubscriptions.findMany({
      where: inArray(schema.productRestockSubscriptions.productId, productIds),
      with: {
        user: {
          columns: {
            email: true,
            fullName: true,
          },
        },
        product: {
          columns: {
            name: true,
            slug: true,
            isActive: true,
            stockQuantity: true,
          },
        },
      },
    });
    const ready = subscriptions.filter(
      (item) => item.product?.isActive && item.product.stockQuantity > 0,
    );
    if (ready.length === 0) return [];

    await tx.delete(schema.productRestockSubscriptions).where(
      inArray(
        schema.productRestockSubscriptions.id,
        ready.map((item) => item.id),
      ),
    );

    return ready
      .filter((item) => !!item.user?.email)
      .map((item) => ({
        email: item.user.email,
        name: item.user.fullName,
        productName: item.product.name,
        productSlug: item.product.slug,
      }));
  }

  /** 신청자가 많아도 요청 응답을 붙잡지 않도록 백그라운드에서 순차 발송합니다. */
  private sendRestockMails(targets: RestockMailTarget[]) {
    if (targets.length === 0) return;
    void (async () => {
      for (const [index, target] of targets.entries()) {
        if (index > 0) await sleep(RESTOCK_MAIL_INTERVAL_MS);
        try {
          await this.emailService.sendProductRestockedEmail({
            to: target.email,
            name: target.name,
            productName: target.productName,
            productSlug: target.productSlug,
          });
        } catch (error) {
          this.logger.error(
            `재입고 알림 발송 실패: product=${target.productSlug}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    })();
  }
}
