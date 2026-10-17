/** Provider-independent stock reconciliation. The API adapter must validate snapshots
 * before calling this function; no untrusted webhook body may change stock. */
export interface NaverInventorySnapshot {
  quantity: number;
  cancelledQuantity: number;
  paid: boolean;
  returned: boolean;
}

/** Absolute consumed quantity makes retries and missed intermediate states safe.
 * Completed returns stay consumed until the merchant inspects returned goods.
 * A cancellation request is NOT a completed cancellation. */
export function consumedQuantity(snapshot: NaverInventorySnapshot): number {
  const { quantity, cancelledQuantity, paid, returned } = snapshot;
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 999 ||
    !Number.isSafeInteger(cancelledQuantity) ||
    cancelledQuantity < 0 ||
    cancelledQuantity > quantity ||
    typeof paid !== 'boolean' ||
    typeof returned !== 'boolean' ||
    (returned && !paid)
  )
    throw new Error('INVALID_INVENTORY_SNAPSHOT');
  if (!paid) return 0;
  return quantity - cancelledQuantity;
}

/** Positive delta adds stock, negative delta consumes it. Do not clamp shortages
 * to zero: retain the deficit so cancelling one oversold order cannot create stock. */
export function stockDelta(
  previousConsumed: number,
  snapshot: NaverInventorySnapshot,
): number {
  if (
    !Number.isSafeInteger(previousConsumed) ||
    previousConsumed < 0 ||
    previousConsumed > 999
  )
    throw new Error('INVALID_PREVIOUS_CONSUMPTION');
  return previousConsumed - consumedQuantity(snapshot);
}
