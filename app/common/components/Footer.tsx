import { Link } from 'react-router-dom'

export const Footer = () => {
  return (
    <footer className="border-t border-black/5 bg-[#F9F8F6] px-16 py-16 text-center">
      <Link
        to="/"
        className="mb-8 inline-block font-serif text-[1.8rem] font-normal text-[#1A1A1A] no-underline"
      >
        DOT.
      </Link>
      <p className="font-sans text-[0.7rem] uppercase tracking-[0.15em] text-[#1A1A1A]">
        © 2024 DOT. CERAMIC STUDIO. ALL RIGHTS RESERVED.
      </p>
    </footer>
  )
}
