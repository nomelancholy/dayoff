import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
  deleteMyAccount,
  type AuthUser,
  type AddressRow,
  getApiErrorMessage,
} from '@/features/auth/api/auth'
import {
  fetchMyOrders,
  fetchMyReviews,
  deleteMyReview,
  type MyReviewItem,
  type OrderRow,
  type OrderItemRow,
  type ProductReviewImage,
} from '@/features/shop/api/shop'
import { ProductReviewForm } from '@/features/shop/components/ProductReviewForm'
import { ProductReviewEditForm } from '@/features/shop/components/ProductReviewEditForm'
import { cn } from '@/common/lib/utils'
import {
  isOptionalKoreanMobile,
  KOREAN_PHONE_INVALID_MESSAGE,
  phoneDigitsOnly,
} from '@/common/lib/koreanPhone'
import { useUiStore } from '@/common/store/ui'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { isOutOfDeliveryPostalCode } from '@/common/lib/outOfDeliveryAreas'

type AccountSection = 'profile' | 'orders' | 'address' | 'reviews'

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  // 입력 중간(12자리 이하)에는 최대한 보기 좋게만 하이픈 처리
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

export const AccountPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const token = getStoredToken()

  type AccountLocationState = { activeSection?: AccountSection }
  const initialSection =
    (location.state as AccountLocationState | null)?.activeSection ?? 'profile'

  const [activeSection, setActiveSection] =
    useState<AccountSection>(initialSection)

  const {
    data: user,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    enabled: !!token,
  })

  const handleLogout = () => {
    clearStoredToken()
    navigate('/login', { replace: true })
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-dot-bg px-4 py-28 md:px-16 md:py-48">
        <div className="mx-auto max-w-md">
          <h1 className="mt-2 font-sans text-4xl font-semibold tracking-normal text-dot-primary md:text-5xl">
         내 정보
          </h1>
          <p className="mt-4 text-[0.9rem] text-dot-secondary">
            계정 정보를 확인하려면 로그인해 주세요.
          </p>

          <div className="mt-12">
            <LoginForm />
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dot-bg px-4 py-28 md:px-16 md:py-48">
        <div className="mx-auto max-w-[1200px]">
          <p className="mono text-dot-secondary">Loading…</p>
        </div>
      </div>
    )
  }

  if (isError || !user) {
    return (
      <div className="min-h-screen bg-dot-bg px-4 py-28 md:px-16 md:py-48">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-sans text-3xl font-semibold tracking-normal text-dot-primary">
       내 정보
          </h1>
          <p className="mt-6 text-[0.9rem] text-dot-secondary">
            로그인 상태를 확인하지 못했습니다. (세션 만료 또는 API 연결 문제)
          </p>
          {error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof (error as { message: unknown }).message === 'string' ? (
            <p className="mt-3 font-mono text-[0.7rem] text-dot-secondary/80 break-all">
              {(error as { message: string }).message}
            </p>
          ) : null}
          <p className="mt-4 text-[0.75rem] leading-relaxed text-dot-secondary">
            HTTPS로 보는데 빌드 시 <code className="mono">PUBLIC_ORIGIN</code> 이{' '}
            <code className="mono">http://</code> 이면 API가 막힙니다.{' '}
            <code className="mono">FRONTEND_URL</code>·콜백 URL은 주소창 호스트와
            같게(www 포함) 맞추고, Cloudflare에서 <code className="mono">/auth</code>{' '}
            캐시는 끄는 것을 권장합니다.
          </p>
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

  // 일반 유저는 "리뷰 관리" 탭이 필요 없으므로 내정보에서 제거합니다.
  // (리뷰 작성/수정은 주문내역 카드에서만 제공)
  const navItems: { id: AccountSection; label: string }[] = [
    { id: 'profile', label: '프로필' },
    { id: 'orders', label: '주문 내역' },
    { id: 'address', label: '주소록' },
  ]

  // location.state 등에 의해 'reviews'가 들어와도 화면에서는 프로필로 대체합니다.
  const currentSection: AccountSection =
    activeSection === 'reviews' ? 'profile' : activeSection

  return (
    <div className="min-h-screen bg-dot-bg px-4 py-28 md:px-16 md:py-48">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-16 md:grid-cols-[250px_1fr]">
        <header className="flex flex-col gap-4 border-b border-black/5 pb-6 md:col-span-full md:flex-row md:items-end md:justify-between md:pb-8">
          <div>
            <h1 className="mt-2 font-sans text-4xl font-semibold tracking-normal text-dot-primary md:text-5xl">
              내 정보
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
                'mono relative border-0 bg-transparent pl-6 text-left py-1.5 leading-tight text-[1rem] text-dot-secondary transition-colors cursor-pointer outline-none! ring-0! focus:outline-none! focus-visible:outline-none! focus:ring-0! focus-visible:ring-0! md:pl-0 md:py-2 md:text-[1.05rem]',
                currentSection === id
                  ? 'font-medium text-dot-primary'
                  : 'hover:text-dot-primary'
              )}
            >
              {label}
              {currentSection === id && (
                <span className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-dot-primary md:-left-5" />
              )}
            </button>
          ))}
        </aside>

        <div className="min-w-0">
          {currentSection === 'profile' && (
            <ProfileSection key={user.id} user={user} />
          )}

          {currentSection === 'orders' && <OrderHistorySection />}

          {currentSection === 'address' && <AddressBookSection />}
        </div>
      </div>
    </div>
  )
}

