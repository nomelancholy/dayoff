import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { isAxiosError } from 'axios'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchProduct,
  addToCart,
  deleteMyReview,
  fetchMyRestockNotificationStatus,
  subscribeRestockNotification,
  type ProductReview,
  type ProductReviewImage,
} from '../api/shop'
import { fetchMe, getStoredToken } from '@/features/auth/api/auth'
import { useUiStore } from '@/common/store/ui'
import { cn } from '@/common/lib/utils'
import { CHECKOUT_ENABLED } from '@/common/config/featureFlags'
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from 'lucide-react'
import { ProductReviewEditForm } from '@/features/shop/components/ProductReviewEditForm'
import { ProductPrice } from '@/features/shop/components/ProductPrice'

type ProductGuideKey =
  | 'purchaseNotice'
  | 'shippingNotice'
  | 'exchangeReturnNotice'
  | 'careGuide'

type ProductGuideGroupKey = 'productGuide' | 'shippingReturns'
type ProductTabKey = 'reviews' | ProductGuideGroupKey

const hasGuideText = (value?: string | null) => !!value?.trim()

export const ShopProductPage = () => {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [quantity, setQuantity] = useState(1)
  const [selectedOptionId, setSelectedCategoryId] = useState<
    string | undefined
  >()
  const [mainImageIndex, setMainImageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<ProductTabKey>('productGuide')
  const [isOptionMenuOpen, setIsOptionMenuOpen] = useState(false)
  const token = getStoredToken()
  const checkoutFlowRequestedRef = useRef(false)
  const cartToastRequestedRef = useRef(false)
  const toastAnchorRef = useRef<{ x: number; y: number } | null>(null)
  const optionMenuRef = useRef<HTMLDivElement | null>(null)
  const galleryTouchStartXRef = useRef<number | null>(null)
  const galleryDidSwipeRef = useRef(false)
  const productLightboxTouchStartXRef = useRef<number | null>(null)
  const [productLightboxIndex, setProductLightboxIndex] = useState<
    number | null
  >(null)

  const [reviewLightbox, setReviewLightbox] = useState<{
    images: ProductReviewImage[]
    index: number
  } | null>(null)

  const [editingReview, setEditingReview] = useState<ProductReview | null>(null)

  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    enabled: !!token,
  })
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    setMainImageIndex(0)
    setActiveTab('productGuide')
    setProductLightboxIndex(null)
  }, [slug])

  useEffect(() => {
    if (!reviewLightbox) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setReviewLightbox(null)
        return
      }
      if (e.key === 'ArrowLeft') {
        setReviewLightbox((prev) => {
          if (!prev) return prev
          const len = prev.images.length
          if (len <= 1) return prev
          return { ...prev, index: (prev.index - 1 + len) % len }
        })
      }
      if (e.key === 'ArrowRight') {
        setReviewLightbox((prev) => {
          if (!prev) return prev
          const len = prev.images.length
          if (len <= 1) return prev
          return { ...prev, index: (prev.index + 1) % len }
        })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [reviewLightbox])

  useEffect(() => {
    if (!isOptionMenuOpen) return

    const onPointerDown = (e: PointerEvent) => {
      if (!optionMenuRef.current) return
      if (!optionMenuRef.current.contains(e.target as Node)) {
        setIsOptionMenuOpen(false)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOptionMenuOpen(false)
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOptionMenuOpen])

  const openReviewLightbox = (images: ProductReviewImage[], index: number) => {
    if (!images.length) return
    setReviewLightbox({ images, index })
  }

  const closeReviewLightbox = () => setReviewLightbox(null)

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId: string) => deleteMyReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'product', slug] })
      queryClient.invalidateQueries({ queryKey: ['shop', 'my-reviews'] })
      setEditingReview(null)
      alert('리뷰가 삭제되었습니다.')
    },
    onError: (err: unknown) => {
      alert(err instanceof Error ? err.message : '리뷰 삭제에 실패했습니다.')
    },
  })

  const {
    data: product,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['shop', 'product', slug],
    queryFn: () => fetchProduct(slug!),
    enabled: !!slug,
  })

  useEffect(() => {
    if (productLightboxIndex === null) return

    const imageCount = product?.images?.length ?? 0
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProductLightboxIndex(null)
        return
      }
      if (imageCount <= 1) return
      if (event.key === 'ArrowLeft') {
        setProductLightboxIndex((current) =>
          current === null ? current : (current - 1 + imageCount) % imageCount
        )
      }
      if (event.key === 'ArrowRight') {
        setProductLightboxIndex((current) =>
          current === null ? current : (current + 1) % imageCount
        )
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [productLightboxIndex, product?.images?.length])

  const showToast = useUiStore((s) => s.showToast)
  const hasOptions = !!(product?.options && product.options.length > 0)
  const isSoldOut = (product?.stockQuantity ?? 0) <= 0
  const { data: restockStatus } = useQuery({
    queryKey: ['shop', 'restock-notification', product?.id, user?.id],
    queryFn: () => fetchMyRestockNotificationStatus(product!.id),
    enabled: !!token && !!user?.id && !!product?.id && isSoldOut,
  })

  const restockMutation = useMutation({
    mutationFn: () => subscribeRestockNotification(product!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['shop', 'restock-notification', product?.id, user?.id],
      })
      showToast({
        variant: 'success',
        message: '재입고 알림 메일 신청이 완료되었습니다.',
      })
    },
    onError: (err: unknown) => {
      const message = isAxiosError(err)
        ? err.response?.data?.message
        : undefined
      showToast({
        variant: 'warning',
        message: message || '재입고 알림 신청에 실패했습니다.',
      })
    },
  })

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
      // 옵션 미선택 경고: alert 대신 "클릭 근처" 토스트로 안내합니다.
      cartToastRequestedRef.current = false
      checkoutFlowRequestedRef.current = false
      const anchor = toastAnchorRef.current
      toastAnchorRef.current = null
      showToast({
        variant: 'warning',
        message: '옵션을 선택해 주세요.',
        ...(anchor ? { anchor } : {}),
      })
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
  const showPreviousImage = () => {
    if (images.length <= 1) return
    setMainImageIndex((current) =>
      current === 0 ? images.length - 1 : current - 1
    )
  }
  const showNextImage = () => {
    if (images.length <= 1) return
    setMainImageIndex((current) =>
      current === images.length - 1 ? 0 : current + 1
    )
  }
  const selectedOption =
    product.options?.find((opt) => opt.id === selectedOptionId) ?? null
  const selectedOptionLabel = selectedOption
    ? `${selectedOption.name}: ${selectedOption.value}`
    : '옵션을 선택해 주세요'
  const guideSections: Array<{
    key: ProductGuideKey
    label: string
    body: string | null | undefined
  }> = [
    {
      key: 'purchaseNotice' as const,
      label: 'PLEASE NOTE',
      body: product.purchaseNotice,
    },
    {
      key: 'shippingNotice' as const,
      label: 'SHIPPING',
      body: product.shippingNotice,
    },
    {
      key: 'exchangeReturnNotice' as const,
      label: 'RETURNS / EXCHANGES',
      body: product.exchangeReturnNotice,
    },
    {
      key: 'careGuide' as const,
      label: 'CARE GUIDE',
      body: product.careGuide ?? product.handlingNotice,
    },
  ]
  const guideGroups: Array<{
    key: ProductGuideGroupKey
    label: string
    sections: typeof guideSections
  }> = [
    {
      key: 'productGuide',
      label: 'PRODUCT GUIDE',
      sections: [guideSections[0], guideSections[3]],
    },
    {
      key: 'shippingReturns',
      label: 'SHIPPING & RETURNS',
      sections: [guideSections[1], guideSections[2]],
    },
  ]
  const productTabs: Array<{ id: ProductTabKey; label: string }> = [
    ...guideGroups.map(({ key, label }) => ({ id: key, label })),
    {
      id: 'reviews',
      label: `REVIEWS ${product.reviews?.length ? `(${product.reviews.length})` : ''}`,
    },
  ]
  const activeGuideGroup = guideGroups.find((group) => group.key === activeTab)

  return (
    <div className="min-h-screen bg-dot-bg">
      <div className="mx-auto max-w-[1400px] px-4 py-28 md:px-16 md:py-48 md:pb-40">
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
          {/* Gallery - main carousel with arrows, swipe and thumbnail navigation */}
          <div className="flex flex-col gap-4">
            <div className="relative mx-8 lg:mx-0">
              <div
                className="aspect-square overflow-hidden rounded-sm bg-[#F2F2F2]"
                onTouchStart={(event) => {
                  galleryTouchStartXRef.current =
                    event.touches[0]?.clientX ?? null
                }}
                onTouchEnd={(event) => {
                  const startX = galleryTouchStartXRef.current
                  const endX = event.changedTouches[0]?.clientX
                  galleryTouchStartXRef.current = null
                  galleryDidSwipeRef.current = false
                  if (startX == null || endX == null) return
                  const distance = endX - startX
                  if (Math.abs(distance) < 50) return
                  galleryDidSwipeRef.current = true
                  if (distance > 0) showPreviousImage()
                  else showNextImage()
                }}
              >
                {mainImage ? (
                  <button
                    type="button"
                    className="block h-full w-full cursor-zoom-in"
                    aria-label={`${product.name} 이미지 크게 보기`}
                    onClick={() => {
                      if (galleryDidSwipeRef.current) {
                        galleryDidSwipeRef.current = false
                        return
                      }
                      setProductLightboxIndex(mainImageIndex)
                    }}
                  >
                    <img
                      key={mainImage.id}
                      src={mainImage.url}
                      alt={mainImage.alt || product.name}
                      fetchPriority="high"
                      className="h-full w-full animate-in fade-in object-cover duration-300"
                    />
                  </button>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm uppercase tracking-widest text-[#999] md:text-base">
                    No Image
                  </div>
                )}
                {images.length > 1 && (
                  <span className="mono absolute bottom-4 right-4 rounded-full bg-black/55 px-3 py-1.5 text-xs tracking-[0.08em] text-white backdrop-blur-sm">
                    {mainImageIndex + 1} / {images.length}
                  </span>
                )}
              </div>

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={showPreviousImage}
                    aria-label="이전 상품 이미지"
                    className="absolute -left-14 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-dot-primary transition-opacity hover:opacity-55 md:h-12 md:w-12"
                  >
                    <ChevronLeft size={28} strokeWidth={1.25} />
                  </button>
                  <button
                    type="button"
                    onClick={showNextImage}
                    aria-label="다음 상품 이미지"
                    className="absolute -right-14 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-dot-primary transition-opacity hover:opacity-55 md:h-12 md:w-12"
                  >
                    <ChevronRight size={28} strokeWidth={1.25} />
                  </button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setMainImageIndex(idx)}
                    aria-label={`${idx + 1}번째 상품 이미지 보기`}
                    aria-current={mainImageIndex === idx}
                    className={cn(
                      'aspect-square w-20 shrink-0 overflow-hidden rounded-sm bg-[#F2F2F2] transition-opacity md:w-24',
                      mainImageIndex === idx
                        ? 'border border-dot-primary opacity-100'
                        : 'opacity-60 hover:opacity-80'
                    )}
                  >
                    <img
                      src={img.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
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
            <h1 className="mono text-xl font-normal leading-tight tracking-[0.08em] text-dot-primary md:text-2xl">
              {product.name}
            </h1>
            <ProductPrice
              product={product}
              format="won"
              className="mono mt-4 text-base font-normal tracking-[0.04em] text-dot-primary md:text-lg"
              originalClassName="text-sm md:text-base"
              rateClassName="text-sm md:text-base"
              saleClassName="font-medium"
            />
            {isSoldOut && (
              <p className="mt-3 text-sm font-medium tracking-[0.08em] text-[#8A5A44] md:text-base">
                품절된 상품입니다.
              </p>
            )}
            {product.description ? (
              <p className="mono mt-12 whitespace-pre-line text-base font-normal leading-relaxed text-dot-secondary md:text-lg">
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
                  <div className="relative" ref={optionMenuRef}>
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={isOptionMenuOpen}
                      onClick={() => setIsOptionMenuOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-sm border border-[#E9E5DC] bg-transparent px-4 py-4 text-left text-base text-dot-primary transition-colors hover:border-dot-primary/60 focus:border-dot-primary focus:outline-none focus:ring-2 focus:ring-dot-primary/15 md:text-lg"
                    >
                      <span
                        className={cn(
                          !selectedOptionId && 'text-dot-secondary'
                        )}
                      >
                        {selectedOptionLabel}
                      </span>
                      <ChevronDown
                        size={18}
                        className={cn(
                          'shrink-0 text-dot-secondary transition-transform duration-200',
                          isOptionMenuOpen && 'rotate-180'
                        )}
                      />
                    </button>
                    {isOptionMenuOpen && (
                      <div
                        role="listbox"
                        className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-64 overflow-y-auto rounded-sm border border-[#E9E5DC] bg-dot-bg shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
                      >
                        {product.options.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setSelectedCategoryId(opt.id)
                              setIsOptionMenuOpen(false)
                            }}
                            className={cn(
                              'block w-full px-4 py-3 text-left text-[0.95rem] transition-colors',
                              selectedOptionId === opt.id
                                ? 'bg-[#F4F1EB] text-dot-primary'
                                : 'text-dot-secondary hover:bg-[#F7F5F1] hover:text-dot-primary'
                            )}
                          >
                            {opt.name}: {opt.value}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
              {isSoldOut && (
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      if (!getStoredToken()) {
                        showToast({
                          variant: 'warning',
                          message:
                            '로그인 후 재입고 알림을 신청할 수 있습니다.',
                        })
                        navigate('/login')
                        return
                      }
                      if (restockStatus?.subscribed) return
                      restockMutation.mutate()
                    }}
                    disabled={
                      restockMutation.isPending || !!restockStatus?.subscribed
                    }
                    className="mono w-full border border-[#1f1f1f] bg-[#1f1f1f] px-5 py-3 text-sm tracking-[0.08em] text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-70 md:py-4 md:text-base"
                  >
                    {restockStatus?.subscribed
                      ? '재입고 알림 신청 완료'
                      : restockMutation.isPending
                        ? '신청 중...'
                        : '재입고 메일 받기'}
                  </button>
                </div>
              )}
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
                      checkoutFlowRequestedRef.current = false
                      const anchor = toastAnchorRef.current
                      toastAnchorRef.current = null
                      showToast({
                        variant: 'warning',
                        message: '옵션을 선택해 주세요.',
                        ...(anchor ? { anchor } : {}),
                      })
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
                  disabled={
                    !CHECKOUT_ENABLED || cartMutation.isPending || isSoldOut
                  }
                  className="mono bg-dot-primary py-3 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-50 md:py-4 md:text-base"
                >
                  {CHECKOUT_ENABLED ? '구매하기' : '구매 준비 중'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs - reference: product-tabs-container, tabs-header sticky, tab-content */}
        <section className="mt-32 border-t border-[#eee]">
          <div
            role="tablist"
            aria-label="상품 상세 정보"
            className="mono sticky top-20 z-800 flex justify-start gap-3 overflow-x-auto border-b border-[#eee] bg-dot-bg px-2 md:justify-center md:gap-6 md:px-0"
          >
            {productTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative shrink-0 whitespace-nowrap border-none bg-transparent px-3 py-6 text-sm transition-colors focus:outline-none focus-visible:outline-none md:px-4 md:text-base',
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

          {activeGuideGroup && (
            <div
              role="tabpanel"
              className="mx-auto min-h-56 max-w-[1000px] py-16"
            >
              {activeGuideGroup.key === 'shippingReturns' ? (
                <div className="divide-y divide-[#eee] border-y border-[#eee]">
                  {activeGuideGroup.sections.map((section) => (
                    <details key={section.key} className="group">
                      <summary className="mono flex cursor-pointer list-none items-center justify-between py-7 text-lg tracking-[0.08em] text-dot-primary [&::-webkit-details-marker]:hidden md:text-xl">
                        <span>{section.label}</span>
                        <ChevronDown
                          size={20}
                          className="shrink-0 text-dot-secondary transition-transform duration-200 group-open:rotate-180"
                        />
                      </summary>
                      <p
                        className={cn(
                          'whitespace-pre-line pb-8 text-base font-light leading-relaxed md:text-lg',
                          hasGuideText(section.body)
                            ? 'text-dot-primary'
                            : 'text-dot-secondary'
                        )}
                      >
                        {hasGuideText(section.body)
                          ? section.body
                          : '안내 문구가 준비 중입니다.'}
                      </p>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-[#eee]">
                  {activeGuideGroup.sections.map((section) => (
                    <section
                      key={section.key}
                      className="py-10 first:pt-0 last:pb-0"
                    >
                      <h3 className="mono text-lg tracking-[0.08em] text-dot-primary md:text-xl">
                        {section.label}
                      </h3>
                      <p
                        className={cn(
                          'mt-6 whitespace-pre-line text-base font-light leading-relaxed md:text-lg',
                          hasGuideText(section.body)
                            ? 'text-dot-primary'
                            : 'text-dot-secondary'
                        )}
                      >
                        {hasGuideText(section.body)
                          ? section.body
                          : '안내 문구가 준비 중입니다.'}
                      </p>
                    </section>
                  ))}
                </div>
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
                          {review.images.map((img, idx) => (
                            <button
                              key={img.id}
                              type="button"
                              onClick={() =>
                                openReviewLightbox(review.images!, idx)
                              }
                              className="block h-28 w-28 overflow-hidden rounded border border-[#eee] bg-[#f9f9f9]"
                              aria-label="리뷰 사진 보기"
                            >
                              <img
                                src={img.url}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <span className="mono block text-sm text-dot-secondary md:text-base">
                          {review.user?.fullName ||
                            review.user?.email ||
                            '회원'}{' '}
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

                        {user?.id &&
                        review.user?.id &&
                        user.id === review.user.id ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingReview(review)}
                              className="rounded border border-dot-primary bg-white px-3 py-2 text-[0.75rem] font-medium text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm('이 리뷰를 삭제할까요?'))
                                  return
                                deleteReviewMutation.mutate(review.id)
                              }}
                              disabled={deleteReviewMutation.isPending}
                              className="rounded border border-[#ddd] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#1A1A1A] transition-colors hover:bg-[#fafafa] disabled:opacity-50"
                            >
                              삭제
                            </button>
                          </div>
                        ) : null}
                      </div>
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

      {productLightboxIndex !== null && images.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} 상품 이미지 크게 보기`}
          className="fixed inset-0 z-100000 flex items-center justify-center bg-black/85 p-4 md:p-8"
          onClick={() => setProductLightboxIndex(null)}
        >
          <div
            className="relative flex h-full w-full max-w-6xl items-center justify-center"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => {
              productLightboxTouchStartXRef.current =
                event.touches[0]?.clientX ?? null
            }}
            onTouchEnd={(event) => {
              const startX = productLightboxTouchStartXRef.current
              const endX = event.changedTouches[0]?.clientX
              productLightboxTouchStartXRef.current = null
              if (startX == null || endX == null || images.length <= 1) return
              const distance = endX - startX
              if (Math.abs(distance) < 50) return
              setProductLightboxIndex((current) => {
                if (current === null) return current
                return distance > 0
                  ? (current - 1 + images.length) % images.length
                  : (current + 1) % images.length
              })
            }}
          >
            <button
              type="button"
              aria-label="상품 이미지 팝업 닫기"
              className="absolute right-0 top-0 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/50 text-2xl text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white/50"
              onClick={() => setProductLightboxIndex(null)}
            >
              ×
            </button>

            <img
              src={images[productLightboxIndex]?.url}
              alt={
                images[productLightboxIndex]?.alt ||
                `${product.name} ${productLightboxIndex + 1}`
              }
              className="max-h-[88vh] max-w-full select-none object-contain"
            />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="이전 상품 이미지"
                  className="absolute left-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/75 md:left-2 md:h-12 md:w-12"
                  onClick={() =>
                    setProductLightboxIndex(
                      (productLightboxIndex - 1 + images.length) % images.length
                    )
                  }
                >
                  <ChevronLeft size={28} strokeWidth={1.4} />
                </button>
                <button
                  type="button"
                  aria-label="다음 상품 이미지"
                  className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/75 md:right-2 md:h-12 md:w-12"
                  onClick={() =>
                    setProductLightboxIndex(
                      (productLightboxIndex + 1) % images.length
                    )
                  }
                >
                  <ChevronRight size={28} strokeWidth={1.4} />
                </button>
                <span className="mono absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-xs tracking-[0.08em] text-white">
                  {productLightboxIndex + 1} / {images.length}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {reviewLightbox && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-100000 flex items-center justify-center bg-black/70 p-4"
          onClick={closeReviewLightbox}
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white shadow-lg backdrop-blur-sm hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/50"
              onClick={closeReviewLightbox}
            >
              ×
            </button>

            <div className="flex items-center justify-center">
              {reviewLightbox.images.length > 0 ? (
                <img
                  src={reviewLightbox.images[reviewLightbox.index]?.url}
                  alt=""
                  className="max-h-[80vh] w-full object-contain"
                />
              ) : null}
            </div>

            {reviewLightbox.images.length > 1 && (
              <>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <span className="text-[0.8rem] text-white/80">
                    {reviewLightbox.index + 1} / {reviewLightbox.images.length}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="이전"
                  className="absolute left-[-14px] top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white shadow-lg backdrop-blur-sm hover:bg-black/70"
                  onClick={() => {
                    setReviewLightbox((prev) => {
                      if (!prev) return prev
                      const len = prev.images.length
                      return { ...prev, index: (prev.index - 1 + len) % len }
                    })
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="다음"
                  className="absolute right-[-14px] top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white shadow-lg backdrop-blur-sm hover:bg-black/70"
                  onClick={() => {
                    setReviewLightbox((prev) => {
                      if (!prev) return prev
                      const len = prev.images.length
                      return { ...prev, index: (prev.index + 1) % len }
                    })
                  }}
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {editingReview && (
        <div
          className="fixed inset-0 z-100000 flex items-center justify-center bg-black/40 p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingReview(null)}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ProductReviewEditForm
              reviewId={editingReview.id}
              mode="my"
              initialBody={editingReview.body}
              initialRating={editingReview.rating}
              onCancel={() => setEditingReview(null)}
              onSuccess={() => {
                queryClient.invalidateQueries({
                  queryKey: ['shop', 'product', slug],
                })
                queryClient.invalidateQueries({
                  queryKey: ['shop', 'my-reviews'],
                })
                setEditingReview(null)
                alert('리뷰가 수정되었습니다.')
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
