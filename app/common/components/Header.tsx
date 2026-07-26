import { Link, useLocation } from 'react-router-dom'
import { Menu, X, ShoppingCart, Settings, User } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/common/lib/utils'
import { fetchMe, getStoredToken } from '@/features/auth/api/auth'

const NAV_LINKS = [
  { to: '/about', label: 'About' },
  { to: '/shop', label: 'Shop' },
  { to: '/class', label: 'Class' },
  { to: '/contact', label: 'Contact' },
] as const

export const Header = () => {
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const token = getStoredToken()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    enabled: !!token,
  })

  const isAdmin = user?.role === 'admin'
  const mobileMenuLabel = useMemo(() => '메뉴', [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileMenuOpen])

  return (
    <>
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-1000 grid grid-cols-[1fr_2fr_1fr] items-center transition-[padding,background,border] duration-500 ease-dot',
          'px-6 py-4 md:px-8 md:py-6 lg:px-16 lg:py-8',
          scrolled
            ? 'border-b border-black/5 bg-white/80 py-3 backdrop-blur-md md:py-5 lg:py-4'
            : 'bg-[rgba(249,248,246,0.01)] backdrop-blur-md'
        )}
      >
        {/* Mobile: left hamburger */}
        <button
          type="button"
          aria-label={mobileMenuLabel}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="col-start-1 md:hidden justify-self-start inline-flex items-center justify-center rounded-full p-2 text-dot-primary opacity-90 transition-colors hover:bg-dot-surface hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-dot-primary/20"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Logo */}
        <Link
          to="/"
          className="col-start-2 inline-flex justify-self-center md:col-start-1 md:justify-self-start"
          aria-label="DOT 홈"
        >
          <img
            src="/favicon.png"
            alt=""
            className="h-9 w-9 object-contain md:h-11 md:w-11 lg:h-12 lg:w-12"
          />
        </Link>

        {/* Desktop: middle menu */}
        <div className="col-start-2 hidden md:flex justify-center gap-6 md:gap-8 lg:gap-12">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'relative text-[0.85rem] uppercase tracking-widest text-dot-primary no-underline transition-all duration-500 ease-dot',
                'after:absolute after:bottom-[-4px] after:left-1/2 after:h-px after:w-0 after:-translate-x-1/2 after:bg-dot-primary after:transition-all after:duration-500 after:ease-dot',
                'hover:after:w-full',
                location.pathname === to && 'after:w-full',
              )}
            >
              {label}
            </Link>
          ))}
        </div>

      <div className="col-start-3 flex justify-end gap-4 md:gap-6">
        <Link
          to="/cart"
          className="text-dot-primary opacity-80 transition-all duration-500 ease-dot hover:-translate-y-0.5 hover:opacity-100"
          aria-label="장바구니"
        >
          <ShoppingCart size={20} />
        </Link>
        {isAdmin ? (
          <Link
            to="/admin"
            className="text-dot-primary opacity-80 transition-all duration-500 ease-dot hover:-translate-y-0.5 hover:opacity-100"
            aria-label="관리자 설정"
          >
            <Settings size={20} />
          </Link>
        ) : null}
        <Link
          to="/account"
          className="text-dot-primary opacity-80 transition-all duration-500 ease-dot hover:-translate-y-0.5 hover:opacity-100"
          aria-label="내 정보"
        >
          <User size={20} />
        </Link>
      </div>
      </nav>

      <div
        className={cn(
          'fixed inset-0 z-100000 bg-black/35 transition-opacity duration-300 md:hidden',
          mobileMenuOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        )}
        role="dialog"
        aria-modal="true"
        aria-hidden={!mobileMenuOpen}
        onClick={() => setMobileMenuOpen(false)}
      >
        <div
          className={cn(
            'absolute inset-y-0 left-0 w-[82%] max-w-[360px] border-r border-black/10 bg-[#E8E6E1] px-6 py-6 shadow-2xl transition-transform duration-300 ease-out',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium tracking-[0.16em] text-dot-primary">
              MENU
            </span>
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center justify-center rounded-full p-2 text-dot-primary opacity-90 transition-colors hover:bg-white/50 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-dot-primary/20"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-8 flex flex-col">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'border-b border-black/10 px-1 py-4 text-[1rem] uppercase tracking-[0.15em] text-dot-primary transition-colors',
                  'hover:text-dot-secondary',
                  location.pathname === to && 'font-medium'
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
