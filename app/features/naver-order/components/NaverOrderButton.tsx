import { useEffect, useId, useRef, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import './NaverOrderButton.css'
import { getApiErrorMessage } from '@/features/auth/api/auth'
import { useNaverOrderConfig } from '../hooks/useNaverOrderConfig'
import {
  loadNaverScript,
  prepareNaverTracking,
  registerNaverOrder,
  type NaverOrderItem,
  type NpayButton,
} from '../api/naverOrder'

export function NaverOrderButton({
  items,
  disabled = false,
  validate,
  showGuestNotice = false,
  register,
}: {
  items: NaverOrderItem[]
  disabled?: boolean
  validate?: () => string | null
  showGuestNotice?: boolean
  register?: () => Promise<{ key: string; merchantNo: string }>
}) {
  const id = `npay-${useId().replace(/:/g, '')}`
  const container = useRef<HTMLDivElement>(null)
  const generation = useRef(0)
  const current = useRef({ items, disabled, validate, register })
  useEffect(() => {
    current.current = { items, disabled, validate, register }
  }, [items, disabled, validate, register])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [initializationFailed, setInitializationFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const { data: config } = useNaverOrderConfig()
  useEffect(() => {
    if (!config?.enabled || !container.current) return
    // 각 초기화가 자체 DOM을 소유해야 늦게 완료된 SDK가 새 버튼을 지우지 않습니다.
    const mount = document.createElement('div')
    mount.id = `${id}-${++generation.current}`
    container.current.appendChild(mount)
    let cancelled = false
    let button: NpayButton | undefined
    const initialize = async () => {
      setLoading(true)
      setError(null)
      setInitializationFailed(false)
      try {
        await prepareNaverTracking(config)
        await loadNaverScript(config.sdkUrl)
        if (cancelled) return
        if (!window.Npay) throw new Error('네이버페이를 불러오지 못했습니다.')
        button = await window.Npay.order.create({
          buttonKey: config.buttonKey,
          containerId: mount.id,
          orderRegistrationVersion: '2.1',
          type: 'template',
          colorTheme: 'green',
          enable: !disabled,
          components: { benefitMessage: true },
          onBuyClick: async () => {
            if (cancelled) throw new Error('페이지를 새로고침해 주세요.')
            const state = current.current
            const message =
              state.validate?.() ??
              (state.disabled || !state.items.length
                ? '구매할 상품과 수량을 확인해 주세요.'
                : null)
            if (message) {
              setError(message)
              throw new Error(message)
            }
            if (inFlight.current) throw new Error('주문서를 준비 중입니다.')
            inFlight.current = true
            setBusy(true)
            setError(null)
            try {
              return await (state.register
                ? state.register()
                : registerNaverOrder(state.items))
            } catch (err) {
              if (!cancelled)
                setError(
                  getApiErrorMessage(
                    err,
                    '주문서를 열지 못했습니다. 다시 시도해 주세요.'
                  )
                )
              throw err
            } finally {
              inFlight.current = false
              if (!cancelled) setBusy(false)
            }
          },
        })
        if (cancelled) button.dispose()
      } catch (err) {
        mount.remove()
        if (!cancelled) {
          setInitializationFailed(true)
          const domainRejected =
            err instanceof Error &&
            /Origin verification failed/i.test(err.message)
          setError(
            domainRejected
              ? `네이버페이에 등록된 쇼핑몰 주소와 현재 접속 주소(${window.location.origin})가 일치하지 않아 구매 버튼을 표시할 수 없습니다. 가맹점 담당자가 네이버페이의 연동 URL과 버튼 인증키 설정을 확인해야 합니다.`
              : '네이버페이 연결에 실패했습니다. 잠시 후 다시 시도해 주세요. 계속되면 네트워크 연결과 브라우저의 콘텐츠 차단 설정을 확인해 주세요.'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void initialize()
    return () => {
      cancelled = true
      button?.dispose()
      mount.remove()
    }
  }, [config, id, disabled])

  // 권한 없음/조회 중/오류 시 버튼 및 네이버페이 안내 영역 전체 비노출.
  if (!config?.enabled) return null
  return (
    <div className="min-w-0 w-full" aria-busy={busy || loading}>
      <div
        ref={container}
        hidden={initializationFailed}
        className="dayoff-npay-button w-full min-w-[200px]"
      />
      {loading && (
        <p role="status" className="text-sm text-dot-secondary">
          네이버페이를 불러오는 중입니다.
        </p>
      )}
      {busy && (
        <p role="status" className="sr-only">
          네이버 주문서를 준비 중입니다.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {initializationFailed && (
        <button
          type="button"
          className="mt-3 border border-dot-secondary px-4 py-2 text-sm"
          onClick={() => window.location.reload()}
        >
          새로고침하여 다시 확인
        </button>
      )}
      {!loading &&
        !initializationFailed &&
        (showGuestNotice ? (
          <aside
            aria-label="비회원 구매 안내"
            className="mt-3 flex items-start gap-3 rounded-sm border border-[#DCE8DE] bg-[#F3F7F2] px-4 py-3.5"
          >
            <ShoppingBag
              size={18}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[#39724A]"
            />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-5 text-dot-primary">
                가입 없이 간편하게, 회원이라면 더 많은 혜택
              </p>
              <p className="mt-1 break-keep text-xs leading-relaxed text-[#59665C]">
                네이버페이로 회원가입 없이 간편하게 구매할 수 있어요.
                <br />
                DOT 회원으로 가입하시면 쿠폰 등 회원 전용 혜택을 받으실 수
                있어요.
              </p>
              <p className="mt-2 break-keep text-xs leading-relaxed text-[#59665C]">
                {config.couponCheckoutEnabled
                  ? '회원은 주문 확인 화면에서 쿠폰을 먼저 적용할 수 있어요.'
                  : '사이트 쿠폰은 네이버페이 주문에 적용되지 않습니다.'}
                <br />
                주문·배송 조회와 취소·반품은 네이버페이에서 이용해 주세요.
              </p>
            </div>
          </aside>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-dot-secondary">
            주문·배송 조회와 취소·반품은 네이버페이에서 이용해 주세요.
          </p>
        ))}
    </div>
  )
}
