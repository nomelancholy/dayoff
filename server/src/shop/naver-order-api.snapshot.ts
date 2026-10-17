import {
  identifier,
  NaverApiError,
  object,
  validDate,
} from './naver-order-api.client';
import { consumedQuantity } from './naver-order-inventory';

/** Minimal allowlist: never persist the provider's full response (addresses/phones). */
export function inventorySnapshot(value: unknown, mallId: string) {
  const detail = object(value),
    order = object(detail.order),
    p = object(detail.productOrder);
  if (
    !identifier(p.productOrderId) ||
    !identifier(order.orderId) ||
    !identifier(p.productId) ||
    p.mallId !== mallId
  )
    throw new NaverApiError('ORDER_IDENTITY_MISMATCH');
  if (p.orderIntegrationVersion !== 'V21')
    throw new NaverApiError('UNSUPPORTED_ORDER_VERSION');
  const status = p.productOrderStatus;
  const states = [
    'PAYMENT_WAITING',
    'PAYED',
    'DELIVERING',
    'DELIVERED',
    'PURCHASE_DECIDED',
    'EXCHANGED',
    'CANCELED',
    'RETURNED',
    'CANCELED_BY_NOPAYMENT',
  ];
  if (!states.includes(status)) throw new NaverApiError('UNKNOWN_ORDER_STATUS');
  const quantity = p.initialQuantity;
  if (
    !Number.isSafeInteger(p.remainQuantity) ||
    p.remainQuantity < 0 ||
    p.remainQuantity > quantity
  )
    throw new NaverApiError('INVALID_QUANTITY');
  const claims = detail.completedClaims ?? [];
  if (!Array.isArray(claims)) throw new NaverApiError('INVALID_CLAIMS');
  const ids = new Set<string>();
  let cancelledQuantity = 0,
    returnedQuantity = 0;
  for (const raw of claims) {
    const c = object(raw);
    if (
      !identifier(c.claimId) ||
      ids.has(c.claimId) ||
      !Number.isSafeInteger(c.requestQuantity) ||
      c.requestQuantity < 1
    )
      throw new NaverApiError('INVALID_CLAIMS');
    ids.add(c.claimId);
    if (
      (c.claimType === 'CANCEL' && c.claimStatus === 'CANCEL_DONE') ||
      (c.claimType === 'ADMIN_CANCEL' && c.claimStatus === 'ADMIN_CANCEL_DONE')
    )
      cancelledQuantity += c.requestQuantity;
    else if (c.claimType === 'RETURN' && c.claimStatus === 'RETURN_DONE')
      returnedQuantity += c.requestQuantity;
    else if (c.claimType !== 'EXCHANGE' || c.claimStatus !== 'EXCHANGE_DONE')
      throw new NaverApiError('UNKNOWN_COMPLETED_CLAIM');
  }
  // A terminal whole-order cancellation is safe even if claim history is absent.
  if (status === 'CANCELED') {
    if (p.remainQuantity !== 0 || returnedQuantity)
      throw new NaverApiError('INCONSISTENT_CANCELLATION');
    cancelledQuantity = quantity;
  }
  if (cancelledQuantity + returnedQuantity > quantity)
    throw new NaverApiError('INVALID_CLAIM_QUANTITY');
  const paid =
    !['PAYMENT_WAITING', 'CANCELED_BY_NOPAYMENT'].includes(status) &&
    validDate(order.paymentDate);
  if (
    !paid &&
    !['PAYMENT_WAITING', 'CANCELED_BY_NOPAYMENT', 'CANCELED'].includes(status)
  )
    throw new NaverApiError('MISSING_PAYMENT_DATE');
  const consumed = consumedQuantity({
    quantity,
    cancelledQuantity,
    paid,
    returned: paid && (returnedQuantity > 0 || status === 'RETURNED'),
  });
  return {
    productOrderId: p.productOrderId as string,
    orderId: order.orderId as string,
    payProductId: p.productId as string,
    quantity: quantity as number,
    cancelledQuantity,
    consumed,
    status: status as string,
    paymentDate: paid ? new Date(order.paymentDate) : null,
    manualReview:
      returnedQuantity > 0 ||
      ['RETURNED', 'EXCHANGED'].includes(status) ||
      ['RETURN', 'EXCHANGE'].includes(p.claimType),
  };
}
