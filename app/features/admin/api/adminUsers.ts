import apiClient from '@/common/lib/apiClient'

export type UserRole = 'member' | 'admin'

export interface AdminUserListItem {
  id: string
  email: string
  fullName: string | null
  phone: string | null
  provider: string
  role: UserRole
  createdAt: string
}

export interface AdminUsersListResponse {
  items: AdminUserListItem[]
  total: number
  page: number
  pageSize: number
}

export interface FetchAdminUsersParams {
  q?: string
  role?: UserRole
  page?: number
  pageSize?: number
}

export async function fetchAdminUsers(
  params: FetchAdminUsersParams = {}
): Promise<AdminUsersListResponse> {
  const search = new URLSearchParams()
  if (params.q?.trim()) search.set('q', params.q.trim())
  if (params.role === 'member' || params.role === 'admin') {
    search.set('role', params.role)
  }
  if (params.page != null && params.page > 1) {
    search.set('page', String(params.page))
  }
  if (params.pageSize != null) {
    search.set('pageSize', String(params.pageSize))
  }
  const qs = search.toString()
  const url = qs ? `/auth/admin/users?${qs}` : '/auth/admin/users'
  return apiClient.get<AdminUsersListResponse>(url)
}

export async function updateAdminUserRole(
  userId: string,
  role: UserRole
): Promise<{ id: string; email: string; fullName: string | null; role: string }> {
  return apiClient.patch(`/auth/admin/users/${userId}/role`, { role })
}
