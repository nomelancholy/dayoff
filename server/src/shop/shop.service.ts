import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
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
import { NaverPayClient } from './naver-pay.client';
import { SpacesStorageService } from './spaces-storage.service';

const PRODUCT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NAVER_PAY_PRODUCT_NAME_MAX_LENGTH = 128;

function naverPayProductName(value: string) {
  return Array.from(value).slice(0, NAVER_PAY_PRODUCT_NAME_MAX_LENGTH).join('');
}

function discountedPrice(originalPrice: number, discountRate: number) {
  return Math.floor((originalPrice * (100 - discountRate)) / 100);
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

    return this.db.query.orders.findMany({
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
  }

  /** [Admin] 송장번호 입력 후 발송 완료 처리 */
  async updateAdminOrderShipment(orderId: string, trackingNumber: string) {
    const order = await this.db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      columns: { id: true, status: true },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    if (order.status === 'pending' || order.status === 'cancelled') {
      throw new BadRequestException(
        '발송 처리는 결제 완료된 주문부터 가능합니다.',
      );
    }

    const shouldSendShippedMail = order.status !== 'shipped';

    const [updated] = await this.db
      .update(schema.orders)
      .set({
        status: 'shipped',
        trackingNumber,
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId))
      .returning();

    if (updated && shouldSendShippedMail) {
      const shippedOrder = await this.db.query.orders.findFirst({
        where: eq(schema.orders.id, updated.id),
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
        await this.emailService.sendOrderShippedEmail({
          to: shippedOrder.user.email,
          name: shippedOrder.user.fullName,
          orderNumber: shippedOrder.orderNumber,
          trackingNumber: shippedOrder.trackingNumber,
          items: shippedOrder.orderItems,
        });
      }
    }

    return updated;
  }

  /** [Admin] pending 주문(초안) 전부 삭제 */
  async deleteAdminPendingOrders() {
    return this.db.transaction(async (tx) => {
      const pendingOrders = await tx.query.orders.findMany({
        where: eq(schema.orders.status, 'pending'),
        columns: { id: true },
      });
      if (pendingOrders.length === 0) {
        return { deletedOrders: 0 };
      }

      const pendingIds = pendingOrders.map((o) => o.id);

      await tx.delete(schema.orderItems).where(
        // order_items.order_id IN (pendingIds)
        // Drizzle supports inArray with a list of UUIDs.
        inArray(schema.orderItems.orderId, pendingIds),
      );
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
        name: data.name.trim(),
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();
    return created;
  }

  /** [Admin] 카테고리 수정 */
  async updateCategory(
    id: string,
    data: { slug?: string; name?: string; sortOrder?: number },
  ) {
    const category = await this.db.query.productCategories.findFirst({
      where: eq(schema.productCategories.id, id),
    });
    if (!category) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }

    if (data.slug !== undefined) {
      const normalizedSlug = data.slug.trim();
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
        ...(data.slug !== undefined && { slug: data.slug.trim() }),
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
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

  /** 상품 상세 조회 (slug 또는 id, 상세 이미지/구매평 포함) */
  async getProduct(slugOrId: string) {
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const byId = uuidV4Regex.test(slugOrId);
    const product = await this.db.query.products.findFirst({
      where: byId
        ? eq(schema.products.id, slugOrId)
        : eq(schema.products.slug, slugOrId),
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

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

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
      columns: { id: true, stockQuantity: true },
    });
    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }
    if (product.stockQuantity > 0) {
      throw new BadRequestException('현재 구매 가능한 상품입니다.');
    }

    const existing = await this.db.query.productRestockSubscriptions.findFirst({
      where: and(
        eq(schema.productRestockSubscriptions.userId, userId),
        eq(schema.productRestockSubscriptions.productId, productId),
      ),
      columns: { id: true },
    });
    if (existing) {
      return { subscribed: true };
    }

    await this.db.insert(schema.productRestockSubscriptions).values({
      userId,
      productId,
    });
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

    // 상품에 옵션이 존재한다면, optionId를 반드시 선택해야 장바구니에 담을 수 있게 방어
    const productHasOptions = await this.db.query.productOptions.findMany({
      where: eq(schema.productOptions.productId, productId),
      columns: { id: true },
      limit: 1,
    });

    if (productHasOptions.length > 0) {
      if (!optionId) {
        throw new BadRequestException('옵션을 선택해 주세요.');
      }

      // 선택된 optionId가 해당 상품의 옵션인지 검증
      const optionBelongs = await this.db.query.productOptions.findFirst({
        where: and(
          eq(schema.productOptions.id, optionId),
          eq(schema.productOptions.productId, productId),
        ),
      });

      if (!optionBelongs) {
        throw new BadRequestException('잘못된 옵션입니다.');
      }
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
      // 수량 업데이트
      const [updated] = await this.db
        .update(schema.cartItems)
        .set({
          quantity: existing.quantity + quantity,
          updatedAt: new Date(),
        })
        .where(eq(schema.cartItems.id, existing.id))
        .returning();
      return updated;
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
  async createProduct(data: any) {
    const { images, options, detailImages, ...productData } = data;
    const name = String(productData.name ?? '').trim();
    const slug = String(productData.slug ?? '').trim();
    const submittedPrice = Number(productData.price);
    const discountRate = Number(productData.discountRate ?? 0);
    const originalPrice = Number(
      productData.originalPrice ?? productData.price,
    );
    const stockQuantity = Number(productData.stockQuantity ?? 999);

    if (!name || !slug) {
      throw new BadRequestException('상품명과 slug는 필수입니다.');
    }
    if (!PRODUCT_SLUG_PATTERN.test(slug)) {
      throw new BadRequestException(
        'slug는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.',
      );
    }
    if (!Number.isFinite(submittedPrice) || submittedPrice < 0) {
      throw new BadRequestException('가격은 0 이상이어야 합니다.');
    }
    if (
      !Number.isFinite(discountRate) ||
      discountRate < 0 ||
      discountRate > 100
    ) {
      throw new BadRequestException('할인율은 0~100 사이여야 합니다.');
    }
    if (!Number.isFinite(originalPrice) || originalPrice < 0) {
      throw new BadRequestException('정상가는 0 이상이어야 합니다.');
    }
    if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
      throw new BadRequestException('재고 수량은 0 이상이어야 합니다.');
    }

    return await this.db.transaction(async (tx) => {
      const [product] = await tx
        .insert(schema.products)
        .values({
          ...productData,
          name,
          slug,
          price:
            discountRate > 0
              ? discountedPrice(
                  Math.floor(originalPrice),
                  Math.floor(discountRate),
                )
              : Math.floor(submittedPrice),
          originalPrice: discountRate > 0 ? Math.floor(originalPrice) : null,
          discountRate: Math.floor(discountRate),
          stockQuantity: Math.floor(stockQuantity),
        })
        .returning();

      if (images && images.length > 0) {
        await tx.insert(schema.productImages).values(
          images.map((img: any) => ({
            ...img,
            productId: product.id,
          })),
        );
      }

      if (options && options.length > 0) {
        await tx.insert(schema.productOptions).values(
          options.map((opt: any) => ({
            ...opt,
            productId: product.id,
          })),
        );
      }

      if (detailImages && detailImages.length > 0) {
        await tx.insert(schema.productDetailImages).values(
          detailImages.map((img: any) => ({
            url: img.url,
            alt: img.alt ?? null,
            sortOrder: img.sortOrder ?? 0,
            productId: product.id,
          })),
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
  async updateProduct(id: string, data: any) {
    const { images, options, detailImages, ...productData } = data;
    const normalizedData = { ...productData };

    if ('name' in normalizedData) {
      const name = String(normalizedData.name ?? '').trim();
      if (!name) {
        throw new BadRequestException('상품명은 비워둘 수 없습니다.');
      }
      normalizedData.name = name;
    }

    if ('slug' in normalizedData) {
      const slug = String(normalizedData.slug ?? '').trim();
      if (!slug) {
        throw new BadRequestException('slug는 비워둘 수 없습니다.');
      }
      if (!PRODUCT_SLUG_PATTERN.test(slug)) {
        throw new BadRequestException(
          'slug는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.',
        );
      }
      normalizedData.slug = slug;
    }

    if ('price' in normalizedData) {
      const price = Number(normalizedData.price);
      if (!Number.isFinite(price) || price < 0) {
        throw new BadRequestException('가격은 0 이상이어야 합니다.');
      }
      normalizedData.price = Math.floor(price);
    }

    if (
      'originalPrice' in normalizedData &&
      normalizedData.originalPrice != null
    ) {
      const originalPrice = Number(normalizedData.originalPrice);
      if (!Number.isFinite(originalPrice) || originalPrice < 0) {
        throw new BadRequestException('정상가는 0 이상이어야 합니다.');
      }
      normalizedData.originalPrice = Math.floor(originalPrice);
    }

    if ('discountRate' in normalizedData) {
      const discountRate = Number(normalizedData.discountRate);
      if (
        !Number.isFinite(discountRate) ||
        discountRate < 0 ||
        discountRate > 100
      ) {
        throw new BadRequestException('할인율은 0~100 사이여야 합니다.');
      }
      normalizedData.discountRate = Math.floor(discountRate);
    }

    if ('stockQuantity' in normalizedData) {
      const stockQuantity = Number(normalizedData.stockQuantity);
      if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
        throw new BadRequestException('재고 수량은 0 이상이어야 합니다.');
      }
      normalizedData.stockQuantity = Math.floor(stockQuantity);
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
        'price' in normalizedData ||
        'originalPrice' in normalizedData ||
        'discountRate' in normalizedData;
      if (pricingTouched) {
        const nextDiscountRate = Number(
          normalizedData.discountRate ?? before.discountRate,
        );
        if (nextDiscountRate > 0) {
          const nextOriginalPrice = Number(
            normalizedData.originalPrice ??
              before.originalPrice ??
              normalizedData.price ??
              before.price,
          );
          normalizedData.originalPrice = Math.floor(nextOriginalPrice);
          normalizedData.discountRate = Math.floor(nextDiscountRate);
          normalizedData.price = discountedPrice(
            normalizedData.originalPrice,
            normalizedData.discountRate,
          );
        } else {
          normalizedData.discountRate = 0;
          normalizedData.originalPrice = null;
          if (!('price' in normalizedData)) {
            normalizedData.price = before.price;
          }
        }
      }

      if (Object.keys(normalizedData).length > 0) {
        await tx
          .update(schema.products)
          .set({ ...normalizedData, updatedAt: new Date() })
          .where(eq(schema.products.id, id));
      }

      if (images) {
        await tx
          .delete(schema.productImages)
          .where(eq(schema.productImages.productId, id));
        if (images.length > 0) {
          await tx.insert(schema.productImages).values(
            images.map((img: any) => ({
              ...img,
              productId: id,
            })),
          );
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

        for (const [index, option] of options.entries()) {
          const name = String(option.name ?? '').trim();
          const value = String(option.value ?? '').trim();
          const sortOrder = Number.isFinite(Number(option.sortOrder))
            ? Math.floor(Number(option.sortOrder))
            : index + 1;

          if (!name || !value) {
            throw new BadRequestException(
              '상품 옵션의 이름과 값은 비워둘 수 없습니다.',
            );
          }

          let existingOption: (typeof existingOptions)[number] | undefined;

          if (option.id) {
            existingOption = existingById.get(String(option.id));
            if (!existingOption) {
              throw new BadRequestException(
                '다른 상품에 속하거나 존재하지 않는 옵션입니다.',
              );
            }
          } else {
            // 이전 프론트엔드가 ID 없이 요청해도 동일 옵션 또는 같은 위치의 옵션을
            // 재사용해 기존 장바구니/주문 참조를 끊지 않습니다.
            existingOption =
              existingOptions.find(
                (candidate) =>
                  !retainedOptionIds.has(candidate.id) &&
                  candidate.name === name &&
                  candidate.value === value,
              ) ??
              existingOptions.find(
                (candidate) =>
                  !retainedOptionIds.has(candidate.id) &&
                  candidate.sortOrder === sortOrder,
              ) ??
              existingOptions.find(
                (candidate) => !retainedOptionIds.has(candidate.id),
              );
          }

          if (
            existingOption &&
            option.id &&
            retainedOptionIds.has(existingOption.id)
          ) {
            throw new BadRequestException(
              '동일한 상품 옵션이 요청에 중복되어 있습니다.',
            );
          }

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
        if (detailImages && detailImages.length > 0) {
          await tx.insert(schema.productDetailImages).values(
            detailImages.map((img: any) => ({
              url: img.url,
              alt: img.alt ?? null,
              sortOrder: img.sortOrder ?? 0,
              productId: id,
            })),
          );
        }
      }
      const after = await tx.query.products.findFirst({
        where: eq(schema.products.id, id),
        columns: {
          id: true,
          name: true,
          slug: true,
          stockQuantity: true,
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
          ? images.map((image: { url?: unknown }) => String(image.url))
          : before.images.map((image) => image.url)),
        ...(detailImages !== undefined
          ? detailImages.map((image: { url?: unknown }) => String(image.url))
          : before.detailImages.map((image) => image.url)),
      ]);
      const removedImageUrls = previousImageUrls.filter(
        (url) => !retainedImageUrls.has(url),
      );

      let restockMailTargets: Array<{
        email: string;
        name: string | null;
        productName: string;
        productSlug: string;
      }> = [];

      const becameInStock =
        before.stockQuantity <= 0 && after.stockQuantity > 0;
      if (becameInStock) {
        const subscriptions =
          await tx.query.productRestockSubscriptions.findMany({
            where: eq(schema.productRestockSubscriptions.productId, id),
            with: {
              user: {
                columns: {
                  email: true,
                  fullName: true,
                },
              },
            },
          });

        await tx
          .delete(schema.productRestockSubscriptions)
          .where(eq(schema.productRestockSubscriptions.productId, id));

        restockMailTargets = subscriptions
          .filter((item) => !!item.user?.email)
          .map((item) => ({
            email: item.user.email,
            name: item.user.fullName,
            productName: after.name,
            productSlug: after.slug,
          }));
      }

      return { restockMailTargets, removedImageUrls };
    });
    const { restockMailTargets, removedImageUrls } = updateResult;

    await this.spacesStorageService.deleteStoredUrls(removedImageUrls);

    if (restockMailTargets.length > 0) {
      for (const target of restockMailTargets) {
        await this.emailService.sendProductRestockedEmail({
          to: target.email,
          name: target.name,
          productName: target.productName,
          productSlug: target.productSlug,
        });
      }
    }

    return this.getProduct(id);
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
    data: { body: string; rating?: number; imageUrls?: string[] },
  ) {
    const existing = await this.db.query.productReviews.findFirst({
      where: eq(schema.productReviews.id, reviewId),
      with: {
        product: {
          columns: { id: true, name: true, slug: true },
        },
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

    const updated = await this.db.transaction(async (tx) => {
      await tx
        .update(schema.productReviews)
        .set({
          body: data.body,
          rating: data.rating ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.productReviews.id, reviewId));

      if (data.imageUrls !== undefined) {
        await tx
          .delete(schema.productReviewImages)
          .where(eq(schema.productReviewImages.reviewId, reviewId));

        if (data.imageUrls.length > 0) {
          await tx.insert(schema.productReviewImages).values(
            data.imageUrls.map((url, i) => ({
              reviewId,
              url,
              sortOrder: i + 1,
            })),
          );
        }
      }

      return tx.query.productReviews.findFirst({
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
    });

    if (data.imageUrls !== undefined) {
      const retained = new Set(data.imageUrls);
      await this.spacesStorageService.deleteStoredUrls(
        existing.images
          .map((image) => image.url)
          .filter((url) => !retained.has(url)),
      );
    }

    return updated;
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

    await this.spacesStorageService.deleteStoredUrls(
      existing.images.map((image) => image.url),
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
    data: { body: string; rating?: number; imageUrls?: string[] },
  ) {
    const existing = await this.db.query.productReviews.findFirst({
      where: eq(schema.productReviews.id, reviewId),
      columns: { id: true },
      with: { images: { columns: { url: true } } },
    });

    if (!existing) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다.');
    }

    const updated = await this.db.transaction(async (tx) => {
      await tx
        .update(schema.productReviews)
        .set({
          body: data.body,
          rating: data.rating ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.productReviews.id, reviewId));

      if (data.imageUrls !== undefined) {
        await tx
          .delete(schema.productReviewImages)
          .where(eq(schema.productReviewImages.reviewId, reviewId));

        if (data.imageUrls.length > 0) {
          await tx.insert(schema.productReviewImages).values(
            data.imageUrls.map((url, i) => ({
              reviewId,
              url,
              sortOrder: i + 1,
            })),
          );
        }
      }

      return tx.query.productReviews.findFirst({
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
    });

    if (data.imageUrls !== undefined) {
      const retained = new Set(data.imageUrls);
      await this.spacesStorageService.deleteStoredUrls(
        existing.images
          .map((image) => image.url)
          .filter((url) => !retained.has(url)),
      );
    }

    return updated;
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

    await this.spacesStorageService.deleteStoredUrls(
      existing.images.map((image) => image.url),
    );

    return { id: reviewId };
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

  /** 내 결제 취소 (발송 전 paid 주문만 가능) */
  async cancelMyPaidOrder(userId: string, orderId: string) {
    const order = await this.db.query.orders.findFirst({
      where: and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.userId, userId),
      ),
      columns: {
        id: true,
        orderNumber: true,
        status: true,
        couponId: true,
        total: true,
        naverPaymentId: true,
        createdAt: true,
      },
      with: {
        orderItems: {
          columns: {
            productId: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }
    if (order.status === 'cancelled') {
      return { orderNumber: order.orderNumber, status: 'cancelled' as const };
    }
    if (order.status !== 'paid') {
      throw new BadRequestException(
        '발송 전 결제 완료 주문만 취소할 수 있습니다.',
      );
    }

    const paymentId =
      order.naverPaymentId ??
      (await this.naverPayClient.findPaymentIdByMerchantPayKey(
        order.orderNumber,
        order.createdAt,
      ));
    if (!paymentId) {
      throw new BadRequestException(
        '네이버페이 결제번호를 찾을 수 없습니다. 관리자에게 문의해 주세요.',
      );
    }

    await this.naverPayClient.cancelPayment({
      paymentId,
      amount: order.total,
      reason: '고객 요청으로 결제를 취소했습니다.',
      requester: '1',
      idempotencyKey: `cancel-${order.id}`,
    });

    await this.db.transaction(async (tx) => {
      const [updatedOrder] = await tx
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

      // 동시 요청으로 이미 취소된 경우
      if (!updatedOrder) return;

      // 재고 원복
      for (const oi of order.orderItems) {
        await tx
          .update(schema.products)
          .set({
            stockQuantity: sql`${schema.products.stockQuantity} + ${oi.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(schema.products.id, oi.productId));
      }

      // 쿠폰 사용 롤백
      if (order.couponId) {
        await tx
          .update(schema.coupons)
          .set({ usedCount: sql`GREATEST(${schema.coupons.usedCount} - 1, 0)` })
          .where(eq(schema.coupons.id, order.couponId));

        await tx
          .update(schema.userCoupons)
          .set({ usedAt: null, orderId: null })
          .where(
            and(
              eq(schema.userCoupons.userId, userId),
              eq(schema.userCoupons.couponId, order.couponId),
              eq(schema.userCoupons.orderId, order.id),
            ),
          );
      }
    });

    return { orderNumber: order.orderNumber, status: 'cancelled' as const };
  }

  /** 구매평 작성 (로그인 사용자) */
  async createReview(
    userId: string,
    productId: string,
    data: {
      body: string;
      rating?: number;
      imageUrls?: string[];
      orderItemId: string;
    },
  ) {
    const product = await this.db.query.products.findFirst({
      where: eq(schema.products.id, productId),
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

    // 리뷰는 발송 완료(shipped)된 주문부터 작성 가능하도록 방어
    if (orderItem.order.status !== 'shipped') {
      throw new BadRequestException('아직 리뷰를 작성할 수 없습니다.');
    }

    return await this.db.transaction(async (tx) => {
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

      if (data.imageUrls && data.imageUrls.length > 0) {
        await tx.insert(schema.productReviewImages).values(
          data.imageUrls.map((url, i) => ({
            reviewId: review.id,
            url,
            sortOrder: i + 1,
          })),
        );
      }

      return this.db.query.productReviews.findFirst({
        where: eq(schema.productReviews.id, review.id),
        with: {
          user: { columns: { id: true, fullName: true, email: true } },
          images: true,
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
    const ids = cartItemIds ?? [];
    if (ids.length === 0) {
      throw new BadRequestException('선택한 상품이 없습니다.');
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
    if (cartItemQuantities && cartItemQuantities.length !== ids.length) {
      throw new BadRequestException(
        '구매 수량 정보가 상품 정보와 일치하지 않습니다.',
      );
    }

    const quantitiesById = new Map<string, number>();
    if (cartItemQuantities) {
      ids.forEach((id, idx) => {
        quantitiesById.set(id, cartItemQuantities[idx] ?? 0);
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
          },
        },
        option: true,
      },
      orderBy: [desc(schema.cartItems.createdAt)],
    });
    if (!cartItems.length) {
      throw new BadRequestException('장바구니가 비어 있습니다.');
    }

    const purchaseQtyFor = (cartItemId: string, defaultQty: number) => {
      const specified = quantitiesById.get(cartItemId);
      return specified && specified > 0 ? specified : defaultQty;
    };

    // 옵션이 달라도 같은 상품일 수 있으므로,
    // "선택된 장바구니 아이템들에서 필요한 총 수량" 기준으로 재고를 한 번에 검증한다.
    const requiredByProductId = new Map<string, number>();
    const stockByProductId = new Map<string, number>();

    for (const item of cartItems) {
      const purchaseQty = purchaseQtyFor(item.id, item.quantity);
      if (purchaseQty <= 0) continue;

      requiredByProductId.set(
        item.productId,
        (requiredByProductId.get(item.productId) ?? 0) + purchaseQty,
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

    const subtotal = cartItems.reduce((sum, item) => {
      const purchaseQty = purchaseQtyFor(item.id, item.quantity);
      if (purchaseQty <= 0) return sum;
      // 안전장치: 지정 구매 수량이 장바구니 수량보다 클 수 없도록 방어
      if (purchaseQty > item.quantity) {
        throw new BadRequestException(
          '구매 수량이 장바구니 수량을 초과했습니다.',
        );
      }
      return sum + item.product.price * purchaseQty;
    }, 0);
    const isOutOfDelivery = isOutOfDeliveryPostalCode(address.postalCode);
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
      const pendingOrders = await tx.query.orders.findMany({
        where: and(
          eq(schema.orders.userId, userId),
          eq(schema.orders.status, 'pending'),
          isNull(schema.orders.naverPaymentId),
          lt(schema.orders.createdAt, staleBefore),
        ),
        columns: { id: true },
      });

      if (pendingOrders.length > 0) {
        const pendingIds = pendingOrders.map((o) => o.id);
        await tx
          .delete(schema.orderItems)
          .where(inArray(schema.orderItems.orderId, pendingIds));
        await tx
          .delete(schema.orders)
          .where(
            and(
              eq(schema.orders.userId, userId),
              eq(schema.orders.status, 'pending'),
              isNull(schema.orders.naverPaymentId),
              lt(schema.orders.createdAt, staleBefore),
            ),
          );
      }

      const [order] = await tx
        .insert(schema.orders)
        .values({
          userId,
          orderNumber,
          status: 'pending',
          shippingAddressId,
          subtotal,
          shippingFee,
          discountAmount,
          total,
          couponId,
        })
        .returning();

      await tx.insert(schema.orderItems).values(
        cartItems.map((item) => {
          const purchaseQty = purchaseQtyFor(item.id, item.quantity);
          return {
            orderId: order.id,
            productId: item.productId,
            productOptionId: item.optionId ?? null,
            productName: item.product.name,
            optionLabel: item.option
              ? `${item.option.name}: ${item.option.value}`
              : null,
            price: item.product.price,
            quantity: purchaseQty,
            lineTotal: item.product.price * purchaseQty,
          };
        }),
      );
    });

    return {
      ...checkoutConfig,
      merchantUserKey: userId,
      merchantPayKey: orderNumber,
      productName: orderName,
      productCount: cartItems.reduce((sum, item) => {
        const purchaseQty = purchaseQtyFor(item.id, item.quantity);
        return purchaseQty > 0 ? sum + purchaseQty : sum;
      }, 0),
      totalPayAmount: total,
      taxScopeAmount: total,
      taxExScopeAmount: 0,
      returnUrl: `${frontUrl}/checkout/success?merchantPayKey=${encodeURIComponent(orderNumber)}`,
      productItems: cartItems
        .map((item) => {
          const purchaseQty = purchaseQtyFor(item.id, item.quantity);
          if (purchaseQty <= 0) return null;
          return {
            categoryType: 'ETC',
            categoryId: 'ETC',
            uid: item.productId,
            name: naverPayProductName(
              item.option
                ? `${item.product.name} / ${item.option.name}: ${item.option.value}`
                : item.product.name,
            ),
            payReferrer: 'ETC',
            count: purchaseQty,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
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

    if (order.status === 'paid') {
      return { orderNumber: order.orderNumber, status: order.status };
    }
    if (order.status !== 'pending') {
      throw new BadRequestException('승인할 수 없는 주문 상태입니다.');
    }
    if (order.naverPaymentId && order.naverPaymentId !== paymentId) {
      throw new BadRequestException(
        '주문에 이미 다른 네이버페이 결제번호가 연결되어 있습니다.',
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
    const expectedProductName = order.orderItems[0]?.productName
      ? naverPayProductName(order.orderItems[0].productName)
      : null;
    if (!expectedProductName || approval.productName !== expectedProductName) {
      validationError = new BadRequestException(
        '결제 상품 정보가 주문 정보와 일치하지 않습니다.',
      );
    }
    if (validationError) {
      try {
        await this.naverPayClient.cancelPayment({
          paymentId,
          amount:
            typeof approvedAmount === 'number' && approvedAmount > 0
              ? approvedAmount
              : order.total,
          reason: '가맹점 결제 검증 실패로 자동 취소합니다.',
          requester: '2',
          idempotencyKey: `validation-${order.id}`,
        });
        await this.db
          .update(schema.orders)
          .set({
            status: 'cancelled',
            naverPaymentId: paymentId,
            naverPayHistId: approval.payHistId ?? null,
            cancelledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.orders.id, order.id),
              eq(schema.orders.status, 'pending'),
            ),
          );
      } catch (cancelError) {
        await this.db
          .update(schema.orders)
          .set({
            naverPaymentId: paymentId,
            naverPayHistId: approval.payHistId ?? null,
            updatedAt: new Date(),
          })
          .where(eq(schema.orders.id, order.id));
        this.logger.error(
          `결제 검증 실패 후 자동취소 실패: order=${order.orderNumber}, paymentId=${paymentId}`,
          cancelError instanceof Error ? cancelError.stack : undefined,
        );
        throw new InternalServerErrorException(
          `결제 정보 확인이 필요합니다. 주문번호 ${order.orderNumber}로 고객센터에 문의해 주세요.`,
        );
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
            throw new BadRequestException('쿠폰 사용 한도가 초과되었습니다.');
          }

          // 지급형 쿠폰이면 1회 사용을 원자적으로 점유한다. 지급 이력이 없는
          // 공용 코드 쿠폰은 기존 정책대로 전역 usageLimit만 적용한다.
          const issuedCoupon = await tx.query.userCoupons.findFirst({
            where: and(
              eq(schema.userCoupons.userId, userId),
              eq(schema.userCoupons.couponId, order.couponId),
            ),
            columns: { id: true },
          });
          if (issuedCoupon) {
            const [claimedUserCoupon] = await tx
              .update(schema.userCoupons)
              .set({ usedAt: couponClaimedAt, orderId: updatedOrder.id })
              .where(
                and(
                  eq(schema.userCoupons.id, issuedCoupon.id),
                  isNull(schema.userCoupons.usedAt),
                ),
              )
              .returning({ id: schema.userCoupons.id });
            if (!claimedUserCoupon) {
              throw new BadRequestException('이미 사용한 쿠폰입니다.');
            }
          }
        }

        // 결제 승인 직후 조건부 UPDATE로 재고를 차감해 동시 초과판매를 막는다.
        for (const oi of order.orderItems) {
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
                gte(schema.products.stockQuantity, oi.quantity),
              ),
            )
            .returning({ id: schema.products.id });

          if (!updatedProduct) {
            throw new BadRequestException('재고가 부족합니다.');
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
      try {
        await this.naverPayClient.cancelPayment({
          paymentId,
          amount: order.total,
          reason: '가맹점 주문 확정 실패로 자동 취소합니다.',
          requester: '2',
          idempotencyKey: `rollback-${order.id}`,
        });
        await this.db
          .update(schema.orders)
          .set({
            status: 'cancelled',
            naverPaymentId: paymentId,
            naverPayHistId: approval.payHistId ?? null,
            cancelledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.orders.id, order.id),
              eq(schema.orders.status, 'pending'),
            ),
          );
      } catch (cancelError) {
        this.logger.error(
          `결제 승인 후 주문 확정/자동취소 모두 실패: order=${order.orderNumber}, paymentId=${paymentId}`,
          cancelError instanceof Error ? cancelError.stack : undefined,
        );
        throw new InternalServerErrorException(
          `결제 처리 확인이 필요합니다. 주문번호 ${order.orderNumber}로 고객센터에 문의해 주세요.`,
        );
      }

      const reason =
        finalizeError instanceof Error
          ? finalizeError.message
          : '주문 확정 실패';
      throw new BadRequestException(
        `주문을 확정하지 못해 결제를 자동 취소했습니다. ${reason}`,
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
        await this.emailService.sendOrderPaidEmail({
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

  /** [Admin] 상품 삭제 */
  async deleteProduct(id: string) {
    const product = await this.db.query.products.findFirst({
      where: eq(schema.products.id, id),
      columns: { id: true },
      with: {
        images: { columns: { url: true } },
        detailImages: { columns: { url: true } },
      },
    });
    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
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
      // 연관 데이터 삭제
      await tx
        .delete(schema.productImages)
        .where(eq(schema.productImages.productId, id));
      await tx
        .delete(schema.productOptions)
        .where(eq(schema.productOptions.productId, id));
      await tx
        .delete(schema.productDetailImages)
        .where(eq(schema.productDetailImages.productId, id));
      await tx
        .delete(schema.cartItems)
        .where(eq(schema.cartItems.productId, id));
      await tx
        .delete(schema.productRestockSubscriptions)
        .where(eq(schema.productRestockSubscriptions.productId, id));

      const [deleted] = await tx
        .delete(schema.products)
        .where(eq(schema.products.id, id))
        .returning();

      if (!deleted) {
        throw new NotFoundException('상품을 찾을 수 없습니다.');
      }
      return deleted;
    });

    await this.spacesStorageService.deleteStoredUrls([
      ...product.images.map((image) => image.url),
      ...product.detailImages.map((image) => image.url),
      ...reviewImages.map((image) => image.url),
    ]);

    return deleted;
  }
}
