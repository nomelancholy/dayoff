/**
 * VITE_API_URL 끝의 슬래시 제거.
 * `https://a.com/` + `/auth/kakao` → `//auth/kakao` 로 합쳐져 Nest 404 나는 것을 방지.
 */
export function getViteApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL?.trim() || 'http://localhost:4000'
  return raw.replace(/\/+$/, '')
}
