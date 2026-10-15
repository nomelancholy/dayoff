import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  fetchCartItems,
  updateCartItemQuantity,
  removeCartItem,
} from '@/features/shop/api/shop'
import { getStoredToken } from '@/features/auth/api/auth'
import { Minus, Plus } from 'lucide-react'
import { NaverOrderButton } from '@/features/naver-order/components/NaverOrderButton'
import { ProductPrice } from '@/features/shop/components/ProductPrice'

export const CartPage = () => {
  const queryClient = useQueryClient()
  const token = getStoredToken()
  const [hasUserTouchedSelection, setHasUserTouchedSelection] = useState(false)
  const [userSelectedCartItemIds, setUserSelectedCartItemIds] = useState<
    string[]
  >([])

  const { data: items, isLoading } = useQuery({
    queryKey: ['shop', 'cart'],
    queryFn: fetchCartItems,
    enabled: !!token,
  })

  const selectedCartItemIds = useMemo(() => {
    if (!items) return []
    if (!hasUserTouchedSelection) return items.map((i) => i.id)

    const availableIds = new Set(items.map((i) => i.id))
    return userSelectedCartItemIds.filter((id) => availableIds.has(id))
  }, [items, hasUserTouchedSelection, userSelectedCartItemIds])

  const selectedIdSet = useMemo(
    () => new Set(selectedCartItemIds),
    [selectedCartItemIds]
  )
  const selectedItems = useMemo(
    () => (items ?? []).filter((item) => selectedIdSet.has(item.id)),
    [items, selectedIdSet]
  )

  const selectedSubtotal = useMemo(() => {
    return (
      selectedItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      ) || 0
    )
  }, [selectedItems])

  const updateMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      updateCartItemQuantity(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'cart'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeCartItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'cart'] })
    },
  })

  const subtotal = selectedSubtotal

  if (!token) {
    return (
      <div className="min-h-screen bg-dot-bg px-4 py-28 text-center md:px-16 md:py-48">
        <span className="mono text-dot-primary">선택한 상품</span>
        <h1 className="mt-2 font-serif text-3xl tracking-[0.12em] text-dot-primary md:text-4xl">
          장바구니
        </h1>
        <p className="mt-8 text-[0.9rem] text-dot-secondary">
          장바구니를 보려면 로그인 해주세요.
        </p>
        <Link
          to="/login"
          className="mt-10 inline-block border border-dot-primary px-8 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
        >
          로그인
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dot-bg px-4 py-28 md:px-16 md:py-48">
        <div className="mx-auto max-w-[1200px] animate-pulse">
          <div className="mb-8 border-b border-[#eee] pb-4">
            <div className="h-4 w-24 bg-[#eee]" />
            <div className="mt-2 h-10 w-48 bg-[#eee]" />
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-8">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-8 border-b border-[#eee] pb-8">
                  <div className="h-[120px] w-[120px] shrink-0 bg-[#eee]" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-1/3 bg-[#eee]" />
                    <div className="h-4 w-1/4 bg-[#eee]" />
                  </div>
                </div>
              ))}
            </div>
            <div className="h-64 bg-[#f5f5f5]" />
          </div>
        </div>
      </div>
    )
  }

  const shipping = subtotal === 0 ? 0 : subtotal >= 100000 ? 0 : 4000
  const total = Math.max(0, subtotal + shipping)

  return (
    <div className="min-h-screen bg-dot-bg px-4 py-28 md:px-16 md:py-48">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 lg:grid-cols-[1.5fr_1fr]">
        <header className="col-span-full mb-8 border-b border-[#eee] pb-4">
          <h1 className="mt-2 font-sans text-[2.5rem] font-semibold tracking-normal text-dot-primary">
            장바구니
          </h1>
        </header>

        {!items || items.length === 0 ? (
          <div className="col-span-full py-24 text-center">
            <h2 className="mx-auto max-w-[260px] break-keep font-sans text-2xl font-semibold leading-snug text-dot-primary">
              장바구니가 비어 있습니다.
            </h2>
            <p className="mx-auto mt-4 mb-12 max-w-[320px] break-keep text-[0.95rem] leading-relaxed text-dot-secondary">
              DOT의 제품을 둘러보고
              <br />
              마음에 드는 작품을 담아보세요.
            </p>
            <Link
              to="/shop"
              className="inline-block border border-dot-primary px-8 py-4 text-[0.95rem] font-medium text-dot-primary no-underline transition-colors hover:bg-dot-primary hover:text-white!"
            >
              제품 보러가기
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-8">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[28px_120px_1fr] gap-4 border-b border-[#eee] pb-6 md:grid-cols-[28px_120px_1fr_auto] md:items-center md:gap-8 md:pb-8"
                >
                  <div className="pt-2">
                    <label className="flex cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(item.id)}
                        onChange={() => {
                          setHasUserTouchedSelection(true)
                          setUserSelectedCartItemIds((prev) => {
                            // prev가 비어있으면(첫 터치) 전부 선택 상태에서 토글 시작
                            const base = hasUserTouchedSelection
                              ? prev
                              : items.map((i) => i.id)
                            const set = new Set(base)
                            if (set.has(item.id)) set.delete(item.id)
                            else set.add(item.id)
                            return Array.from(set)
                          })
                        }}
                        aria-label="상품 선택"
                      />
                    </label>
                  </div>
                  <Link
                    to={`/shop/${item.product.slug}`}
                    className="block h-[120px] w-[120px] shrink-0 overflow-hidden rounded-sm bg-[#F2F2F2]"
                  >
                    <img
                      src={item.product.images?.[0]?.url}
                      alt={item.product.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </Link>
                  <div>
                    {item.product.category && (
                      <span className="mono mb-1 block text-[0.6rem] text-dot-accent">
                        {item.product.category.name}
                      </span>
                    )}
                    <h3 className="font-serif text-[1.1rem] font-normal tracking-[0.05em] text-dot-primary">
                      {item.product.name}
                    </h3>
                    {item.option && (
                      <p className="mt-1 text-[0.9rem] text-dot-secondary">
                        {item.option.name}: {item.option.value}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-4 rounded border border-[#eee] bg-white px-3 py-1.5 w-fit">
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            id: item.id,
                            quantity: Math.max(1, item.quantity - 1),
                          })
                        }
                        className="flex items-center justify-center text-dot-primary hover:opacity-70"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="min-w-6 text-center text-[0.9rem]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            id: item.id,
                            quantity: item.quantity + 1,
                          })
                        }
                        className="flex items-center justify-center text-dot-primary hover:opacity-70"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="col-span-3 mt-4 flex flex-row items-center justify-between gap-4 md:col-span-1 md:mt-0 md:flex-col md:items-end">
                    <ProductPrice
                      product={item.product}
                      quantity={item.quantity}
                      className="justify-end text-[1.1rem] font-medium text-dot-primary"
                      originalClassName="text-[0.85rem] font-normal"
                      rateClassName="text-[0.85rem]"
                    />
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(item.id)}
                      className="mono whitespace-nowrap text-[0.8rem] text-dot-secondary underline transition-colors hover:text-dot-primary"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <aside className="h-fit bg-white p-8 lg:sticky lg:top-28">
              <h2 className="mono mb-8 border-b border-[#eee] pb-4 text-[1.5rem] font-normal tracking-[0.12em] text-dot-primary">
                주문 요약
              </h2>
              <div className="space-y-4 text-[0.95rem]">
                <div className="flex justify-between">
                  <span>소계</span>
                  <span>₩{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>배송비</span>
                  <span>
                    {shipping === 0 ? '무료' : `₩${shipping.toLocaleString()}`}
                  </span>
                </div>
              </div>
              <div className="mt-8 flex justify-between border-t border-[#eee] pt-6 text-[1.2rem] font-medium">
                <span>예상 총액</span>
                <span>₩{total.toLocaleString()}</span>
              </div>

              <p className="mt-6 text-sm leading-relaxed text-dot-secondary">
                배송지에 따른 최종 배송비는 네이버 주문서에서 확인해 주세요.
                사이트 쿠폰은 네이버페이 주문에 사용할 수 없습니다.
              </p>
              <div className="mt-6">
                <NaverOrderButton
                  items={selectedItems.map((item) => ({
                    productId: item.productId,
                    optionId: item.optionId,
                    quantity: item.quantity,
                  }))}
                  disabled={
                    !selectedItems.length ||
                    updateMutation.isPending ||
                    removeMutation.isPending
                  }
                />
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  )
}
