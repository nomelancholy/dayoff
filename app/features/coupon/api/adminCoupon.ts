import apiClient from '@/common/lib/apiClient'
import type { Coupon } from '../types/coupon'

export type DiscountType = 'percent' | 'fixed'

export interface CreateAdminCouponInput {
  code: string
  discountType: DiscountType
  discountValue: number
  minOrderAmount?: number
  validFrom: string
  validUntil: string
  usageLimit?: number
  isActive?: boolean
}

export interface UpdateAdminCouponInput {
  code?: string
  discountType?: DiscountType
  discountValue?: number
  minOrderAmount?: number | null
  validFrom?: string
  validUntil?: string
  usageLimit?: number | null
  isActive?: boolean
}

/** 관리자: 쿠폰 목록 */
export async function fetchAdminCoupons(): Promise<Coupon[]> {
  return apiClient.get<Coupon[]>('/coupons')
}

/** 관리자: 쿠폰 생성 */
export async function createAdminCoupon(
  input: CreateAdminCouponInput,
): Promise<Coupon> {
  return apiClient.post<Coupon>('/coupons', input)
}

/** 관리자: 쿠폰 수정 */
export async function updateAdminCoupon(
  id: string,
  input: UpdateAdminCouponInput,
): Promise<Coupon> {
  return apiClient.patch<Coupon>(`/coupons/${id}`, input)
}

/** 관리자: 쿠폰 삭제 */
export async function deleteAdminCoupon(id: string): Promise<{ ok: boolean }> {
  return apiClient.delete<{ ok: boolean }>(`/coupons/${id}`)
}

