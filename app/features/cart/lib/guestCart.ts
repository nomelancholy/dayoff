import { isAxiosError } from 'axios'
import apiClient from '@/common/lib/apiClient'
import type { CartItem, Product } from '@/features/shop/api/shop'

export const GUEST_CART_KEY = 'dayoff.guest-cart.v1'
export const GUEST_CART_EVENT = 'guest-cart-changed'
const MAX_LINES = 50
const MAX_QUANTITY = 999
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type GuestCartLine = {
  id: string
  productId: string
  optionId: string | null
  quantity: number
}
const lineId = (productId: string, optionId: string | null) =>
  `guest:${productId}:${optionId ?? ''}`
export function guestCartSnapshot(): string {
  try {
    return localStorage.getItem(GUEST_CART_KEY) ?? ''
  } catch {
    return ''
  }
}
export function readGuestCart(): GuestCartLine[] {
  try {
    const stored = JSON.parse(guestCartSnapshot() || '{}')
    if (stored.version !== 1 || !Array.isArray(stored.items)) return []
    const lines = new Map<string, GuestCartLine>()
    for (const value of stored.items.slice(0, MAX_LINES)) {
      if (
        !value ||
        typeof value.productId !== 'string' ||
        !uuid.test(value.productId) ||
        (value.optionId != null &&
          (typeof value.optionId !== 'string' || !uuid.test(value.optionId))) ||
        !Number.isInteger(value.quantity) ||
        value.quantity < 1 ||
        value.quantity > MAX_QUANTITY
      )
        continue
      const productId = value.productId.toLowerCase()
      const optionId = value.optionId?.toLowerCase() ?? null
      const id = lineId(productId, optionId)
      lines.set(id, {
        id,
        productId,
        optionId,
        quantity: Math.min(
          MAX_QUANTITY,
          (lines.get(id)?.quantity ?? 0) + value.quantity
        ),
      })
    }
    return [...lines.values()]
  } catch {
    return []
  }
}
function save(lines: GuestCartLine[]) {
  try {
    // Persist identifiers and quantities only. Prices and availability always come from the server.
    localStorage.setItem(
      GUEST_CART_KEY,
      JSON.stringify({
        version: 1,
        items: lines.map(({ productId, optionId, quantity }) => ({
          productId,
          optionId,
          quantity,
        })),
      })
    )
  } catch {
    throw new Error(
      '장바구니를 저장할 수 없습니다. 브라우저의 사이트 저장 공간 설정을 확인해 주세요.'
    )
  }
  window.dispatchEvent(new Event(GUEST_CART_EVENT))
}
function quantityValid(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY)
    throw new Error('수량은 1~999개의 정수로 입력해 주세요.')
}
async function loadProduct(id: string) {
  return apiClient.get<Product>(`/shop/products/${id}`)
}
function optionIssue(product: Product, optionId: string | null) {
  const options = product.options ?? []
  return options.length
    ? !options.some((option) => option.id === optionId)
    : !!optionId
}
function asCartItem(line: GuestCartLine, product: Product): CartItem {
  return {
    ...line,
    userId: '',
    createdAt: '',
    updatedAt: '',
    product: { ...product, images: product.images ?? [] },
    option:
      product.options?.find((option) => option.id === line.optionId) ?? null,
    availabilityMessage: optionIssue(product, line.optionId)
      ? '옵션이 변경되었습니다. 삭제 후 상품 상세에서 다시 담아 주세요.'
      : undefined,
  }
}
export async function fetchGuestCart(): Promise<CartItem[]> {
  const lines = readGuestCart()
  const entries = await Promise.all(
    [...new Set(lines.map((line) => line.productId))].map(async (id) => {
      try {
        return [id, await loadProduct(id)] as const
      } catch (error) {
        if (!isAxiosError(error) || error.response?.status !== 404) throw error
        // Keep a removable row for deleted/hidden products; never silently discard a cart.
        const unavailable: Product = {
          id,
          slug: '',
          categoryId: '',
          name: '현재 구매할 수 없는 상품',
          description: null,
          price: 0,
          stockQuantity: 0,
          isActive: false,
          createdAt: '',
          updatedAt: '',
          images: [],
        }
        return [id, unavailable] as const
      }
    })
  )
  const products = new Map(entries)
  return lines.map((line) => asCartItem(line, products.get(line.productId)!))
}
export async function addGuestCart(data: {
  productId: string
  optionId?: string
  quantity: number
}): Promise<CartItem> {
  quantityValid(data.quantity)
  if (
    !uuid.test(data.productId) ||
    (data.optionId && !uuid.test(data.optionId))
  )
    throw new Error('상품 정보를 다시 확인해 주세요.')
  const product = await loadProduct(data.productId)
  const optionId = data.optionId ?? null
  if (!product.isActive || product.stockQuantity < 1)
    throw new Error('현재 구매할 수 없는 상품입니다.')
  if (optionIssue(product, optionId))
    throw new Error('상품 옵션을 다시 선택해 주세요.')
  // Read after the request so same-tab additions cannot overwrite one another.
  const lines = readGuestCart()
  const id = lineId(product.id, optionId)
  const existing = lines.find((line) => line.id === id)
  const total = lines
    .filter((line) => line.productId === product.id)
    .reduce((sum, line) => sum + line.quantity, 0)
  if (total + data.quantity > product.stockQuantity)
    throw new Error(
      `장바구니에 담긴 수량을 포함해 ${product.stockQuantity}개까지 구매할 수 있습니다.`
    )
  if (existing) {
    quantityValid(existing.quantity + data.quantity)
    existing.quantity += data.quantity
  } else {
    if (lines.length >= MAX_LINES)
      throw new Error('장바구니에는 최대 50개 상품 옵션을 담을 수 있습니다.')
    lines.push({ id, productId: product.id, optionId, quantity: data.quantity })
  }
  save(lines)
  return asCartItem(lines.find((line) => line.id === id)!, product)
}
export async function updateGuestCart(
  id: string,
  quantity: number
): Promise<CartItem> {
  quantityValid(quantity)
  const initial = readGuestCart().find((line) => line.id === id)
  if (!initial) throw new Error('장바구니에서 삭제된 상품입니다.')
  const product = await loadProduct(initial.productId)
  const lines = readGuestCart()
  const line = lines.find((value) => value.id === id)
  if (!line) throw new Error('장바구니에서 삭제된 상품입니다.')
  const otherQuantity = lines
    .filter((value) => value.productId === line.productId && value.id !== id)
    .reduce((sum, value) => sum + value.quantity, 0)
  if (
    quantity > line.quantity &&
    (!product.isActive || quantity + otherQuantity > product.stockQuantity)
  )
    throw new Error('구매 가능한 재고를 초과했습니다.')
  line.quantity = quantity
  save(lines)
  return asCartItem(line, product)
}
export async function removeGuestCart(id: string): Promise<void> {
  save(readGuestCart().filter((line) => line.id !== id))
}
export function cartItemIssue(item: CartItem): string | null {
  if (!item.product.isActive) return '현재 판매하지 않는 상품입니다.'
  if (item.product.stockQuantity <= 0) return '품절된 상품입니다.'
  if (item.availabilityMessage) return item.availabilityMessage
  if (item.quantity > item.product.stockQuantity)
    return `구매 가능 수량은 ${item.product.stockQuantity}개입니다.`
  return null
}
export function cartSelectionIssue(items: CartItem[]): string | null {
  if (!items.length) return '구매할 상품을 선택해 주세요.'
  if (items.length > MAX_LINES)
    return '한 번에 최대 50개 상품 옵션을 구매할 수 있습니다.'
  const quantities = new Map<string, number>()
  for (const item of items) {
    const issue = cartItemIssue(item)
    if (issue) return issue
    const quantity = (quantities.get(item.productId) ?? 0) + item.quantity
    if (quantity > item.product.stockQuantity)
      return `${item.product.name}: 선택한 옵션의 총수량이 재고를 초과했습니다.`
    quantities.set(item.productId, quantity)
  }
  return null
}
