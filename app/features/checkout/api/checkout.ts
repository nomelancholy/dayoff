import apiClient from '@/common/lib/apiClient'

export interface CreateTossCheckoutResponse {
  orderId: string
  orderName: string
  amount: number
  widgetClientKey: string
  customerKey: string
  successUrl: string
  failUrl: string
}

export interface ConfirmTossPaymentResponse {
  orderNumber: string
  status: 'paid' | string
}

export interface ConfirmTossPaymentRequest {
  paymentKey: string
  orderId: string
  amount: number
}

export async function createTossCheckout(params: {
  couponCode?: string | null
  cartItemIds: string[]
  cartItemQuantities?: number[]
  shippingAddressId: string
}): Promise<CreateTossCheckoutResponse> {
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

  return apiClient.post<CreateTossCheckoutResponse>('/shop/checkout/toss', payload)
}

export async function confirmTossPayment(
  payload: ConfirmTossPaymentRequest,
): Promise<ConfirmTossPaymentResponse> {
  return apiClient.post<ConfirmTossPaymentResponse>(
    '/shop/checkout/toss/confirm',
    payload,
  )
}

