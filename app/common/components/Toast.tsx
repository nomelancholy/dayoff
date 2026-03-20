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
  const isWarning = variant === 'warning'
  const isTopCenterToast = isSuccess || isWarning
  // success/warning 토스트는 "클릭 근처"가 아니라 상단 메뉴 아래 중앙 배치로 고정합니다.
  const shouldUseAnchor = toast.anchor != null && !isTopCenterToast

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
          : isTopCenterToast
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
            : isWarning
              ? 'relative flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 shadow-lg pr-8'
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
        ) : isWarning ? (
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
                d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l6.516 11.604c.75 1.336-.213 2.997-1.742 2.997H3.483c-1.529 0-2.492-1.661-1.742-2.997L8.257 3.1Z"
                stroke="#B45309"
                strokeWidth="1.8"
                fill="rgba(245, 158, 11, 0.08)"
              />
              <path
                d="M10 7.2v4.2"
                stroke="#B45309"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M10 13.9h.01"
                stroke="#B45309"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        ) : null}

        <p
          className={
            isSuccess
              ? 'text-sm font-medium text-[#166534]'
              : isWarning
                ? 'text-sm font-medium text-[#92400E]'
                : 'text-sm text-[#1A1A1A]'
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
