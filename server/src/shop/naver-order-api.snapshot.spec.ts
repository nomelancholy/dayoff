import { inventorySnapshot } from './naver-order-api.snapshot';
const fixture = () => ({
  order: { orderId: 'o1', paymentDate: '2026-10-17T09:00:00+09:00' },
  productOrder: {
    mallId: 'np_test',
    productOrderId: 'p1',
    productId: 'product1',
    orderIntegrationVersion: 'V21',
    productOrderStatus: 'PAYED',
    initialQuantity: 3,
    remainQuantity: 3,
  },
  completedClaims: [] as any[],
});
describe('Naver order snapshot', () => {
  it('uses the documented initial quantity and omits customer data', () => {
    const data = fixture();
    (data.order as any).ordererTel = 'private';
    const snap = inventorySnapshot(data, 'np_test');
    expect(snap.consumed).toBe(3);
    expect(JSON.stringify(snap)).not.toContain('private');
  });
  it('restores only completed cancellations, not requests or returns', () => {
    const data = fixture();
    (data.productOrder as any).claimType = 'CANCEL';
    (data.productOrder as any).claimStatus = 'CANCEL_REQUEST';
    expect(inventorySnapshot(data, 'np_test').consumed).toBe(3);
    data.completedClaims = [
      {
        claimId: 'c1',
        claimType: 'CANCEL',
        claimStatus: 'CANCEL_DONE',
        requestQuantity: 1,
      },
      {
        claimId: 'c2',
        claimType: 'RETURN',
        claimStatus: 'RETURN_DONE',
        requestQuantity: 1,
      },
    ];
    data.productOrder.remainQuantity = 1;
    expect(inventorySnapshot(data, 'np_test')).toMatchObject({
      consumed: 2,
      manualReview: true,
    });
  });
  it('rejects duplicated claims, other merchants and unknown statuses', () => {
    const data = fixture();
    const c = {
      claimId: 'c1',
      claimType: 'CANCEL',
      claimStatus: 'CANCEL_DONE',
      requestQuantity: 1,
    };
    data.completedClaims = [c, c];
    expect(() => inventorySnapshot(data, 'np_test')).toThrow('INVALID_CLAIMS');
    expect(() => inventorySnapshot(fixture(), 'np_other')).toThrow(
      'ORDER_IDENTITY_MISMATCH',
    );
    const unknown = fixture();
    unknown.productOrder.productOrderStatus = 'NEW_STATUS';
    expect(() => inventorySnapshot(unknown, 'np_test')).toThrow(
      'UNKNOWN_ORDER_STATUS',
    );
  });
  it('requires a payment date for paid statuses', () => {
    const data = fixture();
    data.order.paymentDate = '';
    expect(() => inventorySnapshot(data, 'np_test')).toThrow(
      'MISSING_PAYMENT_DATE',
    );
  });
});