/** 프로필 수정 폼 (reference: account.html .profile-form) */
function ProfileSection({ user }: { user: AuthUser }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const showToast = useUiStore((s) => s.showToast)
  const [fullName, setFullName] = useState(user.fullName ?? '')
  const [phone, setPhone] = useState(formatPhone(user.phone ?? ''))
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const profileMutation = useMutation({
    mutationFn: () => {
      const digits = phoneDigitsOnly(phone)
      return updateProfile({
        fullName: fullName.trim() || undefined,
        phone: digits.length > 0 ? digits : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      showToast({
        variant: 'success',
        message: '프로필이 저장되었습니다.',
      })
    },
    onError: (err: unknown) => {
      showToast({
        variant: 'warning',
        message: getApiErrorMessage(err, '저장에 실패했습니다.'),
      })
    },
  })

  const deleteAccountMutation = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      clearStoredToken()
      queryClient.clear()
      showToast({
        variant: 'success',
        message: '회원 탈퇴가 완료되었습니다.',
      })
      navigate('/login', { replace: true })
    },
    onError: (err: unknown) => {
      showToast({
        variant: 'warning',
        message: getApiErrorMessage(err, '회원 탈퇴에 실패했습니다.'),
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isOptionalKoreanMobile(phone)) {
      showToast({
        variant: 'warning',
        message: KOREAN_PHONE_INVALID_MESSAGE,
      })
      return
    }
    profileMutation.mutate()
  }

  return (
    <section>
      <h2 className="mono mb-10 border-b-0 pb-0 md:mb-12 md:border-b md:border-[#f0f0f0] md:pb-4 text-[1.8rem] font-normal tracking-[0.12em] text-dot-primary">
        개인 정보
      </h2>
      <form className="max-w-[600px] space-y-8" onSubmit={handleSubmit}>
        <div>
          <label className="mono mb-2 block text-[0.85rem] text-dot-primary">
            닉네임
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
            이메일 주소
          </label>
          <input
            type="email"
            value={user.email}
            readOnly
            className="w-full border border-[#eee] bg-[#f9f9f9] px-4 py-3 text-[0.95rem] text-dot-secondary read-only:cursor-default"
          />
          <p className="mt-1 text-[0.7rem] text-dot-secondary">
            이메일은 변경할 수 없습니다.
          </p>
        </div>
        <div>
          <label className="mono mb-2 block text-[0.85rem] text-dot-primary">
            휴대폰 번호
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            className="w-full border border-[#eee] bg-white px-4 py-3 text-[0.95rem] text-dot-primary placeholder:text-dot-secondary focus:border-dot-primary focus:outline-none"
          />
          <p className="mt-1 text-[0.7rem] text-dot-secondary">
            010·011 등 국내 휴대폰 번호만 입력 가능합니다. 비워 두면 저장 시 번호가
            삭제됩니다.
          </p>
        </div>
        <button
          type="submit"
          disabled={profileMutation.isPending}
          className="mono mt-2 border-none bg-[#1A1A1A] px-8 py-3 text-[0.9rem] font-medium text-white transition-opacity hover:bg-[#333] disabled:opacity-50"
        >
          {profileMutation.isPending ? '저장 중…' : '변경사항 저장'}
        </button>
        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={deleteAccountMutation.isPending}
            onClick={() => {
              setDeleteConfirmOpen(true)
            }}
            className="mono border-none bg-transparent text-[0.8rem] text-red-600 underline underline-offset-4 transition-colors hover:text-red-700 disabled:opacity-60"
          >
            {deleteAccountMutation.isPending ? '탈퇴 처리 중…' : '회원 탈퇴'}
          </button>
        </div>
      </form>

      {deleteConfirmOpen ? (
        <div
          className="fixed inset-0 z-100000 flex items-center justify-center bg-[#f5f3ef]/90 p-6 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label="회원 탈퇴 확인"
        >
          <div className="w-full max-w-md border border-[#e7e2d8] bg-[#fcfaf6] p-7 shadow-[0_18px_50px_rgba(32,22,8,0.12)]">
            <h3 className="font-serif text-[1.4rem] tracking-[0.04em] text-dot-primary">
              회원 탈퇴
            </h3>
            <p className="mt-4 text-[0.92rem] leading-relaxed text-dot-secondary">
              탈퇴 시 주문, 배송, 리뷰 내역이 함께 삭제되며 복구할 수 없습니다.
            </p>

            <div className="mt-7 flex gap-3">
              <button
                type="button"
                disabled={deleteAccountMutation.isPending}
                onClick={() => setDeleteConfirmOpen(false)}
                className="mono flex-1 border border-[#d9d3c8] bg-transparent py-2.5 text-[0.82rem] tracking-[0.08em] text-dot-primary transition-colors hover:bg-[#f3eee4] disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleteAccountMutation.isPending}
                onClick={() => {
                  deleteAccountMutation.mutate()
                }}
                className="mono flex-1 border border-[#1a1a1a] bg-[#1a1a1a] py-2.5 text-[0.82rem] tracking-[0.08em] text-white transition-colors hover:bg-[#333] disabled:opacity-60"
              >
                {deleteAccountMutation.isPending ? '탈퇴 처리 중…' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

/** 주소록: 목록 + 추가/수정/삭제 (reference: account.html #address) */
function AddressBookSection() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

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
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Parameters<typeof updateAddress>[1]
    }) => updateAddress(id, data),
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
      setDeleteConfirmId(null)
    },
    onError: (err: unknown) => {
      alert(
        getApiErrorMessage(err, '주소 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
      )
    },
  })

  if (isLoading) {
    return (
      <section>
        <h2 className="mono mb-12 border-b border-[#f0f0f0] pb-4 text-[1.8rem] font-normal tracking-[0.12em] text-dot-primary">
          주소록
        </h2>
        <p className="text-dot-secondary">Loading…</p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="mono mb-10 border-b-0 pb-0 md:mb-12 md:border-b md:border-[#f0f0f0] md:pb-4 text-[1.8rem] font-normal tracking-[0.12em] text-dot-primary">
        주소록
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
                      <span className="mono ml-2 text-[0.75rem] text-dot-secondary">
                        (DEFAULT)
                      </span>
                    )}
                    {isOutOfDeliveryPostalCode(addr.postalCode) && (
                      <span className="mono ml-2 text-[0.75rem] text-dot-primary">
                        도서 산간 지역
                      </span>
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
                    {[addr.recipientName, addr.phone]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                      setDeleteConfirmId(addr.id)
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
            + 새 주소 추가
          </button>
        )}
      </div>
      {addresses.length === 0 && !adding && (
        <p className="mt-6 text-[0.95rem] text-dot-secondary">
          저장된 주소가 없습니다. 위 버튼으로 추가하세요.
        </p>
      )}

      {deleteConfirmId ? (
        <div
          className="fixed inset-0 z-100000 flex items-center justify-center bg-black/40 p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="font-serif text-[1.35rem] text-dot-primary">
              이 주소를 삭제할까요?
            </h3>
            <p className="mt-3 text-[0.95rem] text-dot-secondary">
              삭제한 주소는 복구할 수 없습니다.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="mono flex-1 border border-[#ddd] bg-white py-2.5 text-[0.85rem] text-[#1A1A1A] hover:bg-[#fafafa]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="mono flex-1 border-none bg-red-600 py-2.5 text-[0.85rem] font-medium text-white disabled:opacity-50"
              >
                {deleteMutation.isPending ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
  type KakaoPostcodeData = {
    zonecode: string
    roadAddress: string
    jibunAddress: string
    userSelectedType: string
  }

  type KakaoPostcodeInstance = {
    open: () => void
  }

  type KakaoPostcodeConstructor = new (options: {
    oncomplete: (data: KakaoPostcodeData) => void
  }) => KakaoPostcodeInstance

  const KAKAO_POSTCODE_SCRIPT_URL =
    '//t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

  const ensureKakaoPostcodeLoaded = async (): Promise<void> => {
    if (typeof window === 'undefined') return
    const w = window as unknown as {
      kakao?: { Postcode?: KakaoPostcodeConstructor }
    }
    if (w.kakao?.Postcode) return

    const existing = document.getElementById('kakao-postcode-script')
    if (existing) {
      // 로딩 중/완료 상태를 알기 위해 promise를 재사용 (id 중복 삽입 방지)
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 400)
      })
      return
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.id = 'kakao-postcode-script'
      script.src = KAKAO_POSTCODE_SCRIPT_URL
      script.async = true
      script.onload = () => resolve()
      script.onerror = () =>
        reject(new Error('카카오 우편번호 스크립트 로드에 실패했습니다.'))
      document.body.appendChild(script)
    })
  }

  const [label, setLabel] = useState(address?.label ?? '')
  const [recipientName, setRecipientName] = useState(
    address?.recipientName ?? ''
  )
  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, '')
    if (!digits) return ''
    if (digits.length === 11)
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    if (digits.length === 10)
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    // 입력 중간(12자리 이하)에는 최대한 보기 좋게만 하이픈 처리
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
  }

  const [phone, setPhone] = useState(formatPhone(address?.phone ?? ''))
  const [postalCode, setPostalCode] = useState(address?.postalCode ?? '')
  const [addressLine1, setAddressLine1] = useState(address?.addressLine1 ?? '')
  const [addressLine2, setAddressLine2] = useState(address?.addressLine2 ?? '')
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false)
  const [postcodeLoading, setPostcodeLoading] = useState(false)
  const addressLine2Ref = useRef<HTMLInputElement | null>(null)

  const handleOpenPostcode = async () => {
    if (postcodeLoading) return
    try {
      setPostcodeLoading(true)
      await ensureKakaoPostcodeLoaded()
      const w = window as unknown as {
        kakao?: { Postcode?: KakaoPostcodeConstructor }
      }
      if (!w.kakao?.Postcode) return

      const Postcode = w.kakao.Postcode
      new Postcode({
        oncomplete: (data: KakaoPostcodeData) => {
          setPostalCode(data.zonecode)
          const selected =
            data.userSelectedType === 'J' ? data.jibunAddress : data.roadAddress
          setAddressLine1(selected || data.roadAddress || data.jibunAddress)
          setTimeout(() => addressLine2Ref.current?.focus(), 0)
        },
      }).open()
    } finally {
      setPostcodeLoading(false)
    }
  }

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
        <label className="mono mb-1 block text-[0.8rem] text-dot-primary">
          주소 별칭 (예: 집, 회사)
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="집"
          className="w-full border border-[#eee] bg-white px-3 py-2 text-[0.95rem] focus:border-dot-primary focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="mono mb-1 block text-[0.8rem] text-dot-primary">
          받는 분
        </label>
        <input
          type="text"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="수령인"
          className="w-full border border-[#eee] bg-white px-3 py-2 text-[0.95rem] focus:border-dot-primary focus:outline-none"
        />
      </div>
      <div>
        <label className="mono mb-1 block text-[0.8rem] text-dot-primary">
          연락처
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="010-1234-5678"
          className="w-full border border-[#eee] bg-white px-3 py-2 text-[0.95rem] focus:border-dot-primary focus:outline-none"
        />
      </div>
      <div>
        <label className="mono mb-1 block text-[0.8rem] text-dot-primary">
          우편번호
        </label>
        <input
          type="text"
          value={postalCode}
          onChange={() => {}}
          readOnly
          onClick={handleOpenPostcode}
          className="w-full cursor-pointer border border-[#eee] bg-white px-3 py-2 text-[0.95rem] focus:border-dot-primary focus:outline-none"
          placeholder="우편번호"
        />
        <button
          type="button"
          onClick={handleOpenPostcode}
          disabled={postcodeLoading}
          className="mono mt-2 w-full border border-dot-primary bg-white py-2.5 text-[0.85rem] text-dot-primary disabled:opacity-50"
        >
          {postcodeLoading ? '불러오는 중…' : '우편번호 찾기'}
        </button>
        {postalCode && isOutOfDeliveryPostalCode(postalCode) && (
          <p className="mono mt-2 text-[0.75rem] text-dot-primary">
            도서 산간 지역
          </p>
        )}
      </div>
      <div>
        <label className="mono mb-1 block text-[0.8rem] text-dot-primary">
          주소
        </label>
        <input
          type="text"
          value={addressLine1}
          onChange={() => {}}
          readOnly
          onClick={handleOpenPostcode}
          className="w-full cursor-pointer border border-[#eee] bg-white px-3 py-2 text-[0.95rem] focus:border-dot-primary focus:outline-none"
          placeholder="도로명 또는 지번 주소"
          required
        />
      </div>
      <div>
        <label className="mono mb-1 block text-[0.8rem] text-dot-primary">
          상세 주소 (선택)
        </label>
        <input
          type="text"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          placeholder="상세 주소, 동/호수"
          ref={addressLine2Ref}
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
        <span className="text-[0.9rem] text-dot-primary">
          기본 배송지로 설정
        </span>
      </label>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="mono flex-1 border border-[#ddd] bg-white py-2.5 text-[0.85rem] text-[#1A1A1A] hover:bg-[#f9f9f9]"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="mono flex-1 border-none bg-[#1A1A1A] py-2.5 text-[0.85rem] text-white disabled:opacity-50"
        >
          {isPending ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  )
}

