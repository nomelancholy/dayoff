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
        © 2024 DOT. CERAMIC STUDIO. ALL RIGHTS RESERVED.
      </p>
    </footer>
  )
}
