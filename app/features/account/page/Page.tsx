import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  fetchMe,
  getStoredToken,
  clearStoredToken,
  updateProfile,
  fetchAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  type AuthUser,
  type AddressRow,
} from '@/features/auth/api/auth'
import {
  fetchMyOrders,
  fetchMyReviews,
  type OrderRow,
  type OrderItemRow,
  type MyReviewItem,
} from '@/features/shop/api/shop'
import { ProductReviewForm } from '@/features/shop/components/ProductReviewForm'
import { cn } from '@/common/lib/utils'
import { LoginForm } from '@/features/auth/components/LoginForm'

type AccountSection = 'profile' | 'orders' | 'address'

export const AccountPage = () => {
  const navigate = useNavigate()
  const token = getStoredToken()
  const [activeSection, setActiveSection] = useState<AccountSection>('profile')

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    enabled: !!token,
  })

  const handleLogout = () => {
    clearStoredToken()
    navigate('/login', { replace: true })
    window.location.reload()
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-dot-bg px-6 py-48 md:px-16">
        <div className="mx-auto max-w-md">
          <span className="mono block text-dot-primary">WELCOME BACK</span>
          <h1 className="mt-2 font-serif text-4xl font-normal tracking-[0.12em] text-dot-primary md:text-5xl">
            My Account
          </h1>
          <p className="mt-4 text-[0.9rem] text-dot-secondary">
            Please login to access your account.
          </p>

          <div className="mt-12">
            <LoginForm onSuccess={() => window.location.reload()} />
          </div>

          <div className="mt-12 border-t border-[#eee] pt-10 text-center">
            <p className="mb-6 text-[0.8rem] text-dot-secondary">New to Day Off?</p>
            <Link
              to="/register"
              className={cn(
                'mono inline-block w-full border border-dot-primary bg-transparent px-4 py-3.5 text-[0.8rem] font-medium uppercase tracking-[0.2em] text-dot-primary no-underline',
                'transition-colors hover:bg-dot-primary hover:text-white'
              )}
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dot-bg px-6 py-48 md:px-16">
        <div className="mx-auto max-w-[1200px]">
          <p className="mono text-dot-secondary">Loading…</p>
        </div>
      </div>
    )
  }

  if (isError || !user) {
    return (
      <div className="min-h-screen bg-dot-bg px-6 py-48 md:px-16">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-serif text-3xl font-normal tracking-[0.12em] text-dot-primary">
            My Account
          </h1>
          <p className="mt-6 text-[0.9rem] text-dot-secondary">Session may have expired.</p>
          <button
            type="button"
            onClick={() => {
              clearStoredToken()
              window.location.reload()
            }}
            className="mono mt-10 text-[0.8rem] uppercase tracking-[0.2em] text-dot-primary underline underline-offset-4 hover:opacity-70"
          >
            Login Again
          </button>
        </div>
      </div>
    )
  }

  const navItems: { id: AccountSection; label: string }[] = [
    { id: 'profile', label: 'PROFILE' },
    { id: 'orders', label: 'ORDER HISTORY' },
    { id: 'address', label: 'ADDRESS BOOK' },
  ]

  return (
    <div className="min-h-screen bg-dot-bg px-6 py-48 md:px-16">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-16 md:grid-cols-[250px_1fr]">
        <header className="flex flex-col gap-4 border-b border-[#eee] pb-8 md:col-span-full md:flex-row md:items-end md:justify-between">
          <div>
            <span className="mono block text-dot-primary">WELCOME BACK</span>
            <h1 className="mt-2 font-serif text-4xl font-normal tracking-[0.12em] text-dot-primary md:text-5xl">
              My Account
            </h1>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mono w-fit border-none bg-transparent text-[0.8rem] text-dot-secondary underline cursor-pointer transition-colors hover:text-dot-primary"
          >
            LOGOUT
          </button>
        </header>

        <aside className="flex flex-col gap-6">
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={cn(
                'mono relative border-none bg-transparent text-left py-2 text-[0.9rem] text-dot-secondary transition-colors cursor-pointer',
                activeSection === id
                  ? 'font-medium text-dot-primary'
                  : 'hover:text-dot-primary'
              )}
            >
              {label}
              {activeSection === id && (
                <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-dot-primary md:-left-5" />
              )}
            </button>
          ))}
        </aside>

        <div className="min-w-0">
          {activeSection === 'profile' && (
            <ProfileSection user={user} />
          )}

          {activeSection === 'orders' && (
            <OrderHistorySection />
          )}

          {activeSection === 'address' && (
            <AddressBookSection />
          )}
        </div>
      </div>
    </div>
  )
}

