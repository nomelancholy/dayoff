/** 쿠폰 (서버 응답) */
export interface Coupon {
  id: string
  code: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  minOrderAmount: number | null
  validFrom: string
  validUntil: string
  usageLimit: number | null
  usedCount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** 회원 보유 쿠폰 (user_coupons + coupon) */
export interface UserCouponWithCoupon {
  id: string
  userId: string
  couponId: string
  usedAt: string | null
  orderId: string | null
  createdAt: string
  coupon: Coupon
}

/** 쿠폰 코드 검증 결과 */
export interface ValidateCouponResult {
  valid: true
  couponId: string
  discountAmount: number
  coupon: {
    id: string
    code: string
    discountType: 'percent' | 'fixed'
    discountValue: number
    minOrderAmount: number | null
  }
}
