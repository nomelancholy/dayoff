import { and, eq, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import { NaverOrderApiClient, object } from './naver-order-api.client';
import { inventorySnapshot } from './naver-order-api.snapshot';
import { databaseProductId } from './naver-order.service';
type Tx = Parameters<
  Parameters<NodePgDatabase<typeof schema>['transaction']>[0]
>[0];
const table = schema.naverCouponCheckouts;
/** Reconcile a COMPLETE provider order, never a partial changed-order page. */
export async function reconcileNaverCoupon(
  tx: Tx,
  trigger: unknown,
  mode: string,
  mallId: string,
  api: NaverOrderApiClient,
) {
  const first = object(object(trigger).productOrder);
  const code = first.sellerInternalCode1;
  if (
    typeof code !== 'string' ||
    !/^dc1_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      code,
    )
  )
    return;
  const [row] = await tx
    .select()
    .from(table)
    .where(and(eq(table.id, code.slice(4)), eq(table.mode, mode)))
    .for('update');
  if (!row) return;
  const orderId = object(object(trigger).order).orderId;
  const review = async () => {
    await tx
      .update(table)
      .set({ state: 'review', updatedAt: new Date() })
      .where(eq(table.id, row.id));
  };
  if (
    first.sellerInternalCode2 !== row.token ||
    (row.providerOrderId && row.providerOrderId !== orderId)
  ) {
    await review();
    return;
  }
  if (row.releasedAt) return;
  // Small request gaps avoid provider throttling during the extra whole-order reads.
  const ids = await api.productOrderIds(orderId);
  const details = await api.details(ids);
  const matching = details.filter(
    (d) => object(object(d).productOrder).sellerInternalCode1 === code,
  );
  if (!matching.length) {
    await review();
    return;
  }
  const quantities = new Map<string, number>();
  let snapshots: ReturnType<typeof inventorySnapshot>[];
  try {
    snapshots = matching.map((detail) => {
      const d = object(detail),
        p = object(d.productOrder);
      if (
        object(d.order).orderId !== orderId ||
        p.sellerInternalCode2 !== row.token
      )
        throw Error('identity');
      const snap = inventorySnapshot(detail, mallId),
        id = databaseProductId(snap.payProductId);
      const line = row.items.find((i) => i.productId === id);
      if (!line || p.unitPrice !== line.discountedUnitPrice)
        throw Error('price');
      quantities.set(id, (quantities.get(id) ?? 0) + snap.quantity);
      return snap;
    });
    const expected = new Map<string, number>();
    for (const item of row.items)
      expected.set(
        item.productId,
        (expected.get(item.productId) ?? 0) + item.quantity,
      );
    if (
      expected.size !== quantities.size ||
      [...expected].some(([id, n]) => quantities.get(id) !== n)
    )
      throw Error('quantity');
  } catch {
    await review();
    return;
  }
  const cancelled = snapshots.every(
    (s) =>
      ['CANCELED', 'CANCELED_BY_NOPAYMENT'].includes(s.status) &&
      !s.manualReview,
  );
  const paid = snapshots.some((s) => !!s.paymentDate);
  if (snapshots.some((s) => s.manualReview)) {
    await review();
    return;
  }
  if (cancelled) {
    if (
      mode === 'production' &&
      row.redeemedAt &&
      row.userCouponId &&
      row.couponId
    ) {
      const restored = await tx
        .update(schema.userCoupons)
        .set({ usedAt: null, orderId: null })
        .where(
          and(
            eq(schema.userCoupons.id, row.userCouponId),
            eq(schema.userCoupons.orderId, row.id),
          ),
        )
        .returning({ id: schema.userCoupons.id });
      if (restored.length)
        await tx
          .update(schema.coupons)
          .set({ usedCount: sql`greatest(${schema.coupons.usedCount}-1,0)` })
          .where(eq(schema.coupons.id, row.couponId));
    }
    await tx
      .update(table)
      .set({
        state: 'cancelled',
        providerOrderId: orderId,
        releasedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(table.id, row.id));
    return;
  }
  if (paid && !row.redeemedAt) {
    if (mode === 'production') {
      if (!row.userCouponId || !row.couponId) {
        await review();
        return;
      }
      const used = await tx
        .update(schema.userCoupons)
        .set({ usedAt: new Date(), orderId: row.id })
        .where(
          and(
            eq(schema.userCoupons.id, row.userCouponId),
            isNull(schema.userCoupons.usedAt),
          ),
        )
        .returning({ id: schema.userCoupons.id });
      if (!used.length) {
        await review();
        return;
      }
      await tx
        .update(schema.coupons)
        .set({ usedCount: sql`${schema.coupons.usedCount}+1` })
        .where(eq(schema.coupons.id, row.couponId));
    }
    await tx
      .update(table)
      .set({
        state: 'paid',
        providerOrderId: orderId,
        redeemedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(table.id, row.id));
  } else {
    await tx
      .update(table)
      .set({
        state: row.redeemedAt ? 'paid' : 'pending',
        providerOrderId: orderId,
        updatedAt: new Date(),
      })
      .where(eq(table.id, row.id));
  }
}