/** 프로필 수정 폼 (reference: account.html .profile-form) */
function ProfileSection({ user }: { user: AuthUser }) {
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState(user.fullName ?? '')
  const [phone, setPhone] = useState(user.phone ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    setFullName(user.fullName ?? '')
    setPhone(user.phone ?? '')
  }, [user.fullName, user.phone])

  const profileMutation = useMutation({
    mutationFn: () =>
      updateProfile({
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      setCurrentPassword('')
      setNewPassword('')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword && newPassword.length < 8) {
      alert('새 비밀번호는 8자 이상이어야 합니다.')
      return
    }
    profileMutation.mutate()
  }

  return (
    <section>
      <h2 className="mono mb-12 border-b border-[#f0f0f0] pb-4 text-[1.8rem] font-normal tracking-[0.12em] text-dot-primary">
        PERSONAL INFORMATION
      </h2>
      <form className="max-w-[600px] space-y-8" onSubmit={handleSubmit}>
        <div>
          <label className="mono mb-2 block text-[0.85rem] text-dot-primary">
            FULL NAME
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-[#eee] bg-white px-4 py-3 text-[0.95rem] text-dot-primary focus:border-dot-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mono mb-2 block text-[0.85rem] text-dot-primary">
            EMAIL ADDRESS
          </label>
          <input
            type="email"
            value={user.email}
            readOnly
            className="w-full border border-[#eee] bg-[#f9f9f9] px-4 py-3 text-[0.95rem] text-dot-secondary read-only:cursor-default"
          />
          <p className="mt-1 text-[0.7rem] text-dot-secondary">이메일은 변경할 수 없습니다.</p>
        </div>
        <div>
          <label className="mono mb-2 block text-[0.85rem] text-dot-primary">
            PHONE NUMBER
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-1234-5678"
            className="w-full border border-[#eee] bg-white px-4 py-3 text-[0.95rem] text-dot-primary placeholder:text-dot-secondary focus:border-dot-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mono mb-2 block text-[0.85rem] text-dot-primary">
            PASSWORD
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full border border-[#eee] bg-white px-4 py-3 text-[0.95rem] text-dot-primary placeholder:text-dot-secondary focus:border-dot-primary focus:outline-none"
          />
          <p className="mt-1 text-[0.7rem] text-dot-secondary">
            비밀번호를 변경할 때만 입력하세요. (8자 이상)
          </p>
          {newPassword ? (
            <div className="mt-4">
              <label className="mono mb-2 block text-[0.8rem] text-dot-primary">
                CURRENT PASSWORD
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="현재 비밀번호"
                className="w-full border border-[#eee] bg-white px-4 py-3 text-[0.95rem] focus:border-dot-primary focus:outline-none"
              />
            </div>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={profileMutation.isPending}
          className="mono mt-2 border-none bg-[#1A1A1A] px-8 py-3 text-[0.9rem] font-medium text-white transition-opacity hover:bg-[#333] disabled:opacity-50"
        >
          {profileMutation.isPending ? '저장 중…' : 'SAVE CHANGES'}
        </button>
        {profileMutation.isError && (
          <p className="text-[0.85rem] text-red-600">
            {(profileMutation.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
              (profileMutation.error as Error)?.message ??
              '저장에 실패했습니다.'}
          </p>
        )}
      </form>
    </section>
  )
}

/** 주소록: 목록 + 추가/수정/삭제 (reference: account.html #address) */
function AddressBookSection() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['auth', 'addresses'],
    queryFn: fetchAddresses,
  })

  const createMutation = useMutation({
    mutationFn: createAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'addresses'] })
      setAdding(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateAddress>[1] }) =>
      updateAddress(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'addresses'] })
      setEditingId(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'addresses'] })
      setEditingId(null)
    },
  })

  if (isLoading) {
    return (
      <section>
        <h2 className="mono mb-12 border-b border-[#f0f0f0] pb-4 text-[1.8rem] font-normal tracking-[0.12em] text-dot-primary">
          ADDRESS BOOK
        </h2>
        <p className="text-dot-secondary">Loading…</p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="mono mb-12 border-b border-[#f0f0f0] pb-4 text-[1.8rem] font-normal tracking-[0.12em] text-dot-primary">
        ADDRESS BOOK
      </h2>
      <div className="space-y-6">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className="rounded border border-[#eee] bg-white p-6"
          >
            {editingId === addr.id ? (
              <AddressForm
                address={addr}
                onSave={(data) => updateMutation.mutate({ id: addr.id, data })}
                onCancel={() => setEditingId(null)}
                isPending={updateMutation.isPending}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h4 className="font-medium text-dot-primary">
                    {addr.label}
                    {addr.isDefault && (
                      <span className="mono ml-2 text-[0.75rem] text-dot-secondary">(DEFAULT)</span>
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setEditingId(addr.id)}
                    className="mono text-[0.8rem] text-[#666666] underline hover:text-[#1A1A1A]"
                  >
                    EDIT
                  </button>
                </div>
                <p className="mt-2 text-[0.95rem] text-dot-secondary">
                  {[addr.postalCode, addr.addressLine1, addr.addressLine2]
                    .filter(Boolean)
                    .join(' ')}
                </p>
                {(addr.recipientName || addr.phone) && (
                  <p className="mt-1 text-[0.9rem] text-dot-secondary">
                    {[addr.recipientName, addr.phone].filter(Boolean).join(' · ')}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('이 주소를 삭제할까요?')) deleteMutation.mutate(addr.id)
                  }}
                  className="mono mt-3 text-[0.8rem] text-red-600 underline hover:no-underline cursor-pointer"
                >
                  DELETE
                </button>
              </>
            )}
          </div>
        ))}
        {adding ? (
          <div className="rounded border border-[#eee] bg-white p-6">
            <AddressForm
              onSave={(data) => createMutation.mutate(data)}
              onCancel={() => setAdding(false)}
              isPending={createMutation.isPending}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mono w-full border border-dashed border-[#ddd] bg-transparent py-6 text-[0.9rem] text-[#666666] transition-colors hover:border-[#1A1A1A] hover:text-[#1A1A1A]"
          >
            + ADD NEW ADDRESS
          </button>
        )}
      </div>
      {addresses.length === 0 && !adding && (
        <p className="mt-6 text-[0.95rem] text-dot-secondary">
          저장된 주소가 없습니다. 위 버튼으로 추가하세요.
        </p>
      )}
    </section>
  )
}

