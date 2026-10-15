import { useEffect, useState } from 'react'
import { ArrowRight, Check, ShoppingBag, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ToastOptions } from '@/common/store/ui'

export const CartToast = ({
  toast,
  onClose,
}: {
  toast: ToastOptions
  onClose: () => void
}) => {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const item = toast.cartItem

  useEffect(() => {
    if (hovered || focused) return
    const timer = window.setTimeout(onClose, 6000)
    return () => window.clearTimeout(timer)
  }, [toast, hovered, focused, onClose])

  return (
    <section
      aria-label="장바구니 알림"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
      className="fixed inset-x-4 top-20 z-10000 border border-dot-accent/30 bg-dot-bg p-5 text-dot-primary shadow-[0_12px_40px_-12px_rgba(52,45,35,0.2)] animate-in fade-in slide-in-from-top-2 duration-300 md:inset-x-auto md:right-8 md:top-28 md:w-[360px] lg:right-16 lg:top-32 motion-reduce:animate-none"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="장바구니 알림 닫기"
        className="absolute right-2 top-2 flex size-9 items-center justify-center text-dot-secondary transition-colors hover:bg-dot-accent/10 hover:text-dot-primary"
      >
        <X size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>

      <div role="status" aria-live="polite" aria-atomic="true">
        <div className="flex items-center gap-2.5 pr-6">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e8e6df] text-[#575c4e]">
            <Check size={14} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <p className="text-[13px] font-medium tracking-[0.02em]">
            {toast.message}
          </p>
        </div>

        {item ? (
          <div className="mt-4 flex items-center gap-3.5 border-t border-dot-accent/20 pt-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden bg-[#eeece7]">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <ShoppingBag
                  size={22}
                  strokeWidth={1}
                  className="text-dot-accent"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="line-clamp-2 break-words text-[13px] leading-relaxed">
                {item.name}
              </p>
              {item.optionLabel ? (
                <p className="mt-1 line-clamp-2 break-words text-xs text-dot-secondary">
                  {item.optionLabel}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-dot-secondary">
                장바구니 수량 {item.quantity}개
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <Link
        to={toast.actionHref ?? '/cart'}
        onClick={onClose}
        className="group mt-4 flex min-h-10 items-center justify-between border-t border-dot-accent/20 pt-3 text-xs tracking-[0.04em] text-dot-primary transition-colors hover:text-dot-secondary focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        {toast.actionLabel ?? '장바구니 보기'}
        <ArrowRight
          size={16}
          strokeWidth={1.3}
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
        />
      </Link>
    </section>
  )
}
