import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchMe, getStoredToken } from '@/features/auth/api/auth'
import type { AuthUser } from '@/features/auth/api/auth'
import { AdminSidebar, type AdminSectionKey } from '../components/AdminSidebar'
import { AdminProductsSection } from '../components/AdminProductsSection'
import { AdminCouponsSection } from '../components/AdminCouponsSection'
import { AdminUsersSection } from '../components/AdminUsersSection'
import { AdminOrdersSection } from '../components/AdminOrdersSection'

export const AdminPage = () => {
  const navigate = useNavigate()
  const token = getStoredToken()
  const [activeKey, setActiveKey] = useState<AdminSectionKey>('products')

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    enabled: !!token,
  })

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    if (user && user.role !== 'admin') {
      navigate('/', { replace: true })
    }
  }, [navigate, token, user])

  if (!token || isLoading || !user) {
    return (
      <div className="min-h-screen bg-dot-bg px-6 py-48 md:px-16">
        <div className="mx-auto max-w-[1400px]">
          <p className="text-dot-secondary">Loading…</p>
        </div>
      </div>
    )
  }

  const adminUser = user as AuthUser

  return (
    <div className="min-h-screen bg-dot-bg px-6 py-48 md:px-16">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8">
          <h1 className="font-serif text-4xl tracking-[0.08em] text-dot-primary">
            ADMIN
          </h1>
          <p className="mt-2 text-dot-secondary">Signed in as {adminUser.email}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
          <AdminSidebar activeKey={activeKey} onSelect={setActiveKey} />

          <main className="rounded border border-[#eee] bg-white p-6">
            {activeKey === 'products' ? <AdminProductsSection /> : null}
            {activeKey === 'coupons' ? <AdminCouponsSection /> : null}
            {activeKey === 'users' ? (
              <AdminUsersSection currentUserId={adminUser.id} />
            ) : null}
            {activeKey === 'orders' ? (
              <AdminOrdersSection />
            ) : null}
          </main>
        </div>
      </div>
    </div>
  )
}

