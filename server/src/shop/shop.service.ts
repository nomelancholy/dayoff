import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc, desc, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../common/database/database.module';
import * as schema from '../db/schema';

@Injectable()
export class ShopService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /** 카테고리 목록 조회 */
  async getCategories() {
    return this.db.query.productCategories.findMany({
      orderBy: [asc(schema.productCategories.sortOrder)],
    });
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

  /** 상품 상세 조회 (상세 이미지, 구매평 포함) */
  async getProduct(id: string) {
    const product = await this.db.query.products.findFirst({
      where: eq(schema.products.id, id),
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
      where: eq(schema.productReviews.productId, id),
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
  async updateCartItemQuantity(userId: string, cartItemId: string, quantity: number) {
    const [updated] = await this.db
      .update(schema.cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(and(eq(schema.cartItems.id, cartItemId), eq(schema.cartItems.userId, userId)))
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

      return this.getProduct(product.id);
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

  /** 내 주문 목록 (주문별 상세 아이템 포함) */
  async getMyOrders(userId: string) {
    const list = await this.db.query.orders.findMany({
      where: eq(schema.orders.userId, userId),
      orderBy: [desc(schema.orders.createdAt)],
      with: {
        orderItems: true,
      },
    });
    return list;
  }

  /** 구매평 작성 (로그인 사용자) */
  async createReview(
    userId: string,
    productId: string,
    data: { body: string; rating?: number; imageUrls?: string[] },
  ) {
    const product = await this.db.query.products.findFirst({
      where: eq(schema.products.id, productId),
    });
    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    return await this.db.transaction(async (tx) => {
      const [review] = await tx
        .insert(schema.productReviews)
        .values({
          productId,
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
