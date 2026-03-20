import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/features/auth/api/auth'
import {
  fetchAdminUsers,
  updateAdminUserRole,
  type UserRole,
  type AdminUserListItem,
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
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-b border-[#f3f3f3]">
                  <td className="px-4 py-3 font-medium text-dot-primary">
                    {u.email}
                  </td>
                  <td className="px-4 py-3 text-dot-secondary">
                    {u.fullName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-dot-secondary">
                    {u.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-[0.85rem] text-dot-secondary">
                    {providerLabel(u.provider)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={
                        roleMutation.isPending &&
                        roleMutation.variables?.userId === u.id
                      }
                      onChange={(e) =>
                        onRowRoleChange(u, e.target.value as UserRole)
                      }
                      className={cn(
                        'rounded border border-[#ddd] bg-white px-2 py-1.5 text-[0.82rem] focus:border-dot-primary focus:outline-none',
                        u.role === 'admin' && 'font-medium text-dot-primary',
                      )}
                    >
                      <option
                        value="member"
                        disabled={
                          u.id === currentUserId && u.role === 'admin'
                        }
                      >
                        member
                      </option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-[0.85rem] text-dot-secondary whitespace-nowrap">
                    {formatJoined(u.createdAt)}
                  </td>
                </tr>
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
