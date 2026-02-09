import { Link, useLocation } from 'react-router-dom'
import { ShoppingCart, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/common/lib/utils'

const NAV_LINKS = [
  { to: '/about', label: 'About' },
  { to: '/shop', label: 'Shop' },
  { to: '/class', label: 'Class' },
  { to: '/contact', label: 'Contact' },
] as const

export const Header = () => {
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-[1000] grid grid-cols-[1fr_2fr_1fr] items-center transition-all duration-300 ease-out',
        'px-8 py-8 md:px-8 md:py-6 lg:px-16 lg:py-8',
        scrolled
          ? 'border-b border-black/5 bg-white/80 py-4 backdrop-blur-md md:py-5'
          : 'bg-[rgba(249,248,246,0.01)] backdrop-blur-md'
      )}
    >
      <Link
        to="/"
        className="font-serif text-[1.8rem] font-normal text-[#1A1A1A] no-underline"
      >
        DOT.
      </Link>

      <div className="flex justify-center gap-12">
        {NAV_LINKS.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'relative text-[0.85rem] uppercase tracking-[0.1em] text-[#1A1A1A] no-underline transition-all duration-300',
              'after:absolute after:bottom-[-4px] after:left-1/2 after:h-px after:w-0 after:-translate-x-1/2 after:bg-[#1A1A1A] after:transition-all after:duration-300',
              'hover:after:w-full',
              location.pathname === to && 'after:w-full'
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="flex justify-end gap-6">
        <Link
          to="/cart"
          className="text-[#1A1A1A] opacity-80 transition-all duration-300 hover:translate-y-[-2px] hover:opacity-100"
          aria-label="장바구니"
        >
          <ShoppingCart size={20} />
        </Link>
        <Link
          to="/account"
          className="text-[#1A1A1A] opacity-80 transition-all duration-300 hover:translate-y-[-2px] hover:opacity-100"
          aria-label="내 정보"
        >
          <User size={20} />
        </Link>
      </div>
    </nav>
  )
}
