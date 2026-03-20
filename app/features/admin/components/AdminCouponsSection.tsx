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

  const issueMutation = useMutation({
    mutationFn: ({ couponId, userId }: { couponId: string; userId: string }) =>
      issueAdminCoupon(couponId, userId),
    onSuccess: (_data, vars) => {
      setIssueUserIdByCoupon((prev) => {
        const next = { ...prev }
        delete next[vars.couponId]
        return next
      })
      alert('해당 회원에게 쿠폰이 지급되었습니다.')
    },
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err, '쿠폰 지급에 실패했습니다.'))
    },
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
    <section className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl tracking-[0.08em] text-dot-primary">COUPONS</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
        <div className="overflow-x-auto rounded border border-[#eee] bg-white">
          {isLoading ? (
            <div className="p-6 text-dot-secondary">Loading…</div>
          ) : list.length === 0 ? (
            <div className="p-6 text-dot-secondary">No coupons</div>
          ) : (
            <table className="min-w-[960px] border-collapse">
              <thead>
                <tr className="border-b border-[#eee] text-left text-[0.85rem] text-dot-secondary">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="min-w-[280px] px-4 py-3">회원 지급</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b border-[#f3f3f3]">
                    <td className="px-4 py-3 font-medium text-dot-primary">{c.code}</td>
                    <td className="px-4 py-3 text-dot-secondary">{c.discountType}</td>
                    <td className="px-4 py-3 text-dot-primary">{c.discountValue}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded px-2 py-1 text-[0.8rem]',
                          c.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700',
                        )}
                      >
                        {c.isActive ? 'Y' : 'N'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex max-w-[320px] flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="text"
                          value={issueUserIdByCoupon[c.id] ?? ''}
                          onChange={(e) =>
                            setIssueUserIdByCoupon((prev) => ({
                              ...prev,
                              [c.id]: e.target.value,
                            }))
                          }
                          placeholder="회원 UUID"
                          className="min-w-0 flex-1 rounded border border-[#ddd] bg-white px-2 py-1.5 font-mono text-[0.78rem] focus:border-dot-primary focus:outline-none"
                          disabled={
                            issueMutation.isPending &&
                            issueMutation.variables?.couponId === c.id
                          }
                        />
                        <button
                          type="button"
                          disabled={
                            issueMutation.isPending &&
                            issueMutation.variables?.couponId === c.id
                          }
                          onClick={() => {
                            const uid = (issueUserIdByCoupon[c.id] ?? '').trim()
                            if (!uid) {
                              alert('회원 UUID를 입력해 주세요. (USERS 탭 목록에서 확인)')
                              return
                            }
                            issueMutation.mutate({ couponId: c.id, userId: uid })
                          }}
                          className="shrink-0 rounded border border-[#1A1A1A] bg-white px-3 py-1.5 text-[0.78rem] font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7] disabled:opacity-50"
                        >
                          지급
                        </button>
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
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`쿠폰 ${c.code} 를 삭제할까요?`)) return
                            deleteMutation.mutate(c.id)
                          }}
                          className="rounded border border-[#ddd] bg-white px-3 py-2 text-[0.82rem] font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7]"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded border border-[#eee] bg-white p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h3 className="font-serif text-lg text-dot-primary">
                {form.mode === 'create' ? 'Create Coupon' : 'Edit Coupon'}
              </h3>
              {selectedCoupon && form.mode === 'edit' ? (
                <p className="mt-1 text-[0.85rem] text-dot-secondary">
                  {selectedCoupon.id}
                </p>
              ) : null}
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-[0.8rem] text-dot-secondary">Code</span>
              <input
                value={form.code}
                onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
                className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
                placeholder="e.g. DAYOFF10"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-[0.8rem] text-dot-secondary">Discount Type</span>
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
                <span className="text-[0.8rem] text-dot-secondary">Value</span>
                <input
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => setForm((s) => ({ ...s, discountValue: e.target.value }))}
                  className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
                  placeholder="1"
                  required
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-[0.8rem] text-dot-secondary">Min Order Amount (optional)</span>
                <input
                  type="number"
                  value={form.minOrderAmount}
                  onChange={(e) => setForm((s) => ({ ...s, minOrderAmount: e.target.value }))}
                  className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
                  placeholder="e.g. 30000"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[0.8rem] text-dot-secondary">Usage Limit (optional)</span>
                <input
                  type="number"
                  value={form.usageLimit}
                  onChange={(e) => setForm((s) => ({ ...s, usageLimit: e.target.value }))}
                  className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
                  placeholder="e.g. 100"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-[0.8rem] text-dot-secondary">Valid From</span>
                <input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm((s) => ({ ...s, validFrom: e.target.value }))}
                  className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
                  required
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[0.8rem] text-dot-secondary">Valid Until</span>
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
              <span className="text-[0.9rem] text-dot-secondary">Active</span>
            </label>

            <div className="flex gap-3">
              {form.mode === 'edit' ? (
                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="w-full rounded border border-[#ddd] bg-white px-4 py-2 text-sm font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7]"
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full rounded bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {form.mode === 'create'
                  ? createMutation.isPending
                    ? 'Creating…'
                    : 'Create'
                  : updateMutation.isPending
                    ? 'Saving…'
                    : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}

