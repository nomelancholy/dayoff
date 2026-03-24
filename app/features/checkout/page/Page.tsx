import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { createNaverCheckout, type CreateNaverCheckoutResponse } from '../api/checkout'
import {
  fetchAddresses,
  getStoredToken,
  getApiErrorMessage,
} from '@/features/auth/api/auth'
import { fetchCartItems } from '@/features/shop/api/shop'
import { isOutOfDeliveryPostalCode } from '@/common/lib/outOfDeliveryAreas'

type NaverPay = {
  open: (params: {
    merchantUserKey: string
    merchantPayKey: string
    productName: string
    productCount: number
    totalPayAmount: number
    taxScopeAmount: number
    taxExScopeAmount: number
    returnUrl: string
    productItems: Array<{
      categoryType: string
      categoryId: string
      uid: string
      name: string
      payReferrer: string
      count: number
    }>
  }) => void
}

type NaverPayFactory = {
  create: (params: {
    mode: 'development' | 'production'
    payType: 'normal'
    clientId: string
    chainId: string
    openType: 'page'
  }) => NaverPay
}

declare global {
  interface Window {
    Naver?: {
      Pay: NaverPayFactory
    }
  }
}

function toCheckoutPageErrorMessage(err: unknown): string {
  const fallback =
    '결제 준비에 실패했습니다. 잠시 후 다시 시도해 주세요.'

  let rawMessage: string | null = null
  if (isAxiosError(err)) {
    const apiMessage = err.response?.data?.message
    if (Array.isArray(apiMessage)) {
      rawMessage = apiMessage.filter(Boolean).join(' ')
    } else if (typeof apiMessage === 'string') {
      rawMessage = apiMessage
    }
  }

  const candidate = rawMessage ?? getApiErrorMessage(err, fallback)
  const normalized = candidate.toLowerCase()

  if (
    normalized.includes('shippingaddressid must be a string') ||
    candidate.includes('배송지를 선택해 주세요.')
  ) {
    return '배송지 선택 정보가 만료되었습니다. 배송지를 다시 선택한 뒤 결제를 다시 시도해 주세요.'
  }

  return candidate
}

function loadNaverPayScript() {
  const existing = document.getElementById('naverpay-sdk')
  if (existing) {
    if (window.Naver?.Pay) return Promise.resolve()
    // 스크립트 태그는 남아있지만 객체가 안 올라온 케이스(부분 로드)를 대비
    existing.remove()
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = 'naverpay-sdk'
    script.src = 'https://nsp.pay.naver.com/sdk/js/naverpay.min.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('NaverPay SDK 로드 실패'))
    document.body.appendChild(script)
  })
}

