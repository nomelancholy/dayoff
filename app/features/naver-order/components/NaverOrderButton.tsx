import { useEffect, useId, useRef, useState } from 'react'
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
}: {
  items: NaverOrderItem[]
  disabled?: boolean
  validate?: () => string | null
}) {
  const id = `npay-${useId().replace(/:/g, '')}`
  const current = useRef({ items, disabled, validate })
  useEffect(() => {
    current.current = { items, disabled, validate }
  }, [items, disabled, validate])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const { data: config } = useNaverOrderConfig()
  useEffect(() => {
    if (!config?.enabled) return
    let cancelled = false
    let button: NpayButton | undefined
    const initialize = async () => {
      setLoading(true)
      setError(null)
      try {
        await prepareNaverTracking(config)
        await loadNaverScript(config.sdkUrl)
        if (cancelled) return
        if (!window.Npay) throw new Error('네이버페이를 불러오지 못했습니다.')
        button = await window.Npay.order.create({
          buttonKey: config.buttonKey,
          containerId: id,
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
              return await registerNaverOrder(state.items)
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
        if (!cancelled)
          setError(getApiErrorMessage(err, '네이버페이를 불러오지 못했습니다.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void initialize()
    return () => {
      cancelled = true
      button?.dispose()
    }
  }, [config, id, disabled])

  // 권한 없음/조회 중/오류 시 버튼 및 네이버페이 안내 영역 전체 비노출.
  if (!config?.enabled) return null
  return (
    <div className="min-w-0 w-full" aria-busy={busy || loading}>
      <div id={id} className="h-[150px] w-full min-w-[200px]" />
      {loading && (
        <p role="status" className="text-sm text-dot-secondary">
          네이버페이를 불러오는 중입니다.
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm text-dot-secondary">
          네이버 주문서를 준비 중입니다.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-dot-secondary">
        사이트 회원가입 없이 네이버 계정으로 구매할 수 있습니다. 주문·배송
        조회와 취소·반품은 네이버페이에서 이용해 주세요.
      </p>
    </div>
  )
}
