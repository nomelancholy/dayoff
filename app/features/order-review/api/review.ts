import apiClient from '@/common/lib/apiClient'
import type { NaverOrderItem } from '@/features/naver-order/api/naverOrder'
export type ReviewDraft = {
  items: NaverOrderItem[]
  source: 'product' | 'cart'
}
export type OrderReview = {
  items: Array<
    NaverOrderItem & {
      name: string
      slug: string
      imageUrl: string | null
      optionLabel: string | null
      unitPrice: number
      amount: number
    }
  >
  coupons: Array<{
    userCouponId: string
    code: string
    discountAmount: number
    reason: string | null
    validUntil: string
  }>
  selectedUserCouponId: string | null
  subtotal: number
  discountAmount: number
  discountedSubtotal: number
  shippingFee: number
  total: number
  isMember: boolean
  paymentEnabled: false
  previewOnly: true
}
export const fetchOrderReview = (draft: ReviewDraft, choice: string) =>
  apiClient.post<OrderReview>('/shop/order-review', {
    ...draft,
    useCoupon: choice !== 'none',
    ...(choice !== 'best' && choice !== 'none' ? { userCouponId: choice } : {}),
  })
// Browser-session draft contains identifiers and quantities only, never prices or coupons.
const key = 'dayoff.order-review.v1'
export function saveReviewDraft(draft: ReviewDraft) {
  sessionStorage.setItem(key, JSON.stringify(draft))
}
export function readReviewDraft(): ReviewDraft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (
      !value ||
      !['product', 'cart'].includes(value.source) ||
      !Array.isArray(value.items) ||
      !value.items.length ||
      value.items.length > 50
    )
      return null
    if (
      !value.items.every(
        (i: NaverOrderItem) =>
          uuid.test(i.productId) &&
          (i.optionId == null || uuid.test(i.optionId)) &&
          Number.isInteger(i.quantity) &&
          i.quantity > 0 &&
          i.quantity <= 999
      )
    )
      return null
    return {
      source: value.source,
      items: value.items.map((i: NaverOrderItem) => ({
        productId: i.productId,
        optionId: i.optionId ?? null,
        quantity: i.quantity,
      })),
    }
  } catch {
    return null
  }
}
