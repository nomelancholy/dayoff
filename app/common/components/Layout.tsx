import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'

export const Layout = () => {
  return (
    <>
      <div className="glaze-overlay" aria-hidden />
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
