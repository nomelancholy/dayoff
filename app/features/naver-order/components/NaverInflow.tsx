import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useNaverOrderConfig } from '../hooks/useNaverOrderConfig'
import { prepareNaverTracking } from '../api/naverOrder'

export function NaverInflow() {
  const location = useLocation()
  const { data } = useNaverOrderConfig()
  useEffect(() => {
    if (!data?.enabled) return
    let cancelled = false
    void prepareNaverTracking(data)
      .then(() => {
        if (!cancelled) window.wcs_do?.()
      })
      .catch(() => {
        /* 구매 버튼에서 로드 오류를 안내합니다. */
      })
    return () => {
      cancelled = true
    }
  }, [data, location.pathname, location.search])
  return null
}
