export interface ProductPricingSource {
  price: number
  originalPrice?: number | null
  discountRate?: number | null
}

export function calculateDiscountedPrice(
  originalPrice: number,
  discountRate: number
) {
  if (!Number.isFinite(originalPrice) || !Number.isFinite(discountRate))
    return 0
  const normalizedPrice = Math.max(0, Math.floor(originalPrice))
  const normalizedRate = Math.min(100, Math.max(0, Math.floor(discountRate)))
  return Math.floor((normalizedPrice * (100 - normalizedRate)) / 100)
}

export function getProductPricing(product: ProductPricingSource) {
  const salePrice = Math.max(0, Math.floor(Number(product.price) || 0))
  const originalPrice = Math.max(
    0,
    Math.floor(Number(product.originalPrice) || 0)
  )
  const discountRate = Math.min(
    100,
    Math.max(0, Math.floor(Number(product.discountRate) || 0))
  )
  const hasDiscount =
    discountRate > 0 && originalPrice > salePrice && originalPrice > 0

  return {
    salePrice,
    originalPrice: hasDiscount ? originalPrice : salePrice,
    discountRate: hasDiscount ? discountRate : 0,
    hasDiscount,
  }
}
