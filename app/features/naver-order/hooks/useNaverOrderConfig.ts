import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getStoredToken } from '@/features/auth/api/auth'
import { fetchNaverOrderConfig } from '../api/naverOrder'

// 로그인 전환 때 이전 검수 계정의 공개 설정을 재사용하지 않습니다.
// JWT 자체를 Query key나 로그에 보관하지 않도록 메모리 세션 번호만 사용합니다.
let previousToken: string | null | undefined
let session = 0
function snapshot() {
  const token = getStoredToken()
  if (token !== previousToken) {
    previousToken = token
    session += 1
  }
  return session
}
function subscribe(notify: () => void) {
  window.addEventListener('auth-session-changed', notify)
  window.addEventListener('storage', notify)
  return () => {
    window.removeEventListener('auth-session-changed', notify)
    window.removeEventListener('storage', notify)
  }
}
export function useNaverOrderConfig() {
  const identity = useSyncExternalStore(subscribe, snapshot, () => 0)
  const query = useQuery({
    queryKey: ['naver-order', 'config', identity],
    queryFn: fetchNaverOrderConfig,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  return { ...query, data: query.isError ? undefined : query.data }
}
