import { cn } from '@/common/lib/utils'
import { getProductPricing, type ProductPricingSource } from '../lib/pricing'

interface ProductPriceProps {
  product: ProductPricingSource
  quantity?: number
  format?: 'symbol' | 'won'
  className?: string
  originalClassName?: string
  rateClassName?: string
  saleClassName?: string
}

function formatPrice(amount: number, format: 'symbol' | 'won') {
  const value = amount.toLocaleString('ko-KR')
  return format === 'won' ? `${value} 원` : `₩${value}`
}

export function ProductPrice({
  product,
  quantity = 1,
  format = 'symbol',
  className,
  originalClassName,
  rateClassName,
  saleClassName,
}: ProductPriceProps) {
  const pricing = getProductPricing(product)
  const count = Math.max(1, Math.floor(quantity))

  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-baseline gap-x-2 gap-y-1',
        className
      )}
    >
      {pricing.hasDiscount ? (
        <>
          <span
            className={cn(
              'text-dot-secondary line-through decoration-1',
              originalClassName
            )}
          >
            {formatPrice(pricing.originalPrice * count, format)}
          </span>
          <span className={cn('font-medium text-[#A45B3F]', rateClassName)}>
            {pricing.discountRate}%
          </span>
        </>
      ) : null}
      <span className={saleClassName}>
        {formatPrice(pricing.salePrice * count, format)}
      </span>
    </span>
  )
}
