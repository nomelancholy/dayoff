import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import apiClient from '@/common/lib/apiClient'
import {
  fetchMe,
  getApiErrorMessage,
  getStoredToken,
} from '@/features/auth/api/auth'
import { fetchProducts, fetchProduct } from '@/features/shop/api/shop'

type TestOrder = { desktopUrl: string; mobileUrl: string }
type Traces = {
  changesTraceId: string | null
  detailsTraceId: string | null
  changedOrders: number
  detailsRead: number
  hasMore: boolean
  to: string
}
const base = '/shop/admin/naver-order/sandbox'
const button =
  'min-h-12 rounded border border-black px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40'

export function NpayTestPage() {
  const token = getStoredToken()
  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    enabled: !!token,
  })
  if (!token) return <Navigate to="/login" replace />
  if (me.isPending)
    return <div className="px-6 py-40">관리자 권한 확인 중…</div>
  if (me.isError || me.data?.role !== 'admin')
    return (
      <div className="px-6 py-40">
        관리자 계정으로 로그인해 주세요.{' '}
        <Link to="/login" className="underline">
          로그인
        </Link>
      </div>
    )
  return <SandboxForm />
}

function SandboxForm() {
  const [productId, setProductId] = useState('')
  const [optionId, setOptionId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const status = useQuery({
    queryKey: ['admin', 'npay-sandbox'],
    queryFn: () => apiClient.get<{ available: boolean }>(base),
    staleTime: 0,
  })
  const catalog = useQuery({
    queryKey: ['admin', 'npay-test-products'],
    queryFn: () => fetchProducts(),
  })
  const product = useQuery({
    queryKey: ['admin', 'npay-test-product', productId],
    queryFn: () => fetchProduct(productId),
    enabled: !!productId,
  })
  const order = useMutation({
    mutationFn: () =>
      apiClient.post<TestOrder>(`${base}/register`, {
        source: 'product',
        items: [{ productId, quantity, ...(optionId ? { optionId } : {}) }],
      }),
  })
  const traces = useMutation({
    mutationFn: () => apiClient.post<Traces>(`${base}/traces`),
  })
  const selected = product.data
  const available = status.data?.available === true
  const valid =
    available &&
    selected &&
    quantity >= 1 &&
    quantity <= Math.min(999, selected.stockQuantity) &&
    (!selected.options?.length || !!optionId)
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const checkoutUrl = order.data
    ? mobile
      ? order.data.mobileUrl
      : order.data.desktopUrl
    : null
  const report = traces.data
    ? `가맹점 쇼핑몰 URL: https://dayoff.today
환경: Sandbox
조회 시각: ${traces.data.to}
${traces.data.changesTraceId ? '[x]' : '[ ]'} 변경 상품 주문 내역 조회: ${traces.data.changesTraceId ?? '응답 헤더 확인 필요'}
${traces.data.detailsTraceId ? '[x]' : '[ ]'} 상품 주문 상세 내역 조회: ${traces.data.detailsTraceId ?? '테스트 결제 후 조회 필요'}`
    : ''
  return (
    <main className="min-h-screen bg-dot-bg px-5 py-32 md:py-44">
      <div className="mx-auto max-w-2xl space-y-8">
        <Link to="/admin" className="text-sm underline">
          ← 관리자
        </Link>
        <header>
          <p className="mb-3 text-xs tracking-widest text-emerald-700">
            ADMIN · SANDBOX
          </p>
          <h1 className="text-2xl font-medium">네이버페이 테스트 주문</h1>
          <p className="mt-4 text-sm leading-7 text-dot-secondary">
            기존 상품으로 샌드박스 주문을 만듭니다. 테스트 결제는 실제 출금과
            판매 재고 차감 없이 진행됩니다. 일반 쇼핑몰의 구매 버튼은 실제
            결제로 연결됩니다.
          </p>
        </header>
        {status.isPending ? <p role="status">테스트 환경 확인 중…</p> : null}
        {status.isError || (status.data && !available) ? (
          <p
            role="alert"
            className="rounded border border-amber-300 bg-amber-50 p-4 text-sm"
          >
            샌드박스 환경을 사용할 수 없습니다. 주문관리 API 설정을 확인해
            주세요.
          </p>
        ) : null}
        <section className="space-y-5 rounded border border-gray-200 bg-white p-5 md:p-7">
          <h2 className="text-lg font-medium">1. 테스트 주문서 만들기</h2>
          <label className="block text-sm">
            상품
            <select
              className="mt-2 min-h-12 w-full rounded border p-3"
              value={productId}
              disabled={order.isPending}
              onChange={(e) => {
                setProductId(e.target.value)
                setOptionId('')
                setQuantity(1)
                order.reset()
              }}
            >
              <option value="">상품을 선택해 주세요</option>
              {catalog.data
                ?.filter((p) => p.isActive && p.stockQuantity > 0)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.price.toLocaleString()}원
                  </option>
                ))}
            </select>
          </label>
          {catalog.isError || product.isError ? (
            <p role="alert">
              상품을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.
            </p>
          ) : null}
          {catalog.data &&
          !catalog.data.some((p) => p.isActive && p.stockQuantity > 0) ? (
            <p>
              재고가 있는 판매 상품이 없습니다. 관리자에서 상품 재고를 확인해
              주세요.
            </p>
          ) : null}
          {selected?.options?.length ? (
            <label className="block text-sm">
              옵션
              <select
                className="mt-2 min-h-12 w-full rounded border p-3"
                value={optionId}
                disabled={order.isPending}
                onChange={(e) => {
                  setOptionId(e.target.value)
                  order.reset()
                }}
              >
                <option value="">옵션을 선택해 주세요</option>
                {selected.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}: {o.value}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-sm">
            수량
            <input
              type="number"
              min={1}
              max={Math.min(999, selected?.stockQuantity ?? 1)}
              value={quantity}
              disabled={order.isPending}
              className="ml-4 min-h-12 w-24 rounded border p-3"
              onChange={(e) => {
                setQuantity(Number(e.target.value))
                order.reset()
              }}
            />
          </label>
          <button
            type="button"
            className={`${button} w-full bg-black text-white`}
            disabled={!valid || order.isPending}
            onClick={() => order.mutate()}
          >
            {order.isPending ? '주문서 만드는 중…' : '샌드박스 주문서 만들기'}
          </button>
          {order.isError ? (
            <p role="alert" className="text-sm text-red-700">
              {getApiErrorMessage(order.error)}
            </p>
          ) : null}
          {checkoutUrl ? (
            <div className="space-y-3 rounded bg-emerald-50 p-4" role="status">
              <p className="text-sm">
                주문서가 준비되었습니다. 새 창에서 네이버 로그인 후 테스트
                결제를 완료하고 이 페이지로 돌아와 주세요.
              </p>
              <a
                className={`${button} block bg-white text-center`}
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                테스트 주문서 열기 ↗
              </a>
              <p className="text-xs text-dot-secondary">
                주소가 test-order.pay.naver.com 또는 test-m.pay.naver.com인지
                확인해 주세요. 주문서가 만료되면 다시 만들어 주세요.
              </p>
            </div>
          ) : null}
        </section>
        <section className="space-y-5 rounded border border-gray-200 bg-white p-5 md:p-7">
          <h2 className="text-lg font-medium">2. 결제 후 Trace ID 확인</h2>
          <p className="text-sm leading-6 text-dot-secondary">
            테스트 결제를 마친 뒤 아래 버튼을 눌러 주세요. 최근 24시간의 변경
            주문을 최대 100건 조회하고, 주문이 있으면 상세 조회까지 실행합니다.
            아직 0건이면 잠시 후 다시 확인해 주세요.
          </p>
          <button
            type="button"
            className={`${button} w-full`}
            disabled={!available || traces.isPending || order.isPending}
            onClick={() => traces.mutate()}
          >
            {traces.isPending
              ? 'API 응답 확인 중…'
              : 'API 조회 · Trace ID 확인'}
          </button>
          {traces.isError ? (
            <p role="alert" className="text-sm text-red-700">
              {getApiErrorMessage(traces.error)}
            </p>
          ) : null}
          {traces.data ? (
            <div className="space-y-4" role="status">
              <p className="text-sm">
                변경 주문 {traces.data.changedOrders}건 · 상세 조회{' '}
                {traces.data.detailsRead}건
                {traces.data.hasMore ? ' (다음 페이지 있음)' : ''}
              </p>
              {!traces.data.detailsRead ? (
                <p className="text-sm text-amber-800">
                  아직 테스트 주문이 조회되지 않아 상세 조회 Trace ID가
                  없습니다. 결제 완료 여부를 확인한 뒤 다시 조회해 주세요.
                </p>
              ) : null}
              <label className="block text-sm">
                검수 요청에 복사할 내용
                <textarea
                  readOnly
                  value={report}
                  rows={7}
                  className="mt-2 w-full rounded border bg-gray-50 p-3 font-mono text-xs leading-6"
                  onFocus={(e) => e.target.select()}
                />
              </label>
            </div>
          ) : null}
          <p className="text-sm leading-6 text-dot-secondary">
            결제 조회가 확인되면{' '}
            <a
              href="https://test-pay.naver.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              네이버페이 테스트 구매내역
            </a>
            에서 테스트 주문을 취소할 수 있습니다. 취소 완료 후 다시 조회해
            결제·취소 흐름을 확인해 주세요.
          </p>
        </section>
      </div>
    </main>
  )
}
