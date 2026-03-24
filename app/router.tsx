import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from '@/common/components/Layout'
import { HomePage } from '@/features/home/page/Page'
import { AboutPage } from '@/features/about/page/Page'
import { ShopPage } from '@/features/shop/page/Page'
import { ShopProductPage } from '@/features/shop/page/ProductPage'
import { AdminProductPage } from '@/features/shop/page/AdminProductPage'
import { ClassPage } from '@/features/class/page/Page'
import { ContactPage } from '@/features/contact/page/Page'
import { CartPage } from '@/features/cart/page/Page'
import { AccountPage } from '@/features/account/page/Page'
import { CheckoutPage } from '@/features/checkout/page/Page'
import { CheckoutSuccessPage } from '@/features/checkout/success/page/Page'
import { CheckoutFailPage } from '@/features/checkout/fail/page/Page'
import { LoginPage } from '@/features/auth/page/LoginPage'
import { RegisterPage } from '@/features/auth/page/RegisterPage'
import { AdminPage } from '@/features/admin/page/Page'
import { TermsPage } from '@/features/legal/page/TermsPage'
import { PrivacyPage } from '@/features/legal/page/PrivacyPage'
import { BusinessInfoPage } from '@/features/legal/page/BusinessInfoPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'shop', element: <ShopPage /> },
      { path: 'shop/:slug', element: <ShopProductPage /> },
      { path: 'shop/admin/new', element: <AdminProductPage /> },
      { path: 'shop/admin/edit/:id', element: <AdminProductPage /> },
      { path: 'class', element: <ClassPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'business-info', element: <BusinessInfoPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'checkout/success', element: <CheckoutSuccessPage /> },
      { path: 'checkout/fail', element: <CheckoutFailPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
