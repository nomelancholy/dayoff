import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useUiStore } from '@/common/store/ui'

const TOAST_DURATION_MS = 4000

export const Toast = () => {
  const { toast, hideToast } = useUiStore()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(hideToast, TOAST_DURATION_MS)
    return () => clearTimeout(t)
  }, [toast, hideToast])

  if (!toast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[10000] w-[calc(100%-2rem)] max-w-md -translate-x-1/2"
    >
      <div className="relative rounded-lg border border-[#e5e5e5] bg-white px-4 py-3 pr-8 shadow-lg">
        <p className="text-sm text-[#1A1A1A]">{toast.message}</p>
        {toast.actionLabel && toast.actionHref && (
          <Link
            to={toast.actionHref}
            className="mt-2 inline-block text-[10px] font-medium uppercase tracking-wider text-dot-primary underline hover:no-underline"
            onClick={hideToast}
          >
            {toast.actionLabel}
          </Link>
        )}
        <button
          type="button"
          onClick={hideToast}
          className="absolute right-2 top-2.5 text-[#999] hover:text-[#1A1A1A]"
          aria-label="닫기"
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </div>
    </div>
  )
}
