import apiClient from '@/common/lib/apiClient'

export interface NaverProductItem {
  categoryType: string
  categoryId: string
  uid: string
  name: string
  payReferrer: string
  count: number
}

export interface CreateNaverCheckoutResponse {
  mode: 'development' | 'production'
  clientId: string
  chainId: string
  merchantUserKey: string
  merchantPayKey: string
  productName: string
  productCount: number
  totalPayAmount: number
  taxScopeAmount: number
  taxExScopeAmount: number
  returnUrl: string
  productItems: NaverProductItem[]
}

export interface ConfirmNaverPaymentResponse {
  orderNumber: string
  status: 'paid' | string
}

export interface ConfirmNaverPaymentRequest {
  paymentId: string
  merchantPayKey: string
}

export async function createNaverCheckout(params: {
  couponCode?: string | null
  cartItemIds: string[]
  cartItemQuantities?: number[]
  shippingAddressId: string
}): Promise<CreateNaverCheckoutResponse> {
  const payload =
    params.couponCode != null && params.couponCode.trim()
      ? {
          couponCode: params.couponCode,
          cartItemIds: params.cartItemIds,
          cartItemQuantities: params.cartItemQuantities,
          shippingAddressId: params.shippingAddressId,
        }
      : {
          cartItemIds: params.cartItemIds,
          cartItemQuantities: params.cartItemQuantities,
          shippingAddressId: params.shippingAddressId,
        }

  return apiClient.post<CreateNaverCheckoutResponse>(
    '/shop/checkout/naver',
    payload
  )
}

export async function confirmNaverPayment(
  payload: ConfirmNaverPaymentRequest
): Promise<ConfirmNaverPaymentResponse> {
  return apiClient.post<ConfirmNaverPaymentResponse>(
    '/shop/checkout/naver/confirm',
    payload
  )
}
