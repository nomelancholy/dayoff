import { reconcileNaverCoupon } from './naver-coupon-reconcile';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../common/database/database.module';
import * as schema from '../db/schema';
import {
  NaverOrderApiClient,
  NaverApiError,
  validDate,
} from './naver-order-api.client';
import { inventorySnapshot } from './naver-order-api.snapshot';
import { databaseProductId } from './naver-order.service';

const state = schema.naverOrderSyncState,
  ledger = schema.naverOrderInventory;
const MINUTE = 60000;
@Injectable()
export class NaverOrderSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NaverOrderSyncService.name);
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private running = false;
  private lastError: string | null = null;
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly api: NaverOrderApiClient,
  ) {}
  onModuleInit() {
    if (this.enabled()) this.schedule(5000);
  }
  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
  private enabled() {
    return this.api.value('NAVER_ORDER_SYNC_ENABLED') === 'true';
  }
  private schedule(delay: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.run()
        .catch(() => undefined)
        .finally(() => this.schedule(MINUTE));
    }, delay);
    this.timer.unref();
  }
  private settings() {
    const mode = this.api.mode();
    const start = this.api.value('NAVER_ORDER_SYNC_START_AT');
    if (!validDate(start) || Date.parse(start) > Date.now())
      throw new NaverApiError('INVALID_SYNC_START');
    const inventoryEnabled =
      this.api.value('NAVER_ORDER_INVENTORY_ENABLED') === 'true';
    if (
      inventoryEnabled &&
      (mode !== 'production' ||
        this.api.value('NAVER_ORDER_MODE') !== 'production')
    )
      throw new NaverApiError('SANDBOX_INVENTORY_FORBIDDEN');
    const mallId = this.api.value('NAVER_ORDER_MERCHANT_ID');
    if (!mallId) throw new NaverApiError('MISSING_MERCHANT_ID');
    const identity = createHash('sha256')
      .update(`${this.api.value('NAVER_ORDER_API_CLIENT_ID')}:${mallId}`)
      .digest('hex');
    return {
      mode,
      startsAt: new Date(start),
      inventoryEnabled,
      mallId,
      identity,
    };
  }
  async status() {
    const mode = this.api.value('NAVER_ORDER_API_MODE');
    const [current] = await this.db
      .select()
      .from(state)
      .where(eq(state.mode, mode));
    const recent = await this.db
      .select({
        productOrderId: ledger.productOrderId,
        status: ledger.status,
        quantity: ledger.quantity,
        consumed: ledger.consumed,
        appliedConsumed: ledger.appliedConsumed,
        manualReview: ledger.manualReview,
        updatedAt: ledger.updatedAt,
      })
      .from(ledger)
      .where(eq(ledger.mode, mode))
      .orderBy(desc(ledger.updatedAt))
      .limit(30);
    return {
      mode,
      enabled: this.enabled(),
      running: this.running,
      ...this.api.credentialStatus(),
      inventoryEnabled:
        this.api.value('NAVER_ORDER_INVENTORY_ENABLED') === 'true',
      cursor: current?.cursor,
      startsAt: current?.startsAt,
      lastSuccessAt: current?.lastSuccessAt,
      lastError: this.lastError ?? current?.lastError,
      recent,
      couponReview: await this.db
        .select({
          id: schema.naverCouponCheckouts.id,
          state: schema.naverCouponCheckouts.state,
          updatedAt: schema.naverCouponCheckouts.updatedAt,
        })
        .from(schema.naverCouponCheckouts)
        .where(
          and(
            eq(schema.naverCouponCheckouts.mode, mode),
            eq(schema.naverCouponCheckouts.state, 'review'),
          ),
        )
        .orderBy(desc(schema.naverCouponCheckouts.updatedAt))
        .limit(30),
    };
  }
  async run() {
    if (!this.enabled()) throw new NaverApiError('SYNC_DISABLED');
    if (this.running) return { skipped: 'already-running' };
    this.running = true;
    try {
      const config = this.settings();
      const result = await this.db.transaction(async (tx) => {
        // Held across provider reads + ledger + stock + cursor, also across replicas.
        const lock = await tx.execute(
          sql`select pg_try_advisory_xact_lock(731920401) as locked`,
        );
        if (!lock.rows[0]?.locked) return { skipped: 'already-running' };
        await tx
          .insert(state)
          .values({
            mode: config.mode,
            identity: config.identity,
            startsAt: config.startsAt,
            cursor: config.startsAt,
            inventoryEnabled: config.inventoryEnabled,
          })
          .onConflictDoNothing();
        const [current] = await tx
          .select()
          .from(state)
          .where(eq(state.mode, config.mode));
        if (
          current.identity !== config.identity ||
          current.startsAt.getTime() !== config.startsAt.getTime() ||
          current.inventoryEnabled !== config.inventoryEnabled
        )
          throw new NaverApiError('SYNC_CONFIGURATION_CHANGED');
        // Delay 30s, replay 5min for boundary/late visibility. Catch up in 15min windows.
        const end = new Date(
          Math.min(Date.now() - 30000, current.cursor.getTime() + 15 * MINUTE),
        );
        if (end < current.cursor) return { skipped: 'waiting-for-window' };
        let from = new Date(
          Math.max(
            config.startsAt.getTime(),
            current.cursor.getTime() - 5 * MINUTE,
          ),
        );
        let sequence: string | undefined;
        const cursors = new Set<string>();
        const reconciledCoupons = new Set<string>();
        let processed = 0,
          stockChanges = 0;
        for (let page = 0; ; page++) {
          if (page >= 20) throw new NaverApiError('SYNC_PAGE_LIMIT');
          const changed = await this.api.changes(from, end, sequence);
          const dates = new Map<string, Date>();
          for (const c of changed.lastChangeStatuses) {
            const date = new Date(c.lastChangedDate);
            if (date < from || date > end)
              throw new NaverApiError('CHANGE_OUTSIDE_WINDOW');
            if (
              !dates.has(c.productOrderId) ||
              dates.get(c.productOrderId)! < date
            )
              dates.set(c.productOrderId, date);
          }
          const details = dates.size
            ? await this.api.details([...dates.keys()])
            : [];
          for (const detail of details) {
            const snap = inventorySnapshot(detail, config.mallId);
            const changedAt = dates.get(snap.productOrderId)!;
            const where = and(
              eq(ledger.mode, config.mode),
              eq(ledger.productOrderId, snap.productOrderId),
            );
            const [previous] = await tx.select().from(ledger).where(where);
            if (previous && previous.lastChangedDate > changedAt) continue;
            if (
              previous &&
              (previous.payProductId !== snap.payProductId ||
                previous.orderId !== snap.orderId ||
                previous.quantity !== snap.quantity ||
                previous.cancelledQuantity > snap.cancelledQuantity ||
                (previous.paymentDate &&
                  !snap.paymentDate &&
                  snap.status !== 'CANCELED'))
            )
              throw new NaverApiError('ORDER_STATE_REGRESSION');
            // Historical payments manually accounted before cutover are never deducted/restored.
            const paymentDate =
              previous?.paymentDate && snap.paymentDate
                ? new Date(
                    Math.min(
                      previous.paymentDate.getTime(),
                      snap.paymentDate.getTime(),
                    ),
                  )
                : snap.paymentDate;
            const eligible = !!paymentDate && paymentDate >= config.startsAt;
            const applied =
              config.inventoryEnabled && eligible ? snap.consumed : 0;
            const delta = (previous?.appliedConsumed ?? 0) - applied;
            let productId = previous?.productId ?? null;
            if (config.inventoryEnabled && (eligible || delta !== 0)) {
              try {
                productId = databaseProductId(snap.payProductId);
              } catch {
                throw new NaverApiError('UNMAPPED_PRODUCT');
              }
              // Atomic addition preserves concurrent admin/legacy checkout changes.
              const updated = await tx
                .update(schema.products)
                .set({
                  stockQuantity: sql`${schema.products.stockQuantity} + ${delta}`,
                  updatedAt: new Date(),
                })
                .where(eq(schema.products.id, productId))
                .returning({ id: schema.products.id });
              if (!updated.length) throw new NaverApiError('UNMAPPED_PRODUCT');
              if (delta) stockChanges++;
            }
            const row = {
              mode: config.mode,
              productOrderId: snap.productOrderId,
              orderId: snap.orderId,
              payProductId: snap.payProductId,
              productId,
              quantity: snap.quantity,
              cancelledQuantity: snap.cancelledQuantity,
              consumed: snap.consumed,
              appliedConsumed: applied,
              status: snap.status,
              paymentDate,
              lastChangedDate: changedAt,
              manualReview: snap.manualReview,
              updatedAt: new Date(),
            };
            await tx
              .insert(ledger)
              .values(row)
              .onConflictDoUpdate({
                target: [ledger.mode, ledger.productOrderId],
                set: row,
              });
            const couponCode = (
              detail as { productOrder?: { sellerInternalCode1?: string } }
            ).productOrder?.sellerInternalCode1;
            const couponKey = `${couponCode}:${snap.orderId}`;
            if (
              couponCode?.startsWith('dc1_') &&
              !reconciledCoupons.has(couponKey)
            ) {
              await reconcileNaverCoupon(
                tx,
                detail,
                config.mode,
                config.mallId,
                this.api,
              );
              reconciledCoupons.add(couponKey);
            }
            processed++;
          }
          if (!changed.more) break;
          const next = new Date(changed.more.moreFrom);
          const key = `${next.toISOString()}:${changed.more.moreSequence}`;
          if (next < from || next > end || cursors.has(key))
            throw new NaverApiError('CURSOR_NOT_ADVANCING');
          cursors.add(key);
          from = next;
          sequence = changed.more.moreSequence;
        }
        await tx
          .update(state)
          .set({ cursor: end, lastSuccessAt: new Date(), lastError: null })
          .where(eq(state.mode, config.mode));
        return {
          mode: config.mode,
          processed,
          stockChanges,
          cursor: end,
          inventoryEnabled: config.inventoryEnabled,
        };
      });
      this.lastError = null;
      return result;
    } catch (error) {
      const code =
        error instanceof NaverApiError ? error.code : 'SYNC_INTERNAL_ERROR';
      this.lastError = code;
      this.logger.error(`Naver order sync: ${code}`);
      await this.db
        .update(state)
        .set({ lastError: code })
        .where(eq(state.mode, this.api.value('NAVER_ORDER_API_MODE')))
        .catch(() => undefined);
      throw new NaverApiError(code);
    } finally {
      this.running = false;
    }
  }
}
