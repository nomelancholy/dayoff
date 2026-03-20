import { Link } from 'react-router-dom'

export const Footer = () => {
  return (
    <footer className="border-t border-black/5 bg-dot-bg px-6 py-12 text-center md:px-12 md:py-14 lg:px-16 lg:py-16">
      <Link
        to="/"
        className="logo mb-6 inline-block md:mb-8"
      >
        DOT.
      </Link>
      <p className="mono text-dot-primary">
        © 2019 DOT. CERAMIC STUDIO. ALL RIGHTS RESERVED.
      </p>
      <nav
        className="mt-6 flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-[0.85rem] md:text-[0.9rem]"
        aria-label="법적 고지"
      >
        <Link
          to="/terms"
          className="text-dot-primary underline underline-offset-4 transition-opacity hover:opacity-70"
        >
          이용약관
        </Link>
        <span className="mx-2 text-dot-secondary" aria-hidden>
          |
        </span>
        <Link
          to="/privacy"
          className="text-dot-primary underline underline-offset-4 transition-opacity hover:opacity-70"
        >
          개인정보 처리방침
        </Link>
      </nav>
    </footer>
  )
}
