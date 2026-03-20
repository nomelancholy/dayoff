import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { isAxiosError } from 'axios'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchProduct, addToCart } from '../api/shop'
import { fetchMe, getStoredToken } from '@/features/auth/api/auth'
import { useUiStore } from '@/common/store/ui'
import { cn } from '@/common/lib/utils'
import { ArrowLeft, Pencil } from 'lucide-react'

export const ShopProductPage = () => {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [quantity, setQuantity] = useState(1)
  const [selectedOptionId, setSelectedCategoryId] = useState<
    string | undefined
  >()
  const [mainImageIndex, setMainImageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<'detail' | 'reviews'>('detail')
  const token = getStoredToken()
  const checkoutFlowRequestedRef = useRef(false)
  const cartToastRequestedRef = useRef(false)
  const toastAnchorRef = useRef<{ x: number; y: number } | null>(null)

  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    enabled: !!token,
  })
  const isAdmin = user?.role === 'admin'

  const {
    data: product,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['shop', 'product', slug],
    queryFn: () => fetchProduct(slug!),
    enabled: !!slug,
  })

  const showToast = useUiStore((s) => s.showToast)
  const hasOptions = !!(product?.options && product.options.length > 0)
  const isSoldOut = (product?.stockQuantity ?? 0) <= 0

  const cartMutation = useMutation({
    mutationFn: () =>
      addToCart({
        productId: product?.id ?? '',
        quantity,
        optionId: selectedOptionId,
      }),
    onSuccess: (data) => {
      const shouldShowCartToast = cartToastRequestedRef.current
      cartToastRequestedRef.current = false
      const shouldNavigateToCheckout = checkoutFlowRequestedRef.current
      checkoutFlowRequestedRef.current = false
      const anchor = toastAnchorRef.current
      toastAnchorRef.current = null

      queryClient.invalidateQueries({ queryKey: ['shop', 'cart'] })
      if (shouldShowCartToast) {
        showToast({
          variant: 'success',
          message: '성공적으로 장바구니에 담겼습니다.',
          ...(anchor ? { anchor } : {}),
        })
      }

      if (shouldNavigateToCheckout) {
        navigate('/checkout', {
          state: {
            couponCode: null,
            cartItemIds: [data.id],
            cartItemQuantities: [quantity],
          },
        })
      }
    },
    onError: (err: unknown) => {
      if (isAxiosError(err) && err.response?.status === 401) {
        alert('로그인이 필요합니다.')
        navigate('/login')
      } else {
        const message = isAxiosError(err)
          ? err.response?.data?.message
          : undefined
        alert(message || '장바구니 담기에 실패했습니다.')
      }
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] px-6 py-32 md:px-16">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            <div className="aspect-square bg-[#eee]" />
            <div>
              <div className="h-4 w-24 bg-[#eee]" />
              <div className="mt-4 h-10 w-2/3 bg-[#eee]" />
              <div className="mt-8 h-6 w-32 bg-[#eee]" />
              <div className="mt-12 h-20 w-full bg-[#eee]" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] px-6 py-32 md:px-16 text-center">
        <p className="text-base text-[#666] md:text-lg">
          상품을 찾을 수 없거나 오류가 발생했습니다.
        </p>
        <Link
          to="/shop"
          className="mt-4 inline-block text-base text-dot-primary underline md:text-lg"
        >
          SHOP으로 돌아가기
        </Link>
      </div>
    )
  }

  const handleAddToCart = () => {
    // 장바구니 담기에서는 checkout 주문 생성이 절대 일어나면 안 됩니다.
    checkoutFlowRequestedRef.current = false
    if (!getStoredToken()) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }
    if (!product) {
      alert('상품 정보를 불러오는 중입니다.')
      return
    }

    if (hasOptions && !selectedOptionId) {
      alert('옵션을 선택해 주세요.')
      return
    }

    if (isSoldOut) {
      alert('품절된 상품입니다.')
      return
    }
    cartMutation.mutate()
  }

  const captureToastAnchor = (e: MouseEvent) => {
    // 토스트가 버튼 "아래"에 오도록 약간 아래로 오프셋
    toastAnchorRef.current = { x: e.clientX + 77, y: e.clientY + 60 }
  }

  const images = product.images?.length ? product.images : []
  const mainImage = images[mainImageIndex]

  return (
    <div className="min-h-screen bg-dot-bg">
      <div className="mx-auto max-w-[1400px] px-6 py-48 md:px-16 md:pb-40">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/shop"
            className="mono flex items-center gap-2 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:opacity-70 md:text-base"
          >
            <ArrowLeft size={16} />
            상품 목록으로
          </Link>
          {isAdmin && (
            <Link
              to={`/shop/admin/edit/${product.id}`}
              className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.25em] text-dot-primary transition-colors hover:underline md:text-base"
            >
              <Pencil size={14} />
              Edit
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1.2fr_1fr]">
          {/* Gallery - reference: product-gallery, main-img aspect 1/1, thumbnail-list 4 cols */}
          <div className="flex flex-col gap-4">
            <div className="aspect-square overflow-hidden rounded-sm bg-[#F2F2F2]">
              {mainImage ? (
                <img
                  src={mainImage.url}
                  alt={mainImage.alt || product.name}
                  className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm uppercase tracking-widest text-[#999] md:text-base">
                  No Image
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setMainImageIndex(idx)}
                    className={cn(
                      'aspect-square overflow-hidden rounded-sm bg-[#F2F2F2] transition-opacity',
                      mainImageIndex === idx
                        ? 'border border-dot-primary opacity-100'
                        : 'opacity-60 hover:opacity-80'
                    )}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info - reference: breadcrumb mono, product-title 3rem, product-price 1.5rem, product-desc */}
          <div className="flex flex-col">
            <nav className="mono mb-8 text-sm tracking-[0.15em] text-dot-secondary md:text-base">
              <Link to="/shop" className="hover:text-dot-primary">
                SHOP
              </Link>
              {' / '}
              {product.category?.name && (
                <>
                  <span>{product.category.name}</span>
                  {' / '}
                </>
              )}
              <span>{product.name}</span>
            </nav>
            <h1 className="font-serif text-3xl font-normal leading-tight tracking-[0.12em] text-dot-primary md:text-4xl">
              {product.name}
            </h1>
            <div className="mt-4 text-xl font-light text-dot-primary md:text-2xl">
              ₩{product.price.toLocaleString()}
            </div>
            {product.description ? (
              <p className="mt-12 whitespace-pre-line text-base font-light leading-relaxed text-dot-secondary md:text-lg">
                {product.description}
              </p>
            ) : null}

            {/* Purchase Options - reference: border-top, option-row, qty, action-btns */}
            <div className="mt-12 border-t border-[#eee] pt-12">
              {product.options && product.options.length > 0 && (
                <div className="mb-8">
                  <label className="mono mb-3 block text-sm tracking-[0.15em] text-dot-primary md:text-base">
                    OPTIONS
                  </label>
                  <select
                    value={selectedOptionId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full border border-[#eee] bg-white px-4 py-4 text-base focus:border-dot-primary focus:outline-none md:text-lg"
                  >
                    <option value="">Select an option</option>
                    {product.options.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}: {opt.value}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-8">
                <label className="mono mb-3 block text-sm font-medium tracking-[0.12em] text-dot-primary md:text-base">
                  수량
                </label>
                <div className="flex w-fit items-center gap-6 border border-[#eee] bg-white px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="flex min-h-9 min-w-9 items-center justify-center text-base leading-none text-dot-primary hover:opacity-70 md:text-lg"
                  >
                    −
                  </button>
                  <span className="min-w-7 text-center text-sm font-semibold tabular-nums md:text-base">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="flex min-h-9 min-w-9 items-center justify-center text-base leading-none text-dot-primary hover:opacity-70 md:text-lg"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <button
                  type="button"
                  onClick={(e) => {
                    captureToastAnchor(e)
                    cartToastRequestedRef.current = true
                    handleAddToCart()
                  }}
                  disabled={cartMutation.isPending || isSoldOut}
                  className="mono border border-dot-primary bg-white py-3 text-sm font-semibold tracking-wide text-dot-primary transition-colors hover:bg-dot-primary hover:text-white disabled:opacity-50 md:py-4 md:text-base"
                >
                  {cartMutation.isPending ? '담는 중…' : '장바구니 담기'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    captureToastAnchor(e)
                    cartToastRequestedRef.current = false
                    if (!getStoredToken()) {
                      alert('로그인이 필요합니다.')
                      navigate('/login')
                      return
                    }
                    if (!product) {
                      alert('상품 정보를 불러오는 중입니다.')
                      return
                    }

                    if (hasOptions && !selectedOptionId) {
                      alert('옵션을 선택해 주세요.')
                      return
                    }

                    checkoutFlowRequestedRef.current = true
                    if (isSoldOut) {
                      alert('품절된 상품입니다.')
                      checkoutFlowRequestedRef.current = false
                      return
                    }
                    cartMutation.mutate()
                  }}
                  disabled={cartMutation.isPending || isSoldOut}
                  className="mono bg-dot-primary py-3 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-50 md:py-4 md:text-base"
                >
                  구매하기
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs - reference: product-tabs-container, tabs-header sticky, tab-content */}
        <section className="mt-32 border-t border-[#eee]">
          <div className="mono sticky top-20 z-800 flex justify-center gap-12 border-b border-[#eee] bg-dot-bg md:gap-16">
            {[
              { id: 'detail' as const, label: 'DETAIL' },
              {
                id: 'reviews' as const,
                label: `REVIEWS ${product.reviews?.length ? `(${product.reviews.length})` : ''}`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative border-none bg-transparent px-4 py-6 text-base transition-colors focus:outline-none focus-visible:outline-none md:text-lg',
                  activeTab === tab.id
                    ? 'font-medium text-dot-primary'
                    : 'text-dot-secondary hover:text-dot-primary'
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full bg-dot-primary" />
                )}
              </button>
            ))}
          </div>

          {activeTab === 'detail' && (
            <div className="mx-auto max-w-[1000px] py-16">
              {product.detailImages && product.detailImages.length > 0 && (
                <div className="flex flex-col gap-0">
                  {product.detailImages.map((img) => (
                    <img
                      key={img.id}
                      src={img.url}
                      alt={img.alt || product.name}
                      className="w-full object-contain"
                    />
                  ))}
                </div>
              )}
              {product.purchaseNotice && (
                <div className="mt-12">
                  <h3 className="mono mb-4 text-base text-dot-primary md:text-lg">
                    구매 전 안내사항
                  </h3>
                  <p className="whitespace-pre-line text-base leading-relaxed text-dot-secondary md:text-lg">
                    {product.purchaseNotice}
                  </p>
                </div>
              )}
              {product.handlingNotice && (
                <div className="mt-8">
                  <h3 className="mono mb-4 text-base text-dot-primary md:text-lg">
                    취급 및 구매 주의사항
                  </h3>
                  <p className="whitespace-pre-line text-base leading-relaxed text-dot-secondary md:text-lg">
                    {product.handlingNotice}
                  </p>
                </div>
              )}
              {!product.detailImages?.length &&
                !product.purchaseNotice &&
                !product.handlingNotice && (
                  <p className="text-base text-dot-secondary md:text-lg">
                    No additional details.
                  </p>
                )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="mx-auto max-w-[1000px] py-16">
              <h3 className="mono text-center text-xl text-dot-primary md:text-2xl">
                CUSTOMER REVIEWS
              </h3>
              {product.reviews && product.reviews.length > 0 ? (
                <ul className="mt-16 flex flex-col gap-8 text-left">
                  {product.reviews.map((review) => (
                    <li
                      key={review.id}
                      className="border-b border-[#eee] pb-8 last:border-0"
                    >
                      {review.rating != null && (
                        <div
                          className="mb-2 flex gap-0.5 text-amber-500"
                          aria-label={`별점 ${review.rating}점`}
                        >
                          {[1, 2, 3, 4, 5].map((i) => (
                            <span
                              key={i}
                              className="text-xl leading-none md:text-2xl"
                            >
                              {i <= review.rating! ? '★' : '☆'}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-lg leading-relaxed text-dot-primary md:text-xl">
                        {review.body}
                      </p>
                      {review.images && review.images.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-3">
                          {review.images.map((img) => (
                            <a
                              key={img.id}
                              href={img.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block h-28 w-28 overflow-hidden rounded border border-[#eee] bg-[#f9f9f9]"
                            >
                              <img
                                src={img.url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      <span className="mono mt-4 block text-sm text-dot-secondary md:text-base">
                        {review.user?.fullName || review.user?.email || '회원'}{' '}
                        |{' '}
                        {new Date(review.createdAt).toLocaleDateString(
                          'ko-KR',
                          {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          }
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-16 text-center text-base text-dot-secondary md:text-lg">
                  아직 구매평이 없습니다.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