/** 주소 추가/수정 폼 */
function AddressForm({
  address,
  onSave,
  onCancel,
  isPending,
}: {
  address?: AddressRow
  onSave: (data: {
    label: string
    recipientName?: string
    phone?: string
    postalCode?: string
    addressLine1: string
    addressLine2?: string
    isDefault?: boolean
  }) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [label, setLabel] = useState(address?.label ?? '')
  const [recipientName, setRecipientName] = useState(address?.recipientName ?? '')
  const [phone, setPhone] = useState(address?.phone ?? '')
  const [postalCode, setPostalCode] = useState(address?.postalCode ?? '')
  const [addressLine1, setAddressLine1] = useState(address?.addressLine1 ?? '')
  const [addressLine2, setAddressLine2] = useState(address?.addressLine2 ?? '')
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) {
      alert('주소 별칭을 입력해 주세요.')
      return
    }
    if (!addressLine1.trim()) {
      alert('주소를 입력해 주세요.')
      return
    }
    onSave({
      label: label.trim(),
      recipientName: recipientName.trim() || undefined,
      phone: phone.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      isDefault,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mono mb-1 block text-[0.8rem] text-dot-primary">LABEL (e.g. HOME, OFFICE)</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="HOME"
          className="w-full border border-[#eee] bg-white px-3 py-2 text-[0.95rem] focus:border-dot-primary focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="mono mb-1 block text-[0.8rem] text-dot-primary">RECIPIENT</label>
        <input
          type="text"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="수령인"
          className="w-full border border-[#eee] bg-white px-3 py-2 text-[0.95rem] focus:border-dot-primary focus:outline-none"
        />
      </div>
      <div>
        <label className="mono mb-1 block text-[0.8rem] text-dot-primary">PHONE</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-1234-5678"
          className="w-full border border-[#eee] bg-white px-3 py-2 text-[0.95rem] focus:border-dot-primary focus:outline-none"
        />
      </div>
      <div>
        <label className="mono mb-1 block text-[0.8rem] text-dot-primary">POSTAL CODE</label>
        <input
          type="text"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="우편번호"
          className="w-full border border-[#eee] bg-white px-3 py-2 text-[0.95rem] focus:border-dot-primary focus:outline-none"
        />
      </div>
      <div>
        <label className="mono mb-1 block text-[0.8rem] text-dot-primary">ADDRESS</label>
        <input
          type="text"
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          placeholder="도로명 또는 지번 주소"
          className="w-full border border-[#eee] bg-white px-3 py-2 text-[0.95rem] focus:border-dot-primary focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="mono mb-1 block text-[0.8rem] text-dot-primary">ADDRESS LINE 2 (optional)</label>
        <input
          type="text"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          placeholder="상세 주소, 동/호수"
          className="w-full border border-[#eee] bg-white px-3 py-2 text-[0.95rem] focus:border-dot-primary focus:outline-none"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="rounded border-[#eee]"
        />
        <span className="text-[0.9rem] text-dot-primary">기본 배송지로 설정</span>
      </label>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="mono flex-1 border border-[#ddd] bg-white py-2.5 text-[0.85rem] text-[#1A1A1A] hover:bg-[#f9f9f9]"
        >
          CANCEL
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="mono flex-1 border-none bg-[#1A1A1A] py-2.5 text-[0.85rem] text-white disabled:opacity-50"
        >
          {isPending ? '저장 중…' : 'SAVE'}
        </button>
      </div>
    </form>
  )
}

/** 주문 이력: 주문 목록 + 상품별 구매평 보기/작성 */
function OrderHistorySection() {
  const queryClient = useQueryClient()
  const [writingReviewProductId, setWritingReviewProductId] = useState<string | null>(null)

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['shop', 'my-orders'],
    queryFn: fetchMyOrders,
  })
  const { data: myReviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['shop', 'my-reviews'],
    queryFn: fetchMyReviews,
  })

  const reviewByProductId = Object.fromEntries(
    myReviews.map((r) => [r.productId, r])
  )

  const handleReviewSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['shop', 'my-reviews'] })
    queryClient.invalidateQueries({ queryKey: ['shop', 'my-orders'] })
    setWritingReviewProductId(null)
  }

  if (ordersLoading || reviewsLoading) {
    return (
      <p className="mono text-dot-secondary">Loading…</p>
    )
  }

  if (orders.length === 0) {
    return (
      <p className="text-[0.95rem] text-dot-secondary">
        주문 내역이 없습니다. 첫 구매 후 여기에서 주문 이력과 구매평 작성을 확인할 수 있습니다.
      </p>
    )
  }

  return (
    <div className="space-y-12">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          reviewByProductId={reviewByProductId}
          writingReviewProductId={writingReviewProductId}
          onStartWriteReview={setWritingReviewProductId}
          onCancelWriteReview={() => setWritingReviewProductId(null)}
          onReviewSuccess={handleReviewSuccess}
        />
      ))}
    </div>
  )
}

