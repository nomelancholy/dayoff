import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'

export const Layout = () => {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[9999] mix-blend-soft-light"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0%, transparent 80%)',
        }}
        aria-hidden
      />
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
