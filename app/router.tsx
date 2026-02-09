import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from '@/common/components/Layout'
import { HomePage } from '@/features/home/page/Page'
import { AboutPage } from '@/features/about/page/Page'
import { ShopPage } from '@/features/shop/page/Page'
import { ClassPage } from '@/features/class/page/Page'
import { ContactPage } from '@/features/contact/page/Page'
import { CartPage } from '@/features/cart/page/Page'
import { AccountPage } from '@/features/account/page/Page'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'shop', element: <ShopPage /> },
      { path: 'class', element: <ClassPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
