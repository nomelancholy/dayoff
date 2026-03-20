import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc, desc, isNull, sql, ne, inArray, or, gt, gte, lte } from 'drizzle-orm';
import { DRIZZLE } from '../common/database/database.module';
import { CouponService } from '../coupon/coupon.service';
import * as schema from '../db/schema';
import { isOutOfDeliveryPostalCode } from './out-of-delivery-areas';

@Injectable()
export class ShopService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly couponService: CouponService,
    private readonly configService: ConfigService,
  ) {}

  /** [Admin] 주문 목록 조회 (관리자용) */
  async getAdminOrders(params?: { status?: string }) {
    const allowedStatuses = [
      'pending',
      'paid',
      'shipped',
      'delivered',
      'cancelled',
    ] as const
    const status =
      params?.status && (allowedStatuses as readonly string[]).includes(params.status)
        ? (params.status as (typeof allowedStatuses)[number])
        : undefined

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
    })
  }

  /** [Admin] 송장번호 입력 후 발송 완료 처리 */
  async updateAdminOrderShipment(
    orderId: string,
    trackingNumber: string,
  ) {
    const order = await this.db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      columns: { id: true, status: true, trackingNumber: true },
    })

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.')
    }

    if (order.status === 'pending' || order.status === 'cancelled') {
      throw new BadRequestException('발송 처리는 결제 완료된 주문부터 가능합니다.')
    }

    const [updated] = await this.db
      .update(schema.orders)
      .set({
        status: 'shipped',
        trackingNumber,
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId))
      .returning()

    return updated
  }

  /** [Admin] pending 주문(초안) 전부 삭제 */
  async deleteAdminPendingOrders() {
    return this.db.transaction(async (tx) => {
      const pendingOrders = await tx.query.orders.findMany({
        where: eq(schema.orders.status, 'pending'),
        columns: { id: true },
      })
      if (pendingOrders.length === 0) {
        return { deletedOrders: 0 }
      }

      const pendingIds = pendingOrders.map((o) => o.id)

      await tx.delete(schema.orderItems).where(
        // order_items.order_id IN (pendingIds)
        // Drizzle supports inArray with a list of UUIDs.
        inArray(schema.orderItems.orderId, pendingIds),
      )
      await tx.delete(schema.orders).where(
        inArray(schema.orders.id, pendingIds),
      )

      return { deletedOrders: pendingIds.length }
    })
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
    })

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.')
    }

    if (!product.isActive) {
      throw new BadRequestException('판매가 중지된 상품입니다.')
    }

    if (product.stockQuantity <= 0) {
      throw new BadRequestException('재고가 없습니다. (품절)')
    }

    // 상품에 옵션이 존재한다면, optionId를 반드시 선택해야 장바구니에 담을 수 있게 방어
    const productHasOptions = await this.db.query.productOptions.findMany({
      where: eq(schema.productOptions.productId, productId),
      columns: { id: true },
      limit: 1,
    })

    if (productHasOptions.length > 0) {
      if (!optionId) {
        throw new BadRequestException('옵션을 선택해 주세요.')
      }

      // 선택된 optionId가 해당 상품의 옵션인지 검증
      const optionBelongs = await this.db.query.productOptions.findFirst({
        where: and(
          eq(schema.productOptions.id, optionId),
          eq(schema.productOptions.productId, productId),
        ),
      })

      if (!optionBelongs) {
        throw new BadRequestException('잘못된 옵션입니다.')
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

    return await this.db.transaction(async (tx) => {
      const [product] = await tx
        .insert(schema.products)
        .values(productData)
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

    return await this.db.transaction(async (tx) => {
      if (Object.keys(productData).length > 0) {
        await tx
          .update(schema.products)
          .set({ ...productData, updatedAt: new Date() })
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
        await tx
          .delete(schema.productOptions)
          .where(eq(schema.productOptions.productId, id));
        if (options.length > 0) {
          await tx.insert(schema.productOptions).values(
            options.map((opt: any) => ({
              ...opt,
              productId: id,
            })),
          );
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

      return this.getProduct(id);
    });
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

    return this.db.transaction(async (tx) => {
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
  }

  /** 내 구매평 삭제 */
  async deleteMyReview(userId: string, reviewId: string) {
    const existing = await this.db.query.productReviews.findFirst({
      where: and(
        eq(schema.productReviews.id, reviewId),
        eq(schema.productReviews.userId, userId),
      ),
      columns: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다.');
    }

    await this.db
      .delete(schema.productReviews)
      .where(eq(schema.productReviews.id, reviewId));

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
    });

    if (!existing) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다.');
    }

    return this.db.transaction(async (tx) => {
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
  }

  /** [Admin] 구매평 삭제 */
  async deleteAdminReview(reviewId: string) {
    const existing = await this.db.query.productReviews.findFirst({
      where: eq(schema.productReviews.id, reviewId),
      columns: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('리뷰를 찾을 수 없습니다.');
    }

    await this.db
      .delete(schema.productReviews)
      .where(eq(schema.productReviews.id, reviewId));

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

  /** 구매평 작성 (로그인 사용자) */
  async createReview(
    userId: string,
    productId: string,
    data: { body: string; rating?: number; imageUrls?: string[]; orderItemId: string },
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

  async createTossCheckoutOrder(
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
    const requiredByProductId = new Map<string, number>()
    const stockByProductId = new Map<string, number>()

    for (const item of cartItems) {
      const purchaseQty = purchaseQtyFor(item.id, item.quantity)
      if (purchaseQty <= 0) continue

      requiredByProductId.set(
        item.productId,
        (requiredByProductId.get(item.productId) ?? 0) + purchaseQty,
      )
      stockByProductId.set(item.productId, item.product.stockQuantity)
    }

    for (const [productId, requiredQty] of requiredByProductId.entries()) {
      const stockQty = stockByProductId.get(productId) ?? 0
      if (stockQty <= 0) {
        throw new BadRequestException('재고가 없습니다. (품절)')
      }
      if (requiredQty > stockQty) {
        throw new BadRequestException('재고가 부족합니다.')
      }
    }

    const subtotal = cartItems.reduce((sum, item) => {
      const purchaseQty = purchaseQtyFor(item.id, item.quantity);
      if (purchaseQty <= 0) return sum;
      // 안전장치: 지정 구매 수량이 장바구니 수량보다 클 수 없도록 방어
      if (purchaseQty > item.quantity) {
        throw new BadRequestException('구매 수량이 장바구니 수량을 초과했습니다.');
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
    if (total <= 0) {
      throw new BadRequestException('결제할 금액이 없습니다.');
    }

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const primaryName = cartItems[0]?.product?.name ?? '도자기 상품';
    const orderName =
      cartItems.length > 1
        ? `${primaryName} 외 ${cartItems.length - 1}건`
        : primaryName;

    const frontUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const successUrl = `${frontUrl}/checkout/success`;
    const failUrl = `${frontUrl}/checkout/fail`;

    const widgetClientKey = this.configService.get<string>(
      'TOSS_WIDGET_CLIENT_KEY',
    );
    if (!widgetClientKey) {
      throw new BadRequestException(
        '서버 환경설정에 TOSS_WIDGET_CLIENT_KEY가 없습니다.',
      );
    }

    await this.db.transaction(async (tx) => {
      // checkout 주문(결제 직전) 생성은 pending draft로 쌓일 수 있습니다.
      // 동일 유저가 다시 checkout 진입하면 중복 draft를 제거해 주문번호/대기 주문이 왕창 쌓이지 않게 합니다.
      const pendingOrders = await tx.query.orders.findMany({
        where: and(eq(schema.orders.userId, userId), eq(schema.orders.status, 'pending')),
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
      orderId: orderNumber, // Toss의 orderId (우리는 orderNumber로 사용)
      orderName,
      amount: total, // KRW int
      widgetClientKey,
      customerKey: userId,
      successUrl,
      failUrl,
    };
  }

  async confirmTossPaymentAndFinalizeOrder(
    userId: string,
    params: { paymentKey: string; orderId: string; amount: number },
  ) {
    const { paymentKey, orderId, amount } = params;
    const order = await this.db.query.orders.findFirst({
      where: and(
        eq(schema.orders.orderNumber, orderId),
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

    if (order.total !== amount) {
      throw new BadRequestException(
        '결제 금액이 주문 금액과 일치하지 않습니다.',
      );
    }

    const secretKey = this.configService.get<string>('TOSS_SECRET_KEY');
    if (!secretKey) {
      throw new BadRequestException(
        '서버 환경설정에 TOSS_SECRET_KEY가 없습니다.',
      );
    }

    const basicAuth = Buffer.from(`${secretKey}:`).toString('base64');

    const paymentRes = await fetch(
      'https://api.tosspayments.com/v1/payments/confirm',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount,
        }),
      },
    );

    if (!paymentRes.ok) {
      const errorBody = await paymentRes.json().catch(() => null);
      const tossCode =
        errorBody && typeof errorBody === 'object'
          ? (errorBody as { code?: unknown }).code
          : undefined;
      const tossMessage =
        errorBody && typeof errorBody === 'object'
          ? (errorBody as { message?: unknown }).message
          : undefined;

      // 동일 paymentKey/orderId로 confirm이 동시에 여러 번 호출되면
      // Toss에서 "이미 처리중" 응답을 줄 수 있습니다.
      if (tossCode === 'ALREADY_PROCESSING_REQUEST') {
        return { orderNumber: order.orderNumber, status: order.status };
      }

      const text = typeof tossMessage === 'string' ? tossMessage : '';

      throw new BadRequestException(
        `토스 결제 확인에 실패했습니다.${text ? ` ${text}` : ''}`,
      );
    }

    const paymentData: { status?: string } = await paymentRes.json();
    if (paymentData.status && paymentData.status !== 'DONE') {
      throw new BadRequestException(
        `결제가 완료되지 않았습니다. 상태: ${paymentData.status}`,
      );
    }

    await this.db.transaction(async (tx) => {
      const [updatedOrder] = await tx
        .update(schema.orders)
        .set({ status: 'paid', updatedAt: new Date() })
        .where(
          and(eq(schema.orders.id, order.id), ne(schema.orders.status, 'paid')),
        )
        .returning();

      if (!updatedOrder) return;

      if (order.couponId) {
        await tx
          .update(schema.coupons)
          .set({ usedCount: sql`${schema.coupons.usedCount} + 1` })
          .where(eq(schema.coupons.id, order.couponId));

        // 지급 쿠폰(user_coupons) 이력이 있는 경우만 사용처리
        await tx
          .update(schema.userCoupons)
          .set({ usedAt: new Date(), orderId: updatedOrder.id })
          .where(
            and(
              eq(schema.userCoupons.userId, userId),
              eq(schema.userCoupons.couponId, order.couponId),
              isNull(schema.userCoupons.usedAt),
            ),
          );
      }

      // 장바구니에 이미 같은 상품이 merge 되어 있을 수 있으므로,
      // 결제 확정 시엔 cartItems 를 "삭제"가 아니라 주문 수량(oi.quantity)만큼 차감합니다.
      for (const oi of order.orderItems) {
        const baseCond = and(
          eq(schema.cartItems.userId, userId),
          eq(schema.cartItems.productId, oi.productId),
          oi.productOptionId == null
            ? isNull(schema.cartItems.optionId)
            : eq(schema.cartItems.optionId, oi.productOptionId),
        );

        // 재고 차감: stock_quantity 가 0 이하이면 결제를 확정하지 못하게 막는다.
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

        // cart 수량이 주문 수량보다 작거나 같으면 행 자체를 삭제
        await tx.delete(schema.cartItems).where(
          and(baseCond, lte(schema.cartItems.quantity, oi.quantity)),
        );

        // cart 수량이 더 많으면 주문 수량만큼만 차감
        await tx
          .update(schema.cartItems)
          .set({
            quantity: sql`${schema.cartItems.quantity} - ${oi.quantity}`,
          })
          .where(and(baseCond, gt(schema.cartItems.quantity, oi.quantity)));
      }
    });

    return { orderNumber: order.orderNumber, status: 'paid' };
  }

  /** [Admin] 상품 삭제 */
  async deleteProduct(id: string) {
    return await this.db.transaction(async (tx) => {
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

      const [deleted] = await tx
        .delete(schema.products)
        .where(eq(schema.products.id, id))
        .returning();

      if (!deleted) {
        throw new NotFoundException('상품을 찾을 수 없습니다.');
      }
      return deleted;
    });
  }
}
