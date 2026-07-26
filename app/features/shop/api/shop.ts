import apiClient from '@/common/lib/apiClient'
import { getViteApiBaseUrl } from '@/common/lib/viteApiBaseUrl'

export interface Category {
  id: string
  slug: string
  name: string
  sortOrder: number
}

export interface ProductImage {
  id: string
  productId: string
  url: string
  alt: string | null
  sortOrder: number
}

export interface ProductOption {
  id: string
  productId: string
  name: string
  value: string
  sortOrder: number
}

export interface ProductDetailImage {
  id: string
  productId: string
  url: string
  alt: string | null
  sortOrder: number
}

export interface ProductReviewImage {
  id: string
  reviewId: string
  url: string
  sortOrder: number
}

export interface ProductReview {
  id: string
  productId: string
  userId: string
  body: string
  rating: number | null
  createdAt: string
  updatedAt: string
  user?: { id: string; fullName: string | null; email: string }
  images?: ProductReviewImage[]
}

export interface Product {
  id: string
  categoryId: string
  slug: string
  name: string
  description: string | null
  price: number
  stockQuantity: number
  isActive: boolean
  purchaseNotice?: string | null
  handlingNotice?: string | null
  shippingNotice?: string | null
  exchangeReturnNotice?: string | null
  careGuide?: string | null
  createdAt: string
  updatedAt: string
  category?: Category
  images?: ProductImage[]
  options?: ProductOption[]
  detailImages?: ProductDetailImage[]
  reviews?: ProductReview[]
}

export interface CartItem {
  id: string
  userId: string
  productId: string
  optionId: string | null
  quantity: number
  createdAt: string
  updatedAt: string
  product: Product & { images: ProductImage[] }
  option?: ProductOption | null
}

/** 카테고리 목록 조회 */
export async function fetchCategories(): Promise<Category[]> {
  return apiClient.get('/shop/categories')
}

/** [Admin] 카테고리 생성 */
export async function createCategory(data: {
  slug: string
  name: string
  sortOrder?: number
}): Promise<Category> {
  return apiClient.post('/shop/admin/categories', data)
}

/** [Admin] 카테고리 수정 */
export async function updateCategory(
  id: string,
  data: {
    slug?: string
    name?: string
    sortOrder?: number
  }
): Promise<Category> {
  return apiClient.patch(`/shop/admin/categories/${id}`, data)
}

/** [Admin] 카테고리 삭제 */
export async function deleteCategory(id: string): Promise<Category> {
  return apiClient.delete(`/shop/admin/categories/${id}`)
}

/** 상품 목록 조회 */
export async function fetchProducts(categoryId?: string): Promise<Product[]> {
  return apiClient.get('/shop/products', { params: { categoryId } })
}

/** 상품 상세 조회 */
export async function fetchProduct(id: string): Promise<Product> {
  return apiClient.get(`/shop/products/${id}`)
}

export async function fetchMyRestockNotificationStatus(
  productId: string
): Promise<{ subscribed: boolean }> {
  return apiClient.get(`/shop/products/${productId}/restock-notifications/me`)
}

export async function subscribeRestockNotification(
  productId: string
): Promise<{ subscribed: boolean }> {
  return apiClient.post(`/shop/products/${productId}/restock-notifications`)
}

/** 내가 작성한 구매평 목록 (Order History용) */
export interface MyReviewItem {
  id: string
  productId: string
  orderItemId: string | null
  body: string
  rating: number | null
  createdAt: string
  updatedAt: string
  product: { id: string; name: string; slug: string }
  images: ProductReviewImage[]
}
export function fetchMyReviews(): Promise<MyReviewItem[]> {
  return apiClient.get('/shop/my-reviews')
}

export interface AdminReviewItem {
  id: string
  productId: string
  userId: string
  body: string
  rating: number | null
  createdAt: string
  updatedAt: string
  product: { id: string; name: string; slug: string }
  user: { id: string; fullName: string | null; email: string }
  images: ProductReviewImage[]
}

export async function updateMyReview(
  reviewId: string,
  data: { body: string; rating?: number | null; imageUrls?: string[] },
): Promise<MyReviewItem> {
  return apiClient.patch(`/shop/my-reviews/${reviewId}`, data)
}

export async function deleteMyReview(reviewId: string): Promise<{ id: string }> {
  return apiClient.delete(`/shop/my-reviews/${reviewId}`)
}

export async function fetchAdminReviews(): Promise<AdminReviewItem[]> {
  return apiClient.get('/shop/admin/reviews')
}

export async function updateAdminReview(
  reviewId: string,
  data: { body: string; rating?: number | null; imageUrls?: string[] },
): Promise<AdminReviewItem> {
  return apiClient.patch(`/shop/admin/reviews/${reviewId}`, data)
}

