import apiClient from '@/common/lib/apiClient'

export interface AuthUser {
  id: string
  email: string
  fullName: string | null
  phone: string | null
  role: string
}

export interface AuthResult {
  access_token: string
  user: AuthUser
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  email: string
  password: string
  fullName?: string
  phone?: string
}

const AUTH_TOKEN_KEY = 'auth_token'

/** API 에러 응답에서 사용자에게 보여줄 메시지 추출 (NestJS validation: message가 배열일 수 있음) */
export function getApiErrorMessage(
  err: { response?: { data?: { message?: string | string[] }; status?: number } },
  fallback = '요청을 처리하지 못했습니다.'
): string {
  // 네트워크 오류 등 응답이 없을 때
  if (!err.response) return '네트워크 오류가 발생했습니다. 서버가 실행 중인지 확인해 주세요.'
  const message = err.response?.data?.message
  if (message == null) return fallback
  if (Array.isArray(message)) return message.length ? message.join(' ') : fallback
  return message
}

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

/** 이메일 로그인 */
export async function login(data: LoginInput): Promise<AuthResult> {
  const res = await apiClient.post<AuthResult>('/auth/login', data)
  return res as unknown as AuthResult
}

/** 회원가입 */
export async function register(data: RegisterInput): Promise<AuthResult> {
  const res = await apiClient.post<AuthResult>('/auth/register', data)
  return res as unknown as AuthResult
}

/** 현재 로그인 사용자 정보 (JWT 필요) */
export async function fetchMe(): Promise<AuthUser> {
  const res = await apiClient.get<AuthUser>('/auth/me')
  return res as unknown as AuthUser
}

/** 프로필 수정 (JWT 필요) */
export async function updateProfile(data: {
  fullName?: string
  phone?: string
  currentPassword?: string
  newPassword?: string
}): Promise<AuthUser> {
  const res = await apiClient.patch<AuthUser>('/auth/me', data)
  return res as unknown as AuthUser
}

export interface AddressRow {
  id: string
  userId: string
  label: string
  recipientName: string | null
  phone: string | null
  postalCode: string | null
  addressLine1: string
  addressLine2: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

/** 내 주소 목록 */
export async function fetchAddresses(): Promise<AddressRow[]> {
  return apiClient.get<AddressRow[]>('/auth/addresses')
}

/** 주소 추가 */
export async function createAddress(data: {
  label: string
  recipientName?: string
  phone?: string
  postalCode?: string
  addressLine1: string
  addressLine2?: string
  isDefault?: boolean
}): Promise<AddressRow> {
  return apiClient.post<AddressRow>('/auth/addresses', data)
}

/** 주소 수정 */
export async function updateAddress(
  id: string,
  data: {
    label?: string
    recipientName?: string
    phone?: string
    postalCode?: string
    addressLine1?: string
    addressLine2?: string
    isDefault?: boolean
}
): Promise<AddressRow> {
  return apiClient.patch<AddressRow>(`/auth/addresses/${id}`, data)
}

/** 주소 삭제 */
export async function deleteAddress(id: string): Promise<void> {
  await apiClient.delete(`/auth/addresses/${id}`)
}

/** 소셜 로그인 시작 — 브라우저를 이 URL로 보내면 됨 */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
export const socialLoginUrls = {
  google: `${API_BASE}/auth/google`,
  kakao: `${API_BASE}/auth/kakao`,
  naver: `${API_BASE}/auth/naver`,
} as const
