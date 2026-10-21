import { allocateCoupon } from './coupon-pricing';
describe('coupon integer price allocation', () => {
  it('applies a fixed coupon to the actual selling price', () => {
    expect(
      allocateCoupon([{ productId: 'a', unitPrice: 31850, quantity: 1 }], 3000),
    ).toMatchObject({
      discountAmount: 3000,
      items: [{ discountedUnitPrice: 28850 }],
    });
  });
  it('uses the same unit price across options and reports rounding', () => {
    const r = allocateCoupon(
      [
        { productId: 'a', unitPrice: 1000, quantity: 1 },
        { productId: 'a', unitPrice: 1000, quantity: 2 },
      ],
      1000,
    );
    expect(r.discountAmount).toBe(999);
    expect(r.roundingDifference).toBe(1);
    expect(r.items.map((i) => i.discountedUnitPrice)).toEqual([667, 667]);
  });
  it('never sends zero/negative/decimal prices or exceeds the coupon', () => {
    for (const q of [1, 2, 3, 99])
      for (const discount of [0, 1, 500, 3000, 999999]) {
        const r = allocateCoupon(
          [
            { productId: 'b', unitPrice: 31850, quantity: q },
            { productId: 'a', unitPrice: 1, quantity: 2 },
          ],
          discount,
        );
        expect(r.discountAmount).toBeLessThanOrEqual(discount);
        for (const i of r.items) {
          expect(i.discountedUnitPrice).toBeGreaterThanOrEqual(1);
          expect(Number.isInteger(i.discountedUnitPrice)).toBe(true);
        }
        expect(
          r.items.reduce(
            (n, i) => n + (i.unitPrice - i.discountedUnitPrice) * i.quantity,
            0,
          ),
        ).toBe(r.discountAmount);
      }
  });
});