export async function deleteAdminReview(
  reviewId: string
): Promise<{ id: string }> {
  return apiClient.delete(`/shop/admin/reviews/${reviewId}`)
}

/** 주문 목록 (Order History용) */
export interface OrderItemRow {
  id: string
  orderId: string
  productId: string
  productOptionId: string | null
  productName: string
  optionLabel: string | null
  price: number
  quantity: number
  lineTotal: number
  // 주문 상세에서 상품 이미지를 함께 내려주도록 확장
  product?: {
    slug?: string
    images?: Array<{
      id?: string
      url: string
    }>
  }
}
export interface OrderRow {
  id: string
  userId: string
  orderNumber: string
  status: string
  subtotal: number
  shippingFee: number
  discountAmount: number
  total: number
  createdAt: string
  updatedAt: string
  orderItems: OrderItemRow[]
}
export function fetchMyOrders(): Promise<OrderRow[]> {
  return apiClient.get('/shop/orders')
}

export function cancelMyOrder(orderId: string): Promise<{ orderNumber: string; status: string }> {
  return apiClient.post(`/shop/orders/${orderId}/cancel`)
}

/** 장바구니 목록 조회 */
export async function fetchCartItems(): Promise<CartItem[]> {
  return apiClient.get('/shop/cart')
}

/** 장바구니 추가 */
export async function addToCart(data: {
  productId: string
  quantity: number
  optionId?: string
}): Promise<CartItem> {
  return apiClient.post('/shop/cart', data)
}

/** 장바구니 수량 변경 */
export async function updateCartItemQuantity(
  id: string,
  quantity: number
): Promise<CartItem> {
  return apiClient.patch(`/shop/cart/${id}`, { quantity })
}

/** 장바구니 삭제 */
export async function removeCartItem(id: string): Promise<void> {
  return apiClient.delete(`/shop/cart/${id}`)
}

/** [Admin] 상품 생성 */
export async function createProduct(data: {
  categoryId: string
  slug: string
  name: string
  description?: string
  price: number
  stockQuantity?: number
  isActive?: boolean
  purchaseNotice?: string
  handlingNotice?: string
  shippingNotice?: string
  exchangeReturnNotice?: string
  careGuide?: string
  images?: { url: string; alt?: string; sortOrder?: number }[]
  options?: { id?: string; name: string; value: string; sortOrder?: number }[]
  detailImages?: { url: string; alt?: string; sortOrder?: number }[]
}): Promise<Product> {
  return apiClient.post('/shop/admin/products', data)
}

/** [Admin] 상품 수정 */
export async function updateProduct(
  id: string,
  data: {
    categoryId?: string
    slug?: string
    name?: string
    description?: string
    price?: number
    stockQuantity?: number
    isActive?: boolean
    purchaseNotice?: string
    handlingNotice?: string
    shippingNotice?: string
    exchangeReturnNotice?: string
    careGuide?: string
    images?: { url: string; alt?: string; sortOrder?: number }[]
    options?: {
      id?: string
      name: string
      value: string
      sortOrder?: number
    }[]
    detailImages?: { url: string; alt?: string; sortOrder?: number }[]
  }
): Promise<Product> {
  return apiClient.patch(`/shop/admin/products/${id}`, data)
}

/** [Admin] 상품 삭제 */
export async function deleteProduct(id: string): Promise<Product> {
  return apiClient.delete(`/shop/admin/products/${id}`)
}

/** 구매평용 이미지 업로드 (파일 직접 첨부) */
export async function uploadReviewImages(files: File[]): Promise<{ urls: string[] }> {
  if (!files.length) return { urls: [] }
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const baseURL = getViteApiBaseUrl()
  const token = localStorage.getItem('auth_token')
  const res = await fetch(`${baseURL}/shop/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || '이미지 업로드에 실패했습니다.')
  }
  return res.json()
}

/** [Admin] 상품 이미지 업로드 (파일 직접 첨부) */
export async function uploadProductImages(files: File[]): Promise<{ urls: string[] }> {
  if (!files.length) return { urls: [] }
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const baseURL = getViteApiBaseUrl()
  const token = localStorage.getItem('auth_token')
  const res = await fetch(`${baseURL}/shop/admin/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || '이미지 업로드에 실패했습니다.')
  }
  return res.json()
}

/** 구매평 작성 */
export async function createProductReview(
  productId: string,
  data: { body: string; rating?: number; imageUrls?: string[]; orderItemId: string }
) {
  return apiClient.post(`/shop/products/${productId}/reviews`, data)
}
