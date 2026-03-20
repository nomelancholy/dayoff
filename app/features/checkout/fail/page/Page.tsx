import { Link, useSearchParams } from 'react-router-dom'

export const CheckoutFailPage = () => {
  const [params] = useSearchParams()

  const code = params.get('code')
  const message = params.get('message')
  const orderId = params.get('orderId')

  return (
    <div className="min-h-screen bg-dot-bg px-4 py-28 md:px-16 md:py-48">
      <div className="mx-auto max-w-[900px] rounded border border-[#eee] bg-white p-10 text-center">
        <h1 className="font-serif text-3xl tracking-[0.12em] text-dot-primary md:text-4xl">
          결제에 실패했습니다
        </h1>
        <p className="mt-6 text-[0.95rem] text-dot-secondary">
          {message ? message : '다시 시도해 주세요.'}
        </p>

        <div className="mt-6 text-left text-[0.95rem] text-dot-secondary">
          {orderId ? <div>OrderId: {orderId}</div> : null}
          {code ? <div>Code: {code}</div> : null}
        </div>

        <div className="mt-10 flex justify-center gap-4">
          <Link
            to="/cart"
            className="mono inline-block border border-dot-primary px-8 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
          >
            장바구니로 돌아가기
          </Link>
          <Link
            to="/shop"
            className="mono inline-block border border-[#ddd] bg-[#fafafa] px-8 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-[#f0f0f0]"
          >
            쇼핑 계속하기
          </Link>
        </div>
      </div>
    </div>
  )
}