export const CheckoutPage = () => {
  const token = getStoredToken()
  const navigate = useNavigate()
  const location = useLocation()

  const state =
    (location.state as {
      couponCode?: string | null
      cartItemIds?: string[]
      cartItemQuantities?: number[]
    } | null) ?? null
  const couponCode = state?.couponCode ?? null
  const cartItemIds = state?.cartItemIds ?? []
  const cartItemQuantities = state?.cartItemQuantities

  const {
    data: addresses,
    isLoading: addressesLoading,
    isError: addressesIsError,
    isFetching: addressesFetching,
  } = useQuery({
    queryKey: ['auth', 'addresses'],
    queryFn: fetchAddresses,
    enabled: !!token,
    staleTime: 0,
    refetchOnMount: true,
  })

  const [initData, setInitData] = useState<CreateNaverCheckoutResponse | null>(null)
  const [widgetsReady, setWidgetsReady] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [initRetryNonce, setInitRetryNonce] = useState(0)

  const naverPayRef = useRef<NaverPay | null>(null)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const didAutoRedirectToAddressRef = useRef(false)
  const lastCreateKeyRef = useRef<string | null>(null)

  const {
    data: cartItems,
    isLoading: cartItemsLoading,
  } = useQuery({
    queryKey: ['shop', 'cart', 'checkout', cartItemIds],
    queryFn: fetchCartItems,
    enabled: !!token && cartItemIds.length > 0,
    staleTime: 60_000,
  })

  const selectedAddress = useMemo(
    () => addresses?.find((a) => a.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  )

  const selectedCartItemsSubtotal = useMemo(() => {
    if (!cartItems || cartItems.length === 0) return 0
    const selectedSet = new Set(cartItemIds)
    const quantitiesById =
      cartItemQuantities && cartItemQuantities.length === cartItemIds.length
        ? new Map(cartItemIds.map((id, idx) => [id, cartItemQuantities[idx]]))
        : null
    return cartItems
      .filter((ci) => selectedSet.has(ci.id))
      .reduce((sum, item) => {
        const purchaseQty = quantitiesById?.get(item.id) ?? item.quantity
        return sum + item.product.price * purchaseQty
      }, 0)
  }, [cartItems, cartItemIds, cartItemQuantities])

  const selectedShippingFee = useMemo(() => {
    const subtotal = selectedCartItemsSubtotal
    const postalCode = selectedAddress?.postalCode

    if (subtotal === 0) return 0
    if (subtotal >= 100000) return 0
    return isOutOfDeliveryPostalCode(postalCode) ? 5000 : 4000
  }, [selectedCartItemsSubtotal, selectedAddress?.postalCode])

  const createMutation = useMutation({
    mutationFn: () => {
      // 모바일 뒤로가기 등으로 선택 상태가 유실되면 서버 DTO 에러 대신 UX 메시지를 먼저 보여줍니다.
      if (!selectedAddressId || !selectedAddressId.trim()) {
        throw new Error(
          '배송지 선택 정보가 만료되었습니다. 배송지를 다시 선택한 뒤 결제를 다시 시도해 주세요.',
        )
      }
      return createNaverCheckout({
        couponCode,
        cartItemIds,
        cartItemQuantities,
        shippingAddressId: selectedAddressId,
      })
    },
    onSuccess: (data) => {
      setInitData(data)
      setPageError(null)
    },
    onError: (err: unknown) => {
      setPageError(toCheckoutPageErrorMessage(err))
    },
  })

  useEffect(() => {
    if (!token) return
    if (cartItemIds.length === 0) {
      setPageError('선택한 상품이 없습니다.')
      return
    }

    // 주소 목록이 아직 로딩 전이면 결제 준비를 시작하지 않습니다.
    if (addressesLoading || addressesFetching) return

    if (addressesIsError) {
      setPageError('배송지 정보를 불러오지 못했습니다. 다시 시도해 주세요.')
      return
    }

    // 주소가 하나도 없으면 "배송지를 선택" 에러 대신 주소록으로 이동해 새 주소 추가 플로우로 연결합니다.
    if (addresses && addresses.length === 0) return

    // 주소 선택이 확정되기 전에는 결제 생성도, 에러 표시도 하지 않습니다.
    if (!selectedAddressId) return

    const quantitiesKey =
      cartItemQuantities?.length
        ? cartItemQuantities.join(',')
        : ''
    const createKey = `${selectedAddressId}|${couponCode ?? ''}|${cartItemIds.join(
      ',',
    )}|${quantitiesKey}`
    if (lastCreateKeyRef.current === createKey && initData) return
    if (createMutation.isPending) return

    lastCreateKeyRef.current = createKey
    setPageError(null)
    setInitData(null)
    setWidgetsReady(false)
    naverPayRef.current = null
    createMutation.mutate()
  }, [
    token,
    cartItemIds,
    cartItemQuantities,
    selectedAddressId,
    addressesLoading,
    addressesIsError,
    addressesFetching,
    couponCode,
    initData,
  ])

  // 주소가 없을 때 주소록으로 자동 이동 (신규 가입 유저 결제 플로우 보정)
  useEffect(() => {
    if (!token) return
    if (cartItemIds.length === 0) return
    if (addressesLoading || addressesFetching) return
    if (addressesIsError) return
    if (!addresses) return
    if (addresses.length > 0) return
    if (didAutoRedirectToAddressRef.current) return

    didAutoRedirectToAddressRef.current = true
    navigate('/account', { state: { activeSection: 'address' } })
  }, [
    token,
    cartItemIds,
    addressesLoading,
    addressesIsError,
    addressesFetching,
    addresses,
    navigate,
  ])

  useEffect(() => {
    if (!addresses || addresses.length === 0) return
    setSelectedAddressId((prev) => {
      if (prev) return prev
      return (
        addresses.find((a) => a.isDefault)?.id ??
        addresses[0]?.id ??
        null
      )
    })
  }, [addresses])

  useEffect(() => {
    if (!initData) return

    let cancelled = false
    setPageError(null)
    setWidgetsReady(false)
    naverPayRef.current = null
    ;(async () => {
      try {
        await loadNaverPayScript()
        if (cancelled) return
        if (!window.Naver?.Pay) {
          throw new Error('Naver.Pay 객체가 없습니다.')
        }
        const naverPay = window.Naver.Pay.create({
          mode: initData.mode,
          payType: 'normal',
          clientId: initData.clientId,
          chainId: initData.chainId,
          openType: 'page',
        })

        naverPayRef.current = naverPay
        setWidgetsReady(true)
      } catch (err) {
        if (cancelled) return
        const extra = err instanceof Error ? ` (${err.message})` : ''
        console.error('NaverPay init error:', err)
        setPageError(
          getApiErrorMessage(
            err,
            '결제 위젯을 초기화하지 못했습니다. 인터넷 연결을 확인해 주세요.',
          ) + extra,
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [initData, initRetryNonce])

  const handleRequestPayment = async () => {
    if (!initData) return
    if (!naverPayRef.current) return
    if (!widgetsReady) return

    setRequesting(true)
    setPageError(null)

    try {
      naverPayRef.current.open({
        merchantUserKey: initData.merchantUserKey,
        merchantPayKey: initData.merchantPayKey,
        productName: initData.productName,
        productCount: initData.productCount,
        totalPayAmount: initData.totalPayAmount,
        taxScopeAmount: initData.taxScopeAmount,
        taxExScopeAmount: initData.taxExScopeAmount,
        returnUrl: initData.returnUrl,
        productItems: initData.productItems,
      })
    } catch (err) {
      setPageError(
        getApiErrorMessage(err, '결제 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
      )
      setRequesting(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-dot-bg px-4 py-28 text-center md:px-16 md:py-48">
        <span className="mono text-dot-primary">결제</span>
        <h1 className="mt-2 font-serif text-3xl tracking-[0.12em] text-dot-primary md:text-4xl">
          로그인 후 결제를 진행해 주세요
        </h1>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-10 inline-block border border-dot-primary px-8 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
        >
          로그인
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dot-bg px-4 py-28 md:px-16 md:py-48">
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-10 border-b border-[#eee] pb-6">
          <h1 className="font-serif text-3xl tracking-[0.12em] text-dot-primary md:text-4xl">
            결제
          </h1>
          <p className="mt-3 text-[0.95rem] text-dot-secondary">
            네이버페이로 안전하게 결제하세요.
          </p>
        </header>

        {pageError && (
          <div className="mb-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-[0.95rem] text-red-700">
            {pageError}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  setInitRetryNonce((n) => n + 1)
                  if (initData) return
                  if (createMutation.isPending) return
                  lastCreateKeyRef.current = null
                  if (!selectedAddressId) {
                    setPageError(
                      '배송지 선택 정보가 만료되었습니다. 배송지를 다시 선택한 뒤 결제를 다시 시도해 주세요.',
                    )
                    return
                  }
                  setPageError(null)
                  createMutation.mutate()
                }}
                className="mono inline-block border border-red-200 bg-white px-6 py-2 text-[0.85rem] font-medium text-red-700 transition-colors hover:bg-red-50"
              >
                다시 시도
              </button>
            </div>
          </div>
        )}

        {!initData ? (
          <div className="rounded border border-[#eee] bg-white p-8">
            <div className="animate-pulse">
              <div className="h-4 w-32 bg-[#eee]" />
              <div className="mt-6 h-64 bg-[#f5f5f5]" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded border border-[#eee] bg-white p-8">
              <h2 className="mono mb-5 text-[0.85rem] tracking-[0.12em] text-dot-primary">
                배송지
              </h2>
              {addressesLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 w-full animate-pulse rounded border border-[#eee] bg-[#fafafa]" />
                  ))}
                </div>
              ) : addressesIsError ? (
                <p className="text-[0.95rem] text-red-600">
                  배송지 정보를 불러오지 못했습니다. 다시 시도해 주세요.
                </p>
              ) : !addresses || addresses.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-[0.95rem] text-dot-secondary">
                    등록된 배송지가 없습니다.
                  </p>
                  <Link
                    to="/account"
                    className="mono inline-block border border-dot-primary px-8 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
                  >
                    주소 추가하기
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => {
                    const labelParts = [
                      addr.recipientName ? addr.recipientName : undefined,
                      addr.phone ? addr.phone : undefined,
                    ].filter(Boolean)

                    const summary = labelParts.join(' / ')
                    const fullAddress = `${addr.addressLine1}${
                      addr.addressLine2 ? ` ${addr.addressLine2}` : ''
                    }`

                    return (
                      <label
                        key={addr.id}
                        className={
                          selectedAddressId === addr.id
                            ? 'flex cursor-pointer items-start gap-3 rounded border border-dot-primary bg-dot-bg p-3'
                            : 'flex cursor-pointer items-start gap-3 rounded border border-[#eee] bg-white p-3 hover:bg-[#fafafa]'
                        }
                      >
                        <input
                          type="radio"
                          name="shipping_address"
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="mono text-[0.85rem] text-dot-primary">
                              {addr.label}
                            </p>
                            {addr.isDefault ? (
                              <span className="rounded border border-dot-primary bg-white px-2 py-0.5 text-[0.7rem] text-dot-primary">
                                기본
                              </span>
                            ) : null}
                            {isOutOfDeliveryPostalCode(addr.postalCode) ? (
                              <span className="rounded border border-[#B45309] bg-white px-2 py-0.5 text-[0.7rem] text-[#B45309]">
                                도서 산간 지역
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[0.95rem] text-dot-secondary">
                            {summary || '수령인 정보 없음'}
                          </p>
                          <p className="mt-1 text-[0.95rem] text-dot-secondary">
                            {fullAddress}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={handleRequestPayment}
                disabled={!widgetsReady || requesting}
                className="mono mt-10 block w-full bg-dot-primary py-4 text-[0.85rem] font-medium uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#333] disabled:opacity-50"
              >
                {requesting ? '결제 요청 중…' : '결제하기'}
              </button>
            </section>

            <aside className="rounded border border-[#eee] bg-white p-8">
              <h2 className="mono mb-5 text-[0.85rem] tracking-[0.12em] text-dot-primary">
                주문 정보
              </h2>
              <div className="space-y-3 text-[0.95rem] text-dot-secondary">
                <div className="flex justify-between">
                  <span>상품</span>
                  <span className="text-dot-primary">{initData.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span>상품 소계</span>
                  {cartItemsLoading ? (
                    <span className="h-4 w-20 animate-pulse rounded bg-[#eee]" />
                  ) : (
                    <span className="text-dot-primary">
                      ₩{selectedCartItemsSubtotal.toLocaleString('ko-KR')}
                    </span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span>배송비</span>
                  {cartItemsLoading ? (
                    <span className="h-4 w-20 animate-pulse rounded bg-[#eee]" />
                  ) : (
                    <span className="text-dot-primary">
                      {selectedShippingFee === 0
                        ? '무료'
                        : `₩${selectedShippingFee.toLocaleString('ko-KR')}`}
                    </span>
                  )}
                </div>
                <div className="flex justify-between pt-3 border-t border-[#eee]">
                  <span>총액</span>
                  <span className="text-dot-primary">
                    ₩{initData.totalPayAmount.toLocaleString('ko-KR')}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

