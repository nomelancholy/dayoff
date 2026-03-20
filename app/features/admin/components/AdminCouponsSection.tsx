import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Coupon } from '@/features/coupon/types/coupon'
import type { DiscountType, UpdateAdminCouponInput } from '@/features/coupon/api/adminCoupon'
import {
  createAdminCoupon,
  deleteAdminCoupon,
  fetchAdminCoupons,
  issueAdminCoupon,
  updateAdminCoupon,
} from '@/features/coupon/api/adminCoupon'
import { getApiErrorMessage } from '@/features/auth/api/auth'
import { cn } from '@/common/lib/utils'
import { fetchAdminUsers, type AdminUserListItem } from '../api/adminUsers'

type CouponFormState = {
  mode: 'create' | 'edit'
  couponId?: string
  code: string
  discountType: DiscountType
  discountValue: string
  minOrderAmount: string
  validFrom: string
  validUntil: string
  usageLimit: string
  isActive: boolean
}

const toDateInputValue = (iso: string): string => {
  const trimmed = iso.trim()
  if (trimmed.length >= 10) return trimmed.slice(0, 10)
  return ''
}

const normalizeNumberOrEmpty = (value: number | null | undefined): string => {
  if (value == null) return ''
  return String(value)
}

export const AdminCouponsSection = () => {
  const queryClient = useQueryClient()
  const { data: coupons, isLoading } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: fetchAdminCoupons,
  })

  const [form, setForm] = useState<CouponFormState>({
    mode: 'create',
    code: '',
    discountType: 'percent',
    discountValue: '',
    minOrderAmount: '',
    validFrom: '',
    validUntil: '',
    usageLimit: '',
    isActive: true,
  })

  const selectedCoupon = useMemo<Coupon | null>(() => {
    if (form.mode !== 'edit' || !form.couponId) return null
    return (coupons ?? []).find((c) => c.id === form.couponId) ?? null
  }, [coupons, form.couponId, form.mode])

  const resetForm = () => {
    setForm({
      mode: 'create',
      code: '',
      discountType: 'percent',
      discountValue: '',
      minOrderAmount: '',
      validFrom: '',
      validUntil: '',
      usageLimit: '',
      isActive: true,
    })
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const discountValue = Number(form.discountValue)
      if (!form.code.trim()) throw new Error('쿠폰 코드를 입력해 주세요.')
      if (!Number.isFinite(discountValue) || discountValue < 1) throw new Error('할인 값을 확인해 주세요.')
      if (!form.validFrom) throw new Error('유효 시작일을 입력해 주세요.')
      if (!form.validUntil) throw new Error('유효 종료일을 입력해 주세요.')

      const payload: Parameters<typeof createAdminCoupon>[0] = {
        code: form.code.trim(),
        discountType: form.discountType,
        discountValue,
        validFrom: form.validFrom,
        validUntil: form.validUntil,
        isActive: form.isActive,
      }

      if (form.minOrderAmount.trim() !== '') {
        const n = Number(form.minOrderAmount)
        if (Number.isFinite(n) && n >= 0) payload.minOrderAmount = n
      }
      if (form.usageLimit.trim() !== '') {
        const n = Number(form.usageLimit)
        if (Number.isFinite(n) && n >= 0) payload.usageLimit = n
      }

      return createAdminCoupon(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] })
      resetForm()
      alert('쿠폰이 생성되었습니다.')
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : '쿠폰 생성에 실패했습니다.'
      alert(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAdminCouponInput }) =>
      updateAdminCoupon(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] })
      resetForm()
      alert('쿠폰이 수정되었습니다.')
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : '쿠폰 수정에 실패했습니다.'
      alert(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] })
      alert('쿠폰이 삭제되었습니다.')
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : '쿠폰 삭제에 실패했습니다.'
      alert(msg)
    },
  })

  const [issueUserIdByCoupon, setIssueUserIdByCoupon] = useState<
    Record<string, string>
  >({})

  const [issueUserLabelByCoupon, setIssueUserLabelByCoupon] = useState<
    Record<string, string>
  >({})

  const [userPickerCouponId, setUserPickerCouponId] = useState<string | null>(
    null,
  )
  const [userSearchDraft, setUserSearchDraft] = useState('')
  const [userSearch, setUserSearch] = useState('')

  const issueMutation = useMutation({
    mutationFn: ({ couponId, userId }: { couponId: string; userId: string }) =>
      issueAdminCoupon(couponId, userId),
    onSuccess: () => {
      // 선택한 유저(UUID)는 이미 모달에서 확정되었으므로 상태를 유지합니다.
      alert('해당 회원에게 쿠폰이 지급되었습니다.')
      setUserPickerCouponId(null)
    },
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err, '쿠폰 지급에 실패했습니다.'))
    },
  })

  const formatUserLabel = (u: AdminUserListItem): string => {
    if (u.fullName) return `${u.fullName} (${u.email})`
    return u.email
  }

  const formatDate = (iso: string): string => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const {
    data: pickUsers,
    isLoading: isPickUsersLoading,
  } = useQuery({
    queryKey: ['admin', 'coupon-issue-users', userSearch],
    queryFn: () =>
      fetchAdminUsers({
        q: userSearch || undefined,
        page: 1,
        pageSize: 30,
      }),
    enabled: !!userPickerCouponId,
  })

  const setEditMode = (coupon: Coupon) => {
    setForm({
      mode: 'edit',
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      minOrderAmount: normalizeNumberOrEmpty(coupon.minOrderAmount),
      validFrom: toDateInputValue(coupon.validFrom),
      validUntil: toDateInputValue(coupon.validUntil),
      usageLimit: normalizeNumberOrEmpty(coupon.usageLimit),
      isActive: coupon.isActive,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.mode === 'create') {
      createMutation.mutate()
      return
    }
    if (!form.couponId) {
      alert('수정할 쿠폰을 선택해 주세요.')
      return
    }

    const discountValue = Number(form.discountValue)
    const payload: UpdateAdminCouponInput = {
      code: form.code.trim(),
      discountType: form.discountType,
      discountValue,
      validFrom: form.validFrom,
      validUntil: form.validUntil,
      isActive: form.isActive,
    }

    if (form.minOrderAmount.trim() !== '') {
      const n = Number(form.minOrderAmount)
      if (Number.isFinite(n)) payload.minOrderAmount = n
      else payload.minOrderAmount = null
    }
    if (form.usageLimit.trim() !== '') {
      const n = Number(form.usageLimit)
      if (Number.isFinite(n)) payload.usageLimit = n
      else payload.usageLimit = null
    }

    updateMutation.mutate({ id: form.couponId, input: payload })
  }

  const list = coupons ?? []

  return (
    <>
      <section className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl tracking-[0.08em] text-dot-primary">쿠폰</h2>
      </div>

      <div className="flex flex-col gap-6">
        <div className="order-2 overflow-x-auto rounded border border-[#eee] bg-white">
          {isLoading ? (
            <div className="p-6 text-dot-secondary">Loading…</div>
          ) : list.length === 0 ? (
            <div className="p-6 text-dot-secondary">쿠폰이 없습니다.</div>
          ) : (
            <table className="min-w-[960px] border-collapse">
              <thead>
                <tr className="border-b border-[#eee] text-left text-[0.85rem] text-dot-secondary">
                  <th className="px-4 py-3">코드</th>
                  <th className="px-4 py-3">할인 값</th>
                  <th className="px-4 py-3">할인 방식</th>
                  <th className="px-4 py-3">잔여 사용 횟수</th>
                  <th className="px-4 py-3">최소 주문 금액</th>
                  <th className="min-w-[240px] px-4 py-3">유효기간</th>
                  <th className="px-4 py-3">활성</th>
                  <th className="min-w-[280px] px-4 py-3">회원 지급</th>
                  <th className="px-4 py-3">작업</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b border-[#f3f3f3]">
                    <td className="px-4 py-3 font-medium text-dot-primary">{c.code}</td>
                    <td className="px-4 py-3 text-dot-primary">{c.discountValue}</td>
                    <td className="px-4 py-3 text-dot-secondary">{c.discountType}</td>
                    <td className="px-4 py-3">
                      {c.usageLimit == null
                        ? '무제한'
                        : `${Math.max(0, c.usageLimit - c.usedCount)}회`}
                    </td>
                    <td className="px-4 py-3 text-dot-secondary">
                      {c.minOrderAmount == null
                        ? '없음'
                        : `₩${c.minOrderAmount.toLocaleString()}`}
                    </td>
                    <td className="px-4 py-3 text-dot-secondary whitespace-nowrap">
                      {formatDate(c.validFrom)} ~ {formatDate(c.validUntil)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded px-2 py-1 text-[0.8rem]',
                          c.isActive
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-700',
                        )}
                      >
                        {c.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex max-w-[320px] flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setUserPickerCouponId(c.id)}
                          className="rounded border border-[#ddd] bg-white px-3 py-2 text-left text-[0.78rem] font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7] disabled:opacity-50"
                        >
                          {issueUserIdByCoupon[c.id]
                            ? '선택됨: ' +
                              (issueUserLabelByCoupon[c.id] ??
                                issueUserIdByCoupon[c.id])
                            : '회원 명단에서 선택'}
                        </button>
                        {issueUserIdByCoupon[c.id] ? (
                          <p className="mono break-all text-[0.7rem] text-dot-secondary">
                            {issueUserIdByCoupon[c.id]}
                          </p>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[0.7rem] leading-snug text-dot-secondary">
                        활성·유효기간 내 쿠폰만 지급됩니다. 미사용 동일 쿠폰이 있으면 거절됩니다.
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEditMode(c)}
                          className="rounded bg-[#1A1A1A] px-3 py-2 text-[0.82rem] font-medium text-white transition-opacity hover:opacity-90"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`쿠폰 ${c.code} 를 삭제할까요?`)) return
                            deleteMutation.mutate(c.id)
                          }}
                          className="rounded border border-[#ddd] bg-white px-3 py-2 text-[0.82rem] font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7]"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="order-1 rounded border border-[#eee] bg-white p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h3 className="font-serif text-lg text-dot-primary">
                {form.mode === 'create' ? '쿠폰 생성' : '쿠폰 수정'}
              </h3>
              {selectedCoupon && form.mode === 'edit' ? (
                <p className="mt-1 text-[0.85rem] text-dot-secondary">
                  {selectedCoupon.id}
                </p>
              ) : null}
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-[0.8rem] text-dot-secondary">쿠폰 코드</span>
              <input
                value={form.code}
                onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
                className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
                placeholder="예: DAYOFF10"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-[0.8rem] text-dot-secondary">할인 방식</span>
                <select
                  value={form.discountType}
                  onChange={(e) => setForm((s) => ({ ...s, discountType: e.target.value as DiscountType }))}
                  className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
                >
                  <option value="percent">percent</option>
                  <option value="fixed">fixed</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[0.8rem] text-dot-secondary">할인 값</span>
                <input
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => setForm((s) => ({ ...s, discountValue: e.target.value }))}
                  className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
                  placeholder="예: 10"
                  required
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-[0.8rem] text-dot-secondary">최소 주문 금액 (선택)</span>
                <input
                  type="number"
                  value={form.minOrderAmount}
                  onChange={(e) => setForm((s) => ({ ...s, minOrderAmount: e.target.value }))}
                  className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
                  placeholder="예: 30000"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[0.8rem] text-dot-secondary">사용 횟수 제한 (선택)</span>
                <input
                  type="number"
                  value={form.usageLimit}
                  onChange={(e) => setForm((s) => ({ ...s, usageLimit: e.target.value }))}
                  className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
                  placeholder="예: 100"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-[0.8rem] text-dot-secondary">유효 시작일</span>
                <input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm((s) => ({ ...s, validFrom: e.target.value }))}
                  className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
                  required
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[0.8rem] text-dot-secondary">유효 종료일</span>
                <input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm((s) => ({ ...s, validUntil: e.target.value }))}
                  className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
                  required
                />
              </label>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))}
              />
              <span className="text-[0.9rem] text-dot-secondary">활성</span>
            </label>

            <div className="flex gap-3">
              {form.mode === 'edit' ? (
                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="w-full rounded border border-[#ddd] bg-white px-4 py-2 text-sm font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7]"
                >
                  취소
                </button>
              ) : null}
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full rounded bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {form.mode === 'create'
                  ? createMutation.isPending
                    ? '생성 중…'
                    : '생성'
                  : updateMutation.isPending
                    ? '저장 중…'
                    : '저장'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
    {userPickerCouponId ? (
      <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/40 p-6">
        <div className="w-full max-w-4xl overflow-hidden rounded border border-[#eee] bg-white">
          <div className="flex items-start justify-between border-b border-[#eee] p-5">
            <div>
              <h3 className="font-serif text-2xl tracking-[0.08em] text-dot-primary">
                회원 명단
              </h3>
              <p className="mt-2 text-[0.95rem] text-dot-secondary">
                체크한 사용자가 해당 쿠폰에 연결됩니다. (최대 30명)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUserPickerCouponId(null)}
              className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7]"
            >
              닫기
            </button>
          </div>

          <div className="p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="flex flex-1 flex-col gap-2">
                <span className="text-[0.8rem] text-dot-secondary">검색</span>
                <input
                  value={userSearchDraft}
                  onChange={(e) => setUserSearchDraft(e.target.value)}
                  placeholder="이메일 또는 이름"
                  className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => setUserSearch(userSearchDraft.trim())}
                className="mono shrink-0 rounded bg-[#1A1A1A] px-4 py-2 text-sm font-medium uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-90"
              >
                검색
              </button>
            </div>

            <div className="max-h-[420px] overflow-auto rounded border border-[#eee]">
              {isPickUsersLoading ? (
                <div className="p-6 text-dot-secondary">Loading…</div>
              ) : pickUsers && pickUsers.items.length ? (
                <table className="min-w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#eee] text-[0.85rem] text-dot-secondary">
                      <th className="px-3 py-2 w-[60px]">선택</th>
                      <th className="px-3 py-2">이메일</th>
                      <th className="px-3 py-2">이름</th>
                      <th className="px-3 py-2 w-[90px]">역할</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickUsers.items.map((u) => {
                      const checkedId = issueUserIdByCoupon[userPickerCouponId] ?? null
                      const checked = checkedId === u.id
                      const disabled =
                        issueMutation.isPending &&
                        issueMutation.variables?.couponId ===
                          userPickerCouponId

                      return (
                        <tr
                          key={u.id}
                          className="border-b border-[#f3f3f3] last:border-b-0"
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={(e) => {
                                if (!e.target.checked) return
                                const couponId = userPickerCouponId
                                setIssueUserIdByCoupon((prev) => ({
                                  ...prev,
                                  [couponId]: u.id,
                                }))
                                setIssueUserLabelByCoupon((prev) => ({
                                  ...prev,
                                  [couponId]: formatUserLabel(u),
                                }))
                                issueMutation.mutate({
                                  couponId,
                                  userId: u.id,
                                })
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 text-dot-primary">
                            {u.email}
                          </td>
                          <td className="px-3 py-2 text-dot-secondary">
                            {u.fullName ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-dot-secondary">
                            {u.role}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-dot-secondary">
                  조건에 맞는 사용자가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ) : null}
    </>
  )
}

