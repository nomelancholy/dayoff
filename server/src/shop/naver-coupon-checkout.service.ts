import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../common/database/database.module';
import * as schema from '../db/schema';
import { OrderReviewService } from './order-review.service';
import { NaverOrderService, NaverOrderPricing } from './naver-order.service';
import { NaverOrderClient } from './naver-order.client';
import type { CouponOrderDto } from './order-review.controller';

const table = schema.naverCouponCheckouts;
@Injectable()
export class NaverCouponCheckoutService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly review: OrderReviewService,
    private readonly orders: NaverOrderService,
    private readonly client: NaverOrderClient,
    private readonly config: ConfigService,
  ) {}
  enabled() {
    return this.config.get('NAVER_COUPON_CHECKOUT_ENABLED') === 'true';
  }
  private mode() {
    return this.client.value('NAVER_ORDER_MODE') === 'production'
      ? 'production'
      : 'sandbox';
  }
  private pricing(row: typeof table.$inferSelect): NaverOrderPricing {
    const quantities = new Map<string, number>();
    for (const item of row.items)
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    return {
      prices: new Map(
        row.items.map((i) => [i.productId, i.discountedUnitPrice]),
      ),
      quantities,
      customCode1: 'dc1_' + row.id,
      customCode2: row.token,
    };
  }
  async register(dto: CouponOrderDto, userId?: string) {
    if (!this.enabled())
      throw new ServiceUnavailableException('쿠폰 결제를 준비 중입니다.');
    this.client.assertAccess(userId);
    if (!userId) {
      if (dto.userCouponId)
        throw new UnauthorizedException('쿠폰을 사용하려면 로그인해 주세요.');
      const quote = await this.review.preview({ ...dto, useCoupon: false });
      if (quote.total !== dto.expectedTotal)
        throw new ConflictException(
          '금액이 변경되었습니다. 주문 내용을 다시 확인해 주세요.',
        );
      return this.orders.register(dto);
    }
    const mode = this.mode();
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          items: [...dto.items].sort((a, b) =>
            (a.productId + String(a.optionId)).localeCompare(
              b.productId + String(b.optionId),
            ),
          ),
          source: dto.source,
          userCouponId: dto.userCouponId ?? null,
          useCoupon: dto.useCoupon !== false,
        }),
      )
      .digest('hex');
    const prepared = await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${userId},734812))`,
      );
      const [existing] = await tx
        .select()
        .from(table)
        .where(
          and(
            eq(table.mode, mode),
            eq(table.userId, userId),
            eq(table.requestId, dto.requestId),
          ),
        );
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new ConflictException(
            '주문 내용이 바뀌었습니다. 새 주문으로 다시 확인해 주세요.',
          );
        if (existing.state === 'failed' && existing.releasedAt)
          throw new ConflictException({
            message: '주문 등록이 중단되었습니다. 다시 시도해 주세요.',
            code: 'CHECKOUT_ATTEMPT_CLOSED',
          });
        if (
          existing.state === 'registered' &&
          existing.key &&
          existing.merchantNo
        )
          return { row: existing, reuse: true };
        throw new ConflictException(
          '이미 처리 중이거나 종료된 주문입니다. 네이버페이 주문내역을 확인해 주세요.',
        );
      }
      if (dto.userCouponId) {
        const [hold] = await tx
          .select()
          .from(table)
          .where(
            and(
              eq(table.mode, mode),
              eq(table.userId, userId),
              eq(table.userCouponId, dto.userCouponId),
              isNull(table.releasedAt),
            ),
          );
        if (hold) {
          if (
            hold.requestHash === requestHash &&
            hold.state === 'registered' &&
            hold.key &&
            hold.merchantNo
          )
            return { row: hold, reuse: true };
          throw new ConflictException(
            '이 쿠폰은 다른 네이버페이 주문에서 사용 대기 중입니다. 기존 주문을 완료하거나 취소해 주세요.',
          );
        }
      }
      const quote = await this.review.preview(dto, userId);
      if (quote.total !== dto.expectedTotal)
        throw new ConflictException(
          '가격 또는 쿠폰이 변경되었습니다. 주문 내용을 다시 확인해 주세요.',
        );
      if (!quote.selectedUserCouponId || quote.discountAmount === 0)
        return { row: null, reuse: false };
      // Serialize global usage limits with all reservations for the same coupon.
      const [owned] = await tx
        .select()
        .from(schema.userCoupons)
        .where(
          and(
            eq(schema.userCoupons.id, quote.selectedUserCouponId),
            eq(schema.userCoupons.userId, userId),
          ),
        )
        .for('update');
      if (!owned || owned.usedAt)
        throw new BadRequestException('사용할 수 없는 쿠폰입니다.');
      const [coupon] = await tx
        .select()
        .from(schema.coupons)
        .where(eq(schema.coupons.id, owned.couponId))
        .for('update');
      const now = new Date();
      if (
        !coupon?.isActive ||
        now < coupon.validFrom ||
        now > coupon.validUntil
      )
        throw new BadRequestException('쿠폰 사용 기간을 확인해 주세요.');
      const holds = await tx
        .select({ id: table.id })
        .from(table)
        .where(
          and(
            eq(table.mode, mode),
            eq(table.couponId, coupon.id),
            isNull(table.releasedAt),
            isNull(table.redeemedAt),
          ),
        );
      if (
        coupon.usageLimit != null &&
        coupon.usedCount + holds.length >= coupon.usageLimit
      )
        throw new BadRequestException('쿠폰 사용 한도를 초과했습니다.');
      if (mode === 'production') {
        const [sync] = await tx
          .select()
          .from(schema.naverOrderSyncState)
          .where(eq(schema.naverOrderSyncState.mode, 'production'));
        if (
          !sync?.inventoryEnabled ||
          sync.lastError ||
          !sync.lastSuccessAt ||
          Date.now() - sync.lastSuccessAt.getTime() > 180000 ||
          Date.now() - sync.cursor.getTime() > 180000
        )
          throw new ServiceUnavailableException(
            '결제 상태 확인이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
          );
      }
      const [row] = await tx
        .insert(table)
        .values({
          mode,
          userId,
          userCouponId: owned.id,
          couponId: coupon.id,
          requestId: dto.requestId,
          requestHash,
          token: randomBytes(32).toString('base64url'),
          items: quote.items,
          subtotal: quote.subtotal,
          discountAmount: quote.discountAmount,
        })
        .returning();
      return { row, reuse: false };
    });
    if (!prepared.row) return this.orders.register(dto);
    if (prepared.reuse)
      return { key: prepared.row.key!, merchantNo: prepared.row.merchantNo! };
    const row = prepared.row;
    try {
      const result = await this.orders.register(dto, this.pricing(row));
      const [saved] = await this.db
        .update(table)
        .set({
          key: result.key,
          merchantNo: result.merchantNo,
          state: 'registered',
          updatedAt: new Date(),
        })
        .where(and(eq(table.id, row.id), eq(table.state, 'registering')))
        .returning({ id: table.id });
      if (!saved)
        throw new ConflictException(
          '주문 상태가 변경되었습니다. 다시 확인해 주세요.',
        );
      return result;
    } catch (error) {
      // No buy key has been returned to the browser; revoke the XML token before freeing the hold.
      await this.db
        .update(table)
        .set({ state: 'failed', releasedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(table.id, row.id), eq(table.state, 'registering')));
      throw error;
    }
  }
  async pending(userId?: string) {
    if (!userId) return [];
    const rows = await this.db
      .select()
      .from(table)
      .where(
        and(
          eq(table.userId, userId),
          eq(table.mode, this.mode()),
          isNull(table.releasedAt),
          isNull(table.redeemedAt),
        ),
      );
    return rows.map((row) => ({
      id: row.id,
      state: row.state,
      items: row.items,
      discountAmount: row.discountAmount,
      subtotal: row.subtotal,
      total:
        row.subtotal -
        row.discountAmount +
        (row.subtotal - row.discountAmount >= 100000 ? 0 : 4000),
      canResume: row.state === 'registered' && !!row.key,
      canRelease:
        row.state === 'registered' && !row.validatedAt && !row.providerOrderId,
    }));
  }
  async resume(id: string, userId?: string) {
    if (!userId) throw new UnauthorizedException();
    const [row] = await this.db
      .select()
      .from(table)
      .where(
        and(
          eq(table.id, id),
          eq(table.userId, userId),
          eq(table.mode, this.mode()),
        ),
      );
    if (
      !row ||
      row.state !== 'registered' ||
      row.releasedAt ||
      !row.key ||
      !row.merchantNo
    )
      throw new ConflictException(
        '주문 상태가 변경되었습니다. 네이버페이 주문내역을 확인해 주세요.',
      );
    return { key: row.key, merchantNo: row.merchantNo };
  }
  async release(id: string, userId?: string) {
    if (!userId) throw new UnauthorizedException();
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(table)
        .where(
          and(
            eq(table.id, id),
            eq(table.userId, userId),
            eq(table.mode, this.mode()),
          ),
        )
        .for('update');
      if (
        !row ||
        row.state !== 'registered' ||
        row.validatedAt ||
        row.providerOrderId ||
        row.releasedAt
      )
        throw new ConflictException(
          '네이버페이에서 확인 중인 주문입니다. 네이버페이 주문내역에서 취소해 주세요.',
        );
      await tx
        .update(table)
        .set({ state: 'failed', releasedAt: new Date(), updatedAt: new Date() })
        .where(eq(table.id, id));
      return { ok: true };
    });
  }
  async productPricing(
    code1: string | null,
    code2: string | null,
  ): Promise<NaverOrderPricing | undefined> {
    if (!code1 && !code2) return undefined;
    if (
      !/^dc1_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        code1 ?? '',
      ) ||
      !code2
    )
      throw new BadRequestException('주문 확인 정보가 올바르지 않습니다.');
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(table)
        .where(eq(table.id, code1!.slice(4)))
        .for('update');
      if (!row || row.token !== code2)
        throw new BadRequestException('주문 확인 정보가 올바르지 않습니다.');
      let blocked =
        !['registering', 'registered', 'pending'].includes(row.state) ||
        !!row.releasedAt;
      if (!blocked && row.mode === 'production') {
        const [sync] = await tx
          .select()
          .from(schema.naverOrderSyncState)
          .where(eq(schema.naverOrderSyncState.mode, 'production'));
        if (
          !sync?.lastSuccessAt ||
          sync.lastError ||
          Date.now() - sync.lastSuccessAt.getTime() > 180000 ||
          Date.now() - sync.cursor.getTime() > 180000
        )
          blocked = true;
      }
      if (!blocked && !row.validatedAt)
        await tx
          .update(table)
          .set({ validatedAt: new Date(), updatedAt: new Date() })
          .where(eq(table.id, row.id));
      return { ...this.pricing(row), blocked };
    });
  }
}
