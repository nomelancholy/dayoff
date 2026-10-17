import { consumedQuantity, stockDelta } from './naver-order-inventory';

const paid = { quantity: 3, cancelledQuantity: 0, paid: true, returned: false };
describe('Naver inventory reconciliation', () => {
  it('does not consume an unpaid order', () => {
    expect(stockDelta(0, { ...paid, paid: false })).toBe(0);
  });
  it('consumes once even when the same payment is read repeatedly', () => {
    const consumed = consumedQuantity(paid);
    expect(stockDelta(0, paid)).toBe(-3);
    expect(stockDelta(consumed, paid)).toBe(0);
  });
  it('restores only completed cancellation quantities, once', () => {
    const partial = { ...paid, cancelledQuantity: 1 };
    expect(stockDelta(3, partial)).toBe(1);
    expect(stockDelta(2, partial)).toBe(0);
    expect(stockDelta(2, { ...paid, cancelledQuantity: 3 })).toBe(2);
  });
  it('does not invent stock if the first observation is a fully cancelled order', () => {
    expect(stockDelta(0, { ...paid, cancelledQuantity: 3 })).toBe(0);
  });
  it('converges when the first observation already includes partial cancellation', () => {
    expect(stockDelta(0, { ...paid, cancelledQuantity: 1 })).toBe(-2);
  });
  it('keeps returned goods consumed pending physical inspection', () => {
    expect(stockDelta(3, { ...paid, returned: true })).toBe(0);
    expect(stockDelta(0, { ...paid, returned: true })).toBe(-3);
  });
  it('retains oversale deficit so later cancellation cannot create inventory', () => {
    let stock = 1;
    stock += stockDelta(0, paid);
    expect(stock).toBe(-2);
    stock += stockDelta(3, { ...paid, cancelledQuantity: 1 });
    expect(stock).toBe(-1);
    stock += stockDelta(2, { ...paid, cancelledQuantity: 3 });
    expect(stock).toBe(1);
  });
  it.each([
    { ...paid, quantity: 0 },
    { ...paid, quantity: 1.5 },
    { ...paid, quantity: 1000 },
    { ...paid, cancelledQuantity: 4 },
    { ...paid, cancelledQuantity: -1 },
    { ...paid, paid: false, returned: true },
  ])(
    'rejects invalid quantity/status instead of mutating inventory',
    (snapshot) => {
      expect(() => consumedQuantity(snapshot)).toThrow(
        'INVALID_INVENTORY_SNAPSHOT',
      );
    },
  );
});
