import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/features/auth/api/auth'
import {
  fetchAdminUsers,
  fetchAdminUserAddresses,
  updateAdminUserRole,
  type UserRole,
  type AdminUserListItem,
  type AdminUserAddressItem,
} from '../api/adminUsers'
import { cn } from '@/common/lib/utils'

const PAGE_SIZE = 20

const formatJoined = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const providerLabel = (p: string): string => {
  if (p === 'email') return '이메일'
  if (p === 'kakao') return '카카오'
  if (p === 'google') return '구글'
  if (p === 'naver') return '네이버'
  return p
}

const formatAddressLine = (address: AdminUserAddressItem): string => {
  const base = [address.addressLine1, address.addressLine2].filter(Boolean).join(' ')
  if (address.postalCode) return `(${address.postalCode}) ${base}`
  return base
}

export const AdminUsersSection = ({
  currentUserId,
}: {
  currentUserId: string
}) => {
  const queryClient = useQueryClient()
  const [searchDraft, setSearchDraft] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<'' | UserRole>('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'users', { q: appliedQ, role: roleFilter, page }],
    queryFn: () =>
      fetchAdminUsers({
        q: appliedQ || undefined,
        role: roleFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      updateAdminUserRole(userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err, '역할 변경에 실패했습니다.'))
    },
  })

  const applySearch = () => {
    setPage(1)
    setAppliedQ(searchDraft.trim())
  }

  const onRoleFilterChange = (value: string) => {
    setRoleFilter(value === '' ? '' : (value as UserRole))
    setPage(1)
  }

  const onRowRoleChange = (user: AdminUserListItem, next: UserRole) => {
    if (next === user.role) return
    if (
      user.id === currentUserId &&
      user.role === 'admin' &&
      next === 'member'
    ) {
      alert('본인 계정의 관리자 권한은 해제할 수 없습니다.')
      return
    }
    if (!window.confirm(`이 사용자의 역할을 "${next}"(으)로 변경할까요?`)) {
      return
    }
    roleMutation.mutate({ userId: user.id, role: next })
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl tracking-[0.08em] text-dot-primary">
          USERS
        </h2>
        <p className="mt-1 text-[0.85rem] text-dot-secondary">
          이메일·이름 검색, 역할 필터, 역할 변경 (member ↔ admin)
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
          <span className="text-[0.8rem] text-dot-secondary">검색 (이메일·이름)</span>
          <div className="flex gap-2">
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch()
              }}
              className="min-w-0 flex-1 rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
              placeholder="검색어"
            />
            <button
              type="button"
              onClick={() => applySearch()}
              className="shrink-0 rounded bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              검색
            </button>
          </div>
        </div>
        <label className="flex flex-col gap-2 sm:w-44">
          <span className="text-[0.8rem] text-dot-secondary">역할</span>
          <select
            value={roleFilter}
            onChange={(e) => onRoleFilterChange(e.target.value)}
            className="rounded border border-[#ddd] bg-white px-3 py-2 text-sm focus:border-dot-primary focus:outline-none"
          >
            <option value="">전체</option>
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded border border-[#eee] bg-white">
        {isLoading ? (
          <div className="p-6 text-dot-secondary">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-dot-secondary">회원이 없습니다.</div>
        ) : (
          <table className="min-w-[880px] border-collapse">
            <thead>
              <tr className="border-b border-[#eee] text-left text-[0.85rem] text-dot-secondary">
                <th className="px-4 py-3">이메일</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">전화</th>
                <th className="px-4 py-3">로그인</th>
                <th className="px-4 py-3">역할</th>
                <th className="px-4 py-3">가입일</th>
                <th className="w-24 px-4 py-3 text-center whitespace-nowrap">주소록</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <AdminUserRow
                  key={u.id}
                  user={u}
                  currentUserId={currentUserId}
                  roleMutationPending={
                    roleMutation.isPending &&
                    roleMutation.variables?.userId === u.id
                  }
                  onRoleChange={onRowRoleChange}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.85rem] text-dot-secondary">
          총 {total}명 · {page} / {totalPages} 페이지
          {isFetching && !isLoading ? ' · 새로고침 중…' : null}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-[#ddd] bg-white px-4 py-2 text-sm font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7] disabled:opacity-40"
          >
            이전
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-[#ddd] bg-white px-4 py-2 text-sm font-medium text-dot-primary transition-colors hover:bg-[#f7f7f7] disabled:opacity-40"
          >
            다음
          </button>
        </div>
      </div>
    </section>
  )
}

const AdminUserRow = ({
  user,
  currentUserId,
  roleMutationPending,
  onRoleChange,
}: {
  user: AdminUserListItem
  currentUserId: string
  roleMutationPending: boolean
  onRoleChange: (user: AdminUserListItem, next: UserRole) => void
}) => {
  const [expanded, setExpanded] = useState(false)
  const {
    data: addresses,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['admin', 'user-addresses', user.id],
    queryFn: () => fetchAdminUserAddresses(user.id),
    enabled: expanded,
  })

  return (
    <>
      <tr className="border-b border-[#f3f3f3]">
        <td className="px-4 py-3 font-medium text-dot-primary">{user.email}</td>
        <td className="px-4 py-3 text-dot-secondary">{user.fullName ?? '—'}</td>
        <td className="px-4 py-3 text-dot-secondary">{user.phone ?? '—'}</td>
        <td className="px-4 py-3 text-[0.85rem] text-dot-secondary">
          {providerLabel(user.provider)}
        </td>
        <td className="px-4 py-3">
          <select
            value={user.role}
            disabled={roleMutationPending}
            onChange={(e) => onRoleChange(user, e.target.value as UserRole)}
            className={cn(
              'rounded border border-[#ddd] bg-white px-2 py-1.5 text-[0.82rem] focus:border-dot-primary focus:outline-none',
              user.role === 'admin' && 'font-medium text-dot-primary'
            )}
          >
            <option
              value="member"
              disabled={user.id === currentUserId && user.role === 'admin'}
            >
              member
            </option>
            <option value="admin">admin</option>
          </select>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-[0.85rem] text-dot-secondary">
          {formatJoined(user.createdAt)}
        </td>
        <td className="w-24 px-4 py-3 text-center whitespace-nowrap">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? '주소록 접기' : '주소록 펼치기'}
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#ddd] text-[0.82rem] text-dot-primary transition-colors hover:bg-[#f7f7f7]"
          >
            {expanded ? '▾' : '▸'}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-[#f3f3f3] bg-[#fcfcfc]">
          <td colSpan={7} className="px-6 py-4">
            <div className="space-y-2">
              <p className="text-[0.8rem] font-medium text-dot-primary">주소록</p>
              {isLoading ? (
                <p className="text-[0.82rem] text-dot-secondary">불러오는 중…</p>
              ) : isError ? (
                <p className="text-[0.82rem] text-red-600">
                  주소록 조회에 실패했습니다.
                </p>
              ) : !addresses?.length ? (
                <p className="text-[0.82rem] text-dot-secondary">
                  등록된 주소가 없습니다.
                </p>
              ) : (
                <ul className="space-y-2">
                  {addresses.map((address) => (
                    <li
                      key={address.id}
                      className="rounded border border-[#ececec] bg-white px-3 py-2"
                    >
                      <p className="text-[0.82rem] font-medium text-dot-primary">
                        {address.label}
                        {address.isDefault ? ' · 기본 배송지' : ''}
                      </p>
                      <p className="text-[0.82rem] text-dot-secondary">
                        수령인: {address.recipientName ?? '—'} · 연락처:{' '}
                        {address.phone ?? '—'}
                      </p>
                      <p className="text-[0.82rem] text-dot-secondary">
                        {formatAddressLine(address)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}