interface OrderCardProps {
  order: OrderRow
  reviewByProductId: Record<string, MyReviewItem>
  writingReviewProductId: string | null
  onStartWriteReview: (productId: string) => void
  onCancelWriteReview: () => void
  onReviewSuccess: () => void
}

function OrderCard({
  order,
  reviewByProductId,
  writingReviewProductId,
  onStartWriteReview,
  onCancelWriteReview,
  onReviewSuccess,
}: OrderCardProps) {
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
  const statusLabel: Record<string, string> = {
    pending: 'PENDING',
    paid: 'PAID',
    shipped: 'SHIPPED',
    delivered: 'DELIVERED',
    cancelled: 'CANCELLED',
  }

  return (
    <div className="border border-[#eee] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#eee] px-6 py-5">
        <div className="flex flex-col gap-1">
          <span className="mono text-[0.7rem] text-dot-secondary">ORDER NUMBER</span>
          <p className="mono text-[0.9rem] font-medium tracking-wider text-dot-primary">
            #{order.orderNumber}
          </p>
        </div>
        <div className="flex flex-col gap-1 text-right">
          <span className="mono text-[0.7rem] text-dot-secondary">STATUS</span>
          <p className="mono text-[0.85rem] font-medium tracking-widest text-dot-primary">
            {statusLabel[order.status] ?? order.status.toUpperCase()}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-[#f0f0f0]">
        {order.orderItems.map((item) => (
          <OrderItemRow
            key={item.id}
            item={item}
            orderDate={orderDate}
            myReview={reviewByProductId[item.productId]}
            isWriting={writingReviewProductId === item.productId}
            onStartWriteReview={() => onStartWriteReview(item.productId)}
            onCancelWriteReview={onCancelWriteReview}
            onReviewSuccess={onReviewSuccess}
          />
        ))}
      </ul>
      <div className="border-t border-[#eee] bg-[#fafafa] px-6 py-4 text-right">
        <span className="mono mr-4 text-[0.75rem] text-dot-secondary">TOTAL AMOUNT</span>
        <span className="text-[1.1rem] font-medium text-dot-primary">
          ₩{order.total.toLocaleString('ko-KR')}
        </span>
      </div>
    </div>
  )
}

interface OrderItemRowProps {
  item: OrderItemRow
  orderDate: string
  myReview: MyReviewItem | undefined
  isWriting: boolean
  onStartWriteReview: () => void
  onCancelWriteReview: () => void
  onReviewSuccess: () => void
}

function OrderItemRow({
  item,
  orderDate,
  myReview,
  isWriting,
  onStartWriteReview,
  onCancelWriteReview,
  onReviewSuccess,
}: OrderItemRowProps) {
  return (
    <li className="px-6 py-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Product Image Placeholder (since OrderItemRow doesn't have image URL directly, 
            we can use a placeholder or link to product) */}
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-sm bg-[#F2F2F2]">
          <Link to={`/shop/product/${item.productId}`}>
            <div className="flex h-full w-full items-center justify-center text-[0.6rem] text-[#999]">
              IMAGE
            </div>
          </Link>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1">
            <Link
              to={`/shop/product/${item.productId}`}
              className="font-serif text-[1.2rem] font-normal tracking-wide text-dot-primary hover:underline"
            >
              {item.productName.toUpperCase()}
            </Link>
            <p className="text-[0.9rem] text-dot-secondary">
              {item.optionLabel ? `${item.optionLabel} | ` : ''}
              Qty: {item.quantity} | ₩{item.price.toLocaleString('ko-KR')}
            </p>
            <span className="mono mt-1 text-[0.7rem] text-dot-secondary">
              Ordered on {orderDate}
            </span>
          </div>

          {myReview ? (
            <div className="mt-6 rounded-sm border border-[#eee] bg-dot-bg p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="mono text-[0.7rem] font-medium tracking-widest text-dot-primary">
                  YOUR REVIEW
                </span>
                <span className="mono text-[0.65rem] text-dot-secondary">
                  {new Date(myReview.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                  })}
                </span>
              </div>
              {myReview.rating != null && (
                <div className="mb-3 flex gap-0.5 text-amber-500" aria-label={`별점 ${myReview.rating}점`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className="text-sm leading-none">
                      {i <= myReview.rating! ? '★' : '☆'}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[0.95rem] italic leading-relaxed text-dot-primary">
                "{myReview.body}"
              </p>
              {myReview.images?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {myReview.images.map((img) => (
                    <a
                      key={img.id}
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-20 w-20 overflow-hidden rounded-sm border border-[#eee] bg-white"
                    >
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : isWriting ? (
            <div className="mt-6">
              <ProductReviewForm
                productId={item.productId}
                productName={item.productName}
                onSuccess={onReviewSuccess}
                onCancel={onCancelWriteReview}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={onStartWriteReview}
              className="mono mt-6 border border-dot-primary bg-transparent px-5 py-2 text-[0.75rem] font-medium tracking-[0.15em] text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
            >
              WRITE A REVIEW
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
