import { BadRequestException } from '@nestjs/common';
/** A product has one basePrice shared by its selected options. Never use floats in XML. */
export function allocateCoupon<
  T extends { productId: string; quantity: number; unitPrice: number },
>(items: T[], requested: number) {
  const subtotal = items.reduce((n, i) => n + i.unitPrice * i.quantity, 0);
  if (
    !Number.isSafeInteger(subtotal) ||
    subtotal < 1 ||
    !Number.isSafeInteger(requested) ||
    requested < 0
  )
    throw new BadRequestException('할인 금액이 올바르지 않습니다.');
  const groups = new Map<
    string,
    { price: number; quantity: number; discount: number }
  >();
  for (const i of items) {
    if (
      !Number.isSafeInteger(i.unitPrice) ||
      i.unitPrice < 1 ||
      !Number.isSafeInteger(i.quantity) ||
      i.quantity < 1
    )
      throw new BadRequestException('상품 가격과 수량을 확인해 주세요.');
    const g = groups.get(i.productId);
    if (g && g.price !== i.unitPrice)
      throw new BadRequestException('상품 가격이 일치하지 않습니다.');
    groups.set(i.productId, {
      price: i.unitPrice,
      quantity: (g?.quantity ?? 0) + i.quantity,
      discount: 0,
    });
  }
  const target = Math.min(
    requested,
    subtotal - items.reduce((n, i) => n + i.quantity, 0),
  );
  for (const g of groups.values())
    g.discount = Math.min(
      g.price - 1,
      Number((BigInt(target) * BigInt(g.price)) / BigInt(subtotal)),
    );
  let actual = [...groups.values()].reduce(
    (n, g) => n + g.discount * g.quantity,
    0,
  );
  // Deterministic extra won per unit, only when it fits within the promised coupon amount.
  for (const [, g] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const extra = Math.min(
      g.price - 1 - g.discount,
      Math.floor((target - actual) / g.quantity),
    );
    g.discount += extra;
    actual += extra * g.quantity;
  }
  return {
    items: items.map((i) => ({
      ...i,
      discountedUnitPrice: i.unitPrice - groups.get(i.productId)!.discount,
    })),
    discountAmount: actual,
    roundingDifference: requested - actual,
  };
}
