import { useState, useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getStoredToken, getApiErrorMessage } from '@/features/auth/api/auth'
import { fetchOrderReview, readReviewDraft } from '../api/review'

let lastToken: string | null | undefined
let session = 0
function snapshot() {
  const token = getStoredToken()
  if (token !== lastToken) {
    lastToken = token
    session++
  }
  return session
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === null || event.key === 'auth_token') notify()
  }
  window.addEventListener('auth-session-changed', notify)
  window.addEventListener('storage', storage)
  return () => {
    window.removeEventListener('auth-session-changed', notify)
    window.removeEventListener('storage', storage)
  }
}
const money = (amount: number) => `${amount.toLocaleString('ko-KR')}원`
export function OrderReviewPage() {
  const sessionId = useSyncExternalStore(subscribe, snapshot, () => 0)
  // Remount all coupon selection state whenever the signed-in identity changes.
  return <ReviewContent key={sessionId} sessionId={sessionId} />
}
function ReviewContent({ sessionId }: { sessionId: number }) {
  const [draft] = useState(readReviewDraft)
  const [choice, setChoice] = useState('best')
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['order-review', sessionId, draft, choice],
    queryFn: () => fetchOrderReview(draft!, choice),
    enabled: !!draft,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  const content = !draft ? (
    <p>
      주문할 상품을 먼저 선택해 주세요.{' '}
      <Link to="/shop" className="underline">
        상품 보기
      </Link>
    </p>
  ) : isError ? (
    <div role="alert">
      <p>{getApiErrorMessage(error, '주문 정보를 확인하지 못했습니다.')}</p>
      <button
        className="mt-4 border px-4 py-2"
        onClick={() => {
          if (choice !== 'best') setChoice('best')
          else void refetch()
        }}
      >
        다시 확인하기
      </button>
    </div>
  ) : isPending || !data ? (
    <p role="status">상품과 쿠폰을 확인하고 있습니다.</p>
  ) : (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="min-w-0 space-y-8">
        <section aria-labelledby="review-products">
          <h2 id="review-products" className="mb-5 text-lg font-semibold">
            주문 상품
          </h2>
          {data.items.map((item) => (
            <div
              key={`${item.productId}:${item.optionId ?? ''}`}
              className="flex gap-4 border-b border-[#e8e4df] py-5"
            >
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-20 w-20 shrink-0 object-cover sm:h-24 sm:w-24"
                />
              )}
              <div className="min-w-0 flex-1 break-keep">
                <Link to={`/shop/${item.slug}`} className="font-medium">
                  {item.name}
                </Link>
                {item.optionLabel && (
                  <p className="mt-1 text-sm text-dot-secondary">
                    {item.optionLabel}
                  </p>
                )}
                <p className="mt-2 text-sm text-dot-secondary">
                  수량 {item.quantity}개 · 개당 {money(item.unitPrice)}
                </p>
                <p className="mt-2 font-medium">{money(item.amount)}</p>
              </div>
            </div>
          ))}
        </section>
        <section
          aria-labelledby="review-coupons"
          className="rounded-sm border border-[#e8e4df] bg-white p-5 sm:p-6"
        >
          <h2 id="review-coupons" className="text-lg font-semibold">
            쿠폰 할인
          </h2>
          {data.isMember ? (
            <>
              <label htmlFor="review-coupon" className="mt-4 block text-sm">
                보유 쿠폰
              </label>
              <select
                id="review-coupon"
                className="mt-2 w-full min-w-0 rounded-sm border border-[#ded8d0] bg-white px-3 py-3 text-sm"
                value={choice}
                onChange={(event) => setChoice(event.target.value)}
              >
                <option value="best">최대 할인 쿠폰 자동 선택</option>
                <option value="none">쿠폰 사용 안 함</option>
                {data.coupons.map((c) => (
                  <option
                    key={c.userCouponId}
                    value={c.userCouponId}
                    disabled={!!c.reason}
                  >
                    {c.code} · {c.reason ?? `${money(c.discountAmount)} 할인`}
                  </option>
                ))}
              </select>
              <p
                aria-live="polite"
                className="mt-3 break-keep text-sm leading-relaxed text-[#39724A]"
              >
                {data.discountAmount > 0
                  ? `${data.coupons.find((c) => c.userCouponId === data.selectedUserCouponId)?.code} 쿠폰으로 ${money(data.discountAmount)} 할인됩니다.`
                  : data.coupons.length
                    ? '현재 적용된 쿠폰이 없습니다.'
                    : '보유한 쿠폰이 없습니다.'}
              </p>
            </>
          ) : (
            <p className="mt-3 break-keep text-sm leading-relaxed text-dot-secondary">
              비회원도 네이버페이로 구매할 수 있습니다.
              <br />
              <Link to="/login" className="underline underline-offset-4">
                로그인
              </Link>
              하면 보유 쿠폰을 확인할 수 있습니다.
            </p>
          )}
        </section>
        <p className="break-keep text-sm leading-relaxed text-dot-secondary">
          배송지와 결제수단은 네이버 주문서에서 입력합니다.
          <br />
          제주 및 도서산간 추가 배송비는 배송지에 따라 달라집니다.
        </p>
      </div>
      <aside
        aria-label="결제 금액 확인"
        className="h-fit rounded-sm border border-[#e8e4df] bg-white p-5 sm:p-7 lg:sticky lg:top-28"
      >
        <h2 className="mb-6 text-xl font-semibold">결제 금액 확인</h2>
        <dl className="space-y-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt>상품 금액</dt>
            <dd>{money(data.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-[#39724A]">
            <dt>쿠폰 할인</dt>
            <dd>−{money(data.discountAmount)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>할인 적용 상품 금액</dt>
            <dd>{money(data.discountedSubtotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>기본 배송비</dt>
            <dd>{data.shippingFee ? money(data.shippingFee) : '무료'}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-t border-[#e8e4df] pt-5 text-lg font-semibold">
            <dt>예상 결제 금액</dt>
            <dd aria-live="polite">{money(data.total)}</dd>
          </div>
        </dl>
        <p className="mt-3 break-keep text-xs leading-relaxed text-dot-secondary">
          할인 적용 후 상품 금액 10만 원 이상은 기본 배송비가 무료입니다.
        </p>
        <button
          type="button"
          disabled
          className="mt-6 w-full rounded-sm bg-[#03c75a] px-4 py-4 text-sm font-semibold text-[#123b20] opacity-60"
        >
          네이버페이로 결제하기
        </button>
        <p
          role="status"
          className="mt-3 break-keep text-xs leading-relaxed text-dot-secondary"
        >
          {isFetching
            ? '금액을 다시 확인하고 있습니다.'
            : '주문 확인 화면 미리보기입니다. 결제와 쿠폰 사용 처리는 진행되지 않습니다.'}
        </p>
      </aside>
    </div>
  )
  return (
    <main className="min-h-screen bg-dot-bg px-4 pt-28 pb-20 md:px-16 md:pt-40">
      <div className="mx-auto max-w-[1100px]">
        <p className="text-xs tracking-widest text-dot-secondary">
          ORDER REVIEW
        </p>
        <h1 className="mt-3 mb-8 text-3xl font-semibold">주문 확인</h1>
        <div className="mb-6">
          <Link
            to={
              draft?.source === 'cart'
                ? '/cart'
                : data?.items[0]?.slug
                  ? `/shop/${encodeURIComponent(data.items[0].slug)}`
                  : '/shop'
            }
            className="text-sm underline underline-offset-4"
          >
            상품 선택으로 돌아가기
          </Link>
        </div>
        {content}
      </div>
    </main>
  )
}
