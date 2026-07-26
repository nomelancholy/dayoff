import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { confirmNaverPayment } from '../../api/checkout'
import { getApiErrorMessage, getStoredToken } from '@/features/auth/api/auth'

export const CheckoutSuccessPage = () => {
  const token = getStoredToken()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const resultCode = params.get('resultCode') ?? ''
  const resultMessage = params.get('resultMessage') ?? ''
  const paymentId = params.get('paymentId') ?? ''
  const merchantPayKey = params.get('merchantPayKey') ?? ''

  const canConfirm =
    token && resultCode === 'Success' && paymentId && merchantPayKey

  const didConfirmRef = useRef(false)
  const [confirmedResult, setConfirmedResult] = useState<{
    orderNumber: string
    status: string
  } | null>(null)

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmNaverPayment({
        paymentId,
        merchantPayKey,
      }),
    onSuccess: (data) => {
      setConfirmedResult({
        orderNumber: data.orderNumber,
        status: String(data.status),
      })
    },
  })

  useEffect(() => {
    if (!canConfirm) return
    if (didConfirmRef.current) return
    didConfirmRef.current = true
    confirmMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canConfirm])

  const errorMessage = useMemo(() => {
    if (!confirmMutation.isError) return null
    return getApiErrorMessage(
      confirmMutation.error,
      '결제 승인 처리를 실패했습니다.'
    )
  }, [confirmMutation.error, confirmMutation.isError])

  const normalizedStatus = useMemo(() => {
    if (!confirmedResult) return ''
    return confirmedResult.status.trim().toLowerCase()
  }, [confirmedResult])

  const isPaid = normalizedStatus === 'paid'

  if (!token) {
    return (
      <div className="min-h-screen bg-dot-bg px-4 py-28 text-center md:px-16 md:py-48">
        <h1 className="font-serif text-3xl tracking-[0.12em] text-dot-primary md:text-4xl">
          로그인 후 확인해 주세요
        </h1>
        <p className="mt-6 text-[0.95rem] text-dot-secondary">
          결제 결과 확인에는 로그인 상태가 필요합니다.
        </p>
        <Link
          to="/login"
          className="mono mt-10 inline-block border border-dot-primary px-8 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
        >
          로그인
        </Link>
      </div>
    )
  }

  if (!canConfirm) {
    const userCancelled = resultCode === 'UserCancel'
    return (
      <div className="min-h-screen bg-dot-bg px-4 py-28 text-center md:px-16 md:py-48">
        <h1 className="font-serif text-3xl tracking-[0.12em] text-dot-primary md:text-4xl">
          {userCancelled
            ? '결제가 취소되었습니다'
            : '결제 정보를 불러오지 못했습니다'}
        </h1>
        <p className="mt-6 text-[0.95rem] text-dot-secondary">
          {userCancelled
            ? '결제는 승인되지 않았습니다. 장바구니에서 다시 시도할 수 있습니다.'
            : resultMessage ||
              '결제 결과가 정상이 아니거나 필수 정보가 누락되었습니다.'}
        </p>
        <Link
          to={userCancelled ? '/cart' : '/account'}
          onClick={
            userCancelled
              ? undefined
              : (e) => {
                  e.preventDefault()
                  navigate('/account', { state: { activeSection: 'orders' } })
                }
          }
          className="mono mt-10 inline-block border border-dot-primary px-8 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
        >
          {userCancelled ? '장바구니로 돌아가기' : '주문 내역 보기'}
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dot-bg px-4 py-28 md:px-16 md:py-48">
      <div className="mx-auto max-w-[900px] rounded border border-[#eee] bg-white p-10 text-center">
        {confirmMutation.isPending && !confirmedResult ? (
          <>
            <div className="mono text-dot-secondary">결제 승인 처리 중…</div>
          </>
        ) : errorMessage ? (
          <>
            <h1 className="font-serif text-3xl tracking-[0.12em] text-dot-primary md:text-4xl">
              결제 승인에 실패했습니다
            </h1>
            <p className="mt-6 text-[0.95rem] text-dot-secondary">
              {errorMessage}
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <button
                type="button"
                onClick={() => confirmMutation.mutate()}
                className="mono inline-block border border-dot-primary px-8 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
              >
                승인 다시 확인
              </button>
              <Link
                to="/cart"
                className="mono inline-block border border-[#ddd] bg-[#fafafa] px-8 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-[#f0f0f0]"
              >
                장바구니
              </Link>
            </div>
          </>
        ) : confirmedResult ? (
          <>
            {isPaid ? (
              <>
                <h1 className="font-serif text-3xl tracking-[0.12em] text-dot-primary md:text-4xl">
                  결제가 완료되었습니다
                </h1>
                <p className="mt-6 text-[0.95rem] text-dot-secondary">
                  주문번호 {confirmedResult.orderNumber} 를 확인해 주세요.
                </p>
              </>
            ) : (
              <>
                <h1 className="font-serif text-3xl tracking-[0.12em] text-dot-primary md:text-4xl">
                  결제 승인 처리 중입니다
                </h1>
                <p className="mt-6 text-[0.95rem] text-dot-secondary">
                  잠시 후 주문 내역에서 확인해 주세요.
                </p>
              </>
            )}
            <div className="mt-10 flex justify-center gap-4">
              <Link
                to="/account"
                onClick={(e) => {
                  e.preventDefault()
                  navigate('/account', { state: { activeSection: 'orders' } })
                }}
                className="mono inline-block border border-dot-primary px-8 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
              >
                주문 내역
              </Link>
              <Link
                to="/shop"
                className="mono inline-block border border-[#ddd] bg-[#fafafa] px-8 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-[#f0f0f0]"
              >
                쇼핑 계속하기
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mono text-dot-secondary">처리 중…</div>
          </>
        )}
      </div>
    </div>
  )
}
