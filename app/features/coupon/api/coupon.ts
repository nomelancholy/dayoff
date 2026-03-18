import apiClient from '@/common/lib/apiClient'
import type { UserCouponWithCoupon, ValidateCouponResult } from '../types/coupon'

/** 내 보유 쿠폰 목록 (미사용) */
export async function fetchMyCoupons(): Promise<UserCouponWithCoupon[]> {
  return apiClient.get<UserCouponWithCoupon[]>('/coupons/my')
}

/** 쿠폰 코드 검증 (주문 금액 기준 할인액) */
export async function validateCoupon(
  code: string,
  orderAmount: number
): Promise<ValidateCouponResult> {
  return apiClient.post<ValidateCouponResult>('/coupons/validate', {
    code,
    orderAmount,
  })
}
