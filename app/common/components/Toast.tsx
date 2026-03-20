import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUiStore } from '@/common/store/ui'

const TOAST_DURATION_MS = 4000
const SUCCESS_TOAST_DURATION_MS = 2500

export const Toast = () => {
  const { toast, hideToast } = useUiStore()

  useEffect(() => {
    if (!toast) return
    const duration =
      toast.variant === 'success' ? SUCCESS_TOAST_DURATION_MS : TOAST_DURATION_MS
    const t = setTimeout(hideToast, duration)
    return () => clearTimeout(t)
  }, [toast, hideToast])

  if (!toast) return null

  const variant = toast.variant ?? 'default'
  const isSuccess = variant === 'success'
  // success 토스트는 "클릭 근처"가 아니라 상단 메뉴 아래 중앙 배치로 고정합니다.
  const shouldUseAnchor = toast.anchor != null && !isSuccess

  const x =
    shouldUseAnchor && typeof window !== 'undefined'
      ? Math.max(16, Math.min(window.innerWidth - 16, toast.anchor!.x))
      : 0
  const y =
    shouldUseAnchor && typeof window !== 'undefined'
      ? Math.max(16, Math.min(window.innerHeight - 120, toast.anchor!.y))
      : 0

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        shouldUseAnchor
          ? 'fixed left-0 top-0 z-10000 w-[calc(100%-2rem)] max-w-md'
          : isSuccess
            ? 'fixed left-1/2 top-20 z-10000 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 md:top-24'
            : 'fixed bottom-6 left-1/2 z-10000 w-[calc(100%-2rem)] max-w-md -translate-x-1/2'
      }
      style={
        shouldUseAnchor
          ? { left: x, top: y, transform: 'translate(-50%, 0)' }
          : undefined
      }
    >
      <div
        className={
          isSuccess
            ? 'relative flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-5 py-4 shadow-lg pr-6'
            : 'relative rounded-lg border border-[#e5e5e5] bg-white px-5 py-4 pr-8 shadow-lg'
        }
      >
        {isSuccess ? (
          <div className="mt-0.5">
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M16.7 5.8L8.6 14L3.3 8.7"
                stroke="#16A34A"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : null}

        <p
          className={
            isSuccess ? 'text-sm font-medium text-[#166534]' : 'text-sm text-[#1A1A1A]'
          }
        >
          {toast.message}
        </p>
        {toast.actionLabel && toast.actionHref && (
          <Link
            to={toast.actionHref}
            className="mt-2 inline-block text-[10px] font-medium uppercase tracking-wider text-dot-primary underline hover:no-underline"
            onClick={hideToast}
          >
            {toast.actionLabel}
          </Link>
        )}
        {!isSuccess ? (
          <button
            type="button"
            onClick={hideToast}
            className="absolute right-2 top-2.5 text-[#999] hover:text-[#1A1A1A]"
            aria-label="닫기"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
