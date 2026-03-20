import apiClient from '@/common/lib/apiClient'
import { getApiErrorMessage } from '@/features/auth/api/auth'

export type AdminOrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'

export interface AdminOrderItemRow {
  id: string
  productId: string
  productOptionId: string | null
  productName: string
  optionLabel: string | null
  price: number
  quantity: number
  lineTotal: number
}

export interface AdminOrderRow {
  id: string
  userId: string
  orderNumber: string
  status: AdminOrderStatus
  subtotal: number
  shippingFee: number
  discountAmount: number
  total: number
  trackingNumber: string | null
  createdAt: string
  orderItems: AdminOrderItemRow[]
  shippingAddress?: {
    id: string
    label: string
    recipientName: string | null
    phone: string | null
    postalCode: string | null
    addressLine1: string
    addressLine2: string | null
  } | null
}

export async function fetchAdminOrders(status?: string): Promise<AdminOrderRow[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiClient.get<AdminOrderRow[]>(`/shop/admin/orders${qs}`)
}

export async function updateAdminOrderShipment(params: {
  orderId: string
  trackingNumber: string
}): Promise<{ id: string; status: AdminOrderStatus; trackingNumber: string | null }> {
  return apiClient.patch(`/shop/admin/orders/${params.orderId}/shipment`, {
    trackingNumber: params.trackingNumber,
  })
}

export function getAdminOrdersErrorMessage(err: unknown, fallback: string): string {
  return getApiErrorMessage(err, fallback)
}

export async function deleteAdminPendingOrders(): Promise<{ deletedOrders: number }> {
  return apiClient.delete('/shop/admin/orders/pending')
}