/** 주문 이력: 주문 목록 + 상품별 구매평 보기/작성 */
function OrderHistorySection() {
  const queryClient = useQueryClient()
  const [writingReviewOrderItemId, setWritingReviewOrderItemId] = useState<string | null>(null)
  const [reviewLightbox, setReviewLightbox] = useState<{
    images: ProductReviewImage[]
    index: number
  } | null>(null)
  const [editingReview, setEditingReview] = useState<MyReviewItem | null>(null)

  const { data: orders = [] as OrderRow[], isLoading: ordersLoading } =
    useQuery({
    queryKey: ['shop', 'my-orders'],
    queryFn: fetchMyOrders,
  })
  const { data: myReviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ['shop', 'my-reviews'],
    queryFn: fetchMyReviews,
  })

  // 주문 히스토리는 "결제 완료" 상태만 보여줍니다.
  const paidOrders = useMemo<OrderRow[]>(
    () =>
      orders.filter((o) => ['paid', 'shipped', 'delivered'].includes(o.status)),
    [orders],
  )

  const paidOrderItems = useMemo(
    () =>
      paidOrders.flatMap((order) =>
        order.orderItems.map((item) => ({
          item,
          orderCreatedAtMs: new Date(order.createdAt).getTime(),
        })),
      ),
    [paidOrders],
  )

  const reviewByOrderItemId = useMemo<Record<string, MyReviewItem>>(() => {
    const map: Record<string, MyReviewItem> = {}

    // 1) 이미 orderItemId가 있는 리뷰는 그대로 매핑
    myReviews
      .filter((r) => r.orderItemId)
      .forEach((r) => {
        if (r.orderItemId) map[r.orderItemId] = r
      })

    const usedOrderItemIds = new Set(Object.keys(map))

    // 2) 과거(productId 기준)로 저장된 리뷰(orderItemId = null)는
    //    "리뷰 작성 시점 이전의 가장 최근 주문"에만 표시되도록 보정
    const fallbackReviews = myReviews
      .filter((r) => !r.orderItemId)
      .slice()
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )

    for (const review of fallbackReviews) {
      const reviewTime = new Date(review.createdAt).getTime()

      const candidates = paidOrderItems.filter(
        (pi) =>
          pi.item.productId === review.productId &&
          !usedOrderItemIds.has(pi.item.id),
      )

      if (!candidates.length) continue

      const eligible = candidates.filter((pi) => pi.orderCreatedAtMs <= reviewTime)
      const chosen = (eligible.length ? eligible : candidates).sort(
        (a, b) => b.orderCreatedAtMs - a.orderCreatedAtMs,
      )[0]

      map[chosen.item.id] = review
      usedOrderItemIds.add(chosen.item.id)
    }

    return map
  }, [myReviews, paidOrderItems])

  const handleReviewSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['shop', 'my-reviews'] })
    queryClient.invalidateQueries({ queryKey: ['shop', 'my-orders'] })
    setWritingReviewOrderItemId(null)
  }

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId: string) => deleteMyReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'my-reviews'] })
      queryClient.invalidateQueries({ queryKey: ['shop', 'my-orders'] })
      setEditingReview(null)
      alert('리뷰가 삭제되었습니다.')
    },
    onError: (err: unknown) => {
      alert(err instanceof Error ? err.message : '리뷰 삭제에 실패했습니다.')
    },
  })

  useEffect(() => {
    if (!reviewLightbox) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setReviewLightbox(null)
        return
      }
      if (e.key === 'ArrowLeft') {
        setReviewLightbox((prev) => {
          if (!prev) return prev
          const len = prev.images.length
          if (len <= 1) return prev
          return { ...prev, index: (prev.index - 1 + len) % len }
        })
      }
      if (e.key === 'ArrowRight') {
        setReviewLightbox((prev) => {
          if (!prev) return prev
          const len = prev.images.length
          if (len <= 1) return prev
          return { ...prev, index: (prev.index + 1) % len }
        })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [reviewLightbox])

  const openReviewLightbox = (images: ProductReviewImage[], index: number) => {
    if (!images.length) return
    setReviewLightbox({ images, index })
  }

  const closeReviewLightbox = () => setReviewLightbox(null)

  const goReviewLightboxPrev = () => {
    setReviewLightbox((prev) => {
      if (!prev) return prev
      const len = prev.images.length
      if (len <= 1) return prev
      return { ...prev, index: (prev.index - 1 + len) % len }
    })
  }

  const goReviewLightboxNext = () => {
    setReviewLightbox((prev) => {
      if (!prev) return prev
      const len = prev.images.length
      if (len <= 1) return prev
      return { ...prev, index: (prev.index + 1) % len }
    })
  }

  if (ordersLoading || reviewsLoading) {
    return <p className="text-dot-secondary">Loading…</p>
  }

  if (paidOrders.length === 0) {
    return (
      <p className="text-[0.95rem] text-dot-secondary">
        주문 내역이 없습니다. 첫 구매 후 여기에서 주문 이력과 구매평 작성을
        확인할 수 있습니다.
      </p>
    )
  }

  return (
    <div className="space-y-12">
      {reviewLightbox && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4"
          onClick={closeReviewLightbox}
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white shadow-lg backdrop-blur-sm hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/50"
              onClick={closeReviewLightbox}
            >
              ×
            </button>

            {reviewLightbox.images.length > 0 && (
              <>
                <div className="flex items-center justify-center">
                  <img
                    src={reviewLightbox.images[reviewLightbox.index]?.url}
                    alt=""
                    className="max-h-[80vh] w-full object-contain"
                  />
                </div>

                <div className="mt-3 flex items-center justify-center gap-3">
                  <span className="text-[0.8rem] text-white/80">
                    {reviewLightbox.index + 1} / {reviewLightbox.images.length}
                  </span>
                </div>

                {reviewLightbox.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="이전"
                      className="absolute left-[-14px] top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white shadow-lg backdrop-blur-sm hover:bg-black/70"
                      onClick={goReviewLightboxPrev}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      aria-label="다음"
                      className="absolute right-[-14px] top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white shadow-lg backdrop-blur-sm hover:bg-black/70"
                      onClick={goReviewLightboxNext}
                    >
                      ›
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {editingReview && (
        <div
          className="fixed inset-0 z-100000 flex items-center justify-center bg-black/40 p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingReview(null)}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ProductReviewEditForm
              reviewId={editingReview.id}
              mode="my"
              initialBody={editingReview.body}
              initialRating={editingReview.rating}
              onCancel={() => setEditingReview(null)}
              onSuccess={() => {
                queryClient.invalidateQueries({
                  queryKey: ['shop', 'my-reviews'],
                })
                queryClient.invalidateQueries({
                  queryKey: ['shop', 'my-orders'],
                })
                setEditingReview(null)
              }}
            />
          </div>
        </div>
      )}
      {paidOrders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          reviewByOrderItemId={reviewByOrderItemId}
          writingReviewOrderItemId={writingReviewOrderItemId}
          onStartWriteReview={setWritingReviewOrderItemId}
          onOpenReviewImages={openReviewLightbox}
          onCancelWriteReview={() => setWritingReviewOrderItemId(null)}
          onReviewSuccess={handleReviewSuccess}
          onEditMyReview={(reviewId) => {
            const r = myReviews.find((x) => x.id === reviewId) ?? null
            setEditingReview(r)
          }}
          onDeleteMyReview={(reviewId) => {
            if (!window.confirm('이 리뷰를 삭제할까요?')) return
            deleteReviewMutation.mutate(reviewId)
          }}
        />
      ))}
    </div>
  )
}

interface OrderCardProps {
  order: OrderRow
  reviewByOrderItemId: Record<string, MyReviewItem>
  writingReviewOrderItemId: string | null
  onStartWriteReview: (orderItemId: string) => void
  onOpenReviewImages: (images: ProductReviewImage[], index: number) => void
  onCancelWriteReview: () => void
  onReviewSuccess: () => void
  onEditMyReview: (reviewId: string) => void
  onDeleteMyReview: (reviewId: string) => void
}

function OrderCard({
  order,
  reviewByOrderItemId,
  writingReviewOrderItemId,
  onStartWriteReview,
  onOpenReviewImages,
  onCancelWriteReview,
  onReviewSuccess,
  onEditMyReview,
  onDeleteMyReview,
}: OrderCardProps) {
  const orderDate = new Date(order.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
  const statusLabel: Record<string, string> = {
    pending: '결제 대기',
    paid: '결제 완료',
    shipped: '발송 완료',
    delivered: '배송 완료',
    cancelled: '취소됨',
  }

  return (
    <div className="border border-[#eee] bg-white">
      <div className="flex flex-col items-start gap-3 border-b border-[#eee] px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-1">
          <span className="text-[0.7rem] text-dot-secondary">
            주문 번호
          </span>
          <p className="text-[0.9rem] font-medium tracking-wider text-dot-primary">
            #{order.orderNumber}
          </p>
        </div>
        <div className="flex w-full flex-col gap-1 text-left md:w-auto md:text-right">
          <span className="text-[0.7rem] text-dot-secondary">상태</span>
          <p className="text-[0.85rem] font-medium tracking-widest text-dot-primary">
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
            orderStatus={order.status}
            myReview={reviewByOrderItemId[item.id]}
            isWriting={writingReviewOrderItemId === item.id}
            onStartWriteReview={() => onStartWriteReview(item.id)}
            onCancelWriteReview={onCancelWriteReview}
            onReviewSuccess={onReviewSuccess}
            onOpenReviewImages={onOpenReviewImages}
            onEditMyReview={onEditMyReview}
            onDeleteMyReview={onDeleteMyReview}
          />
        ))}
      </ul>
      <div className="border-t border-[#eee] bg-[#fafafa] px-6 py-4 text-right">
        <span className="mr-4 text-[0.75rem] text-dot-secondary">
          총 결제금액
        </span>
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
  orderStatus: OrderRow['status']
  myReview: MyReviewItem | undefined
  isWriting: boolean
  onStartWriteReview: () => void
  onCancelWriteReview: () => void
  onReviewSuccess: () => void
  onOpenReviewImages: (images: ProductReviewImage[], index: number) => void
  onEditMyReview: (reviewId: string) => void
  onDeleteMyReview: (reviewId: string) => void
}

function OrderItemRow({
  item,
  orderDate,
  orderStatus,
  myReview,
  isWriting,
  onStartWriteReview,
  onCancelWriteReview,
  onReviewSuccess,
  onOpenReviewImages,
  onEditMyReview,
  onDeleteMyReview,
}: OrderItemRowProps) {
  const canWriteReview = orderStatus === 'shipped'

  return (
    <li className="px-6 py-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-sm bg-[#F2F2F2]">
          <Link to={`/shop/${item.productId}`}>
            {item.product?.images?.[0]?.url ? (
              <img
                src={item.product.images[0].url}
                alt={item.productName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[0.6rem] text-[#999]">
                IMAGE
              </div>
            )}
          </Link>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1">
            <Link
              to={`/shop/${item.productId}`}
              className="text-[1.2rem] font-normal tracking-wide text-dot-primary hover:underline"
            >
              {item.productName.toUpperCase()}
            </Link>
            <p className="text-[0.9rem] text-dot-secondary">
              {item.optionLabel ? `${item.optionLabel} | ` : ''}
              수량: {item.quantity} | ₩{item.price.toLocaleString('ko-KR')}
            </p>
            <span className="mt-1 text-[0.7rem] text-dot-secondary">
              주문일 {orderDate}
            </span>
          </div>

          {myReview ? (
            <div className="mt-6 rounded-sm border border-[#eee] bg-dot-bg p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[0.7rem] font-medium tracking-widest text-dot-primary">
                  구매평
                </span>
                <span className="text-[0.65rem] text-dot-secondary">
                  {new Date(myReview.createdAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                  })}
                </span>
              </div>
              <div className="mb-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded border border-dot-primary bg-white px-3 py-2 text-[0.75rem] font-medium text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
                  onClick={() => onEditMyReview(myReview.id)}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="rounded border border-[#ddd] bg-white px-3 py-2 text-[0.75rem] font-medium text-[#1A1A1A] transition-colors hover:bg-[#fafafa]"
                  onClick={() => onDeleteMyReview(myReview.id)}
                >
                  삭제
                </button>
              </div>
              {myReview.rating != null && (
                <div
                  className="mb-3 flex gap-0.5 text-amber-500"
                  aria-label={`별점 ${myReview.rating}점`}
                >
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
                  {myReview.images.map((img, idx) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => onOpenReviewImages(myReview.images, idx)}
                      className="block h-20 w-20 overflow-hidden rounded-sm border border-[#eee] bg-white"
                      aria-label="리뷰 사진 보기"
                    >
                      <img
                        src={img.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : isWriting ? (
            <div className="mt-6">
              <ProductReviewForm
                productId={item.productId}
                orderItemId={item.id}
                productName={item.productName}
                onSuccess={onReviewSuccess}
                onCancel={onCancelWriteReview}
              />
            </div>
          ) : (
            canWriteReview ? (
              <button
                type="button"
                onClick={onStartWriteReview}
                className="mt-6 border border-dot-primary bg-transparent px-5 py-2 text-[0.75rem] font-medium tracking-[0.15em] text-dot-primary transition-colors hover:bg-dot-primary hover:text-white"
              >
                구매평 작성
              </button>
            ) : null
          )}
        </div>
      </div>
    </li>
  )
}
