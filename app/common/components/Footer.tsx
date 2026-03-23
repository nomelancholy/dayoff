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
      <div className="mt-5 space-y-1 text-[0.8rem] leading-6 text-dot-secondary md:text-[0.85rem]">
        <p>
          상호명: 디오티(DOT) | 사업자등록번호: 6530501467 | 대표자: 신은지
        </p>
        <p>
          사업장 소재지: 서울특별시 중구 마른내로4길 31-3 3층 (우 : 04556)
        </p>
        <p>통신판매업번호: 2022-서울중구-1157</p>
      </div>
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
