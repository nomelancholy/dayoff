import { isAxiosError } from 'axios'
import apiClient from '@/common/lib/apiClient'
import { cookie } from '@/features/naver-order/api/naverOrder'
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
      discountedUnitPrice: number
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
  pendingCheckouts: Array<{
    id: string
    state: string
    items: OrderReview['items']
    total: number
    discountAmount: number
    canResume: boolean
    canRelease: boolean
  }>
  selectedUserCouponId: string | null
  subtotal: number
  discountAmount: number
  discountedSubtotal: number
  shippingFee: number
  total: number
  isMember: boolean
  paymentEnabled: boolean
  previewOnly: boolean
  roundingPolicy: string
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

export async function registerReviewedOrder(
  draft: ReviewDraft,
  review: OrderReview
) {
  const signature = JSON.stringify({
    draft,
    coupon: review.selectedUserCouponId,
    total: review.total,
  })
  const attemptKey = 'dayoff.order-review.attempt.v1'
  let previous: { signature: string; requestId: string } | null = null
  try {
    previous = JSON.parse(sessionStorage.getItem(attemptKey) ?? 'null')
  } catch {
    /* replace invalid draft */
  }
  const attempt =
    previous?.signature === signature
      ? previous
      : { signature, requestId: crypto.randomUUID() }
  sessionStorage.setItem(attemptKey, JSON.stringify(attempt))
  try {
    return await apiClient.post<{ key: string; merchantNo: string }>(
      '/shop/order-review/register',
      {
        ...draft,
        requestId: attempt.requestId,
        expectedTotal: review.total,
        useCoupon: !!review.selectedUserCouponId,
        ...(review.selectedUserCouponId
          ? { userCouponId: review.selectedUserCouponId }
          : {}),
        naverInflowCode: cookie('NA_CO'),
        cpaInflowCode: cookie('CPAValidator'),
        saClickId: cookie('NVADID'),
      }
    )
  } catch (error) {
    // Keep ambiguous network attempts idempotent. Only a server-confirmed closed attempt may be replaced.
    if (
      isAxiosError(error) &&
      error.response?.data?.code === 'CHECKOUT_ATTEMPT_CLOSED'
    )
      sessionStorage.removeItem(attemptKey)
    throw error
  }
}

export const resumeCouponOrder = (id: string) =>
  apiClient.post<{ key: string; merchantNo: string }>(
    `/shop/order-review/${id}/resume`,
    {}
  )
export const releaseCouponOrder = (id: string) =>
  apiClient.post(`/shop/order-review/${id}/release`, {})
