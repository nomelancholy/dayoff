import { NaverInflow } from '@/features/naver-order/components/NaverInflow'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { Toast } from './Toast'

export const Layout = () => {
  return (
    <>
      <div className="glaze-overlay" aria-hidden />
      <NaverInflow />
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <Toast />
    </>
  )
}
