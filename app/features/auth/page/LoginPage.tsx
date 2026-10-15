import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { setStoredToken } from '../api/auth'
import { LoginForm } from '../components/LoginForm'

export const LoginPage = () => {
  const [searchParams] = useSearchParams()

  // 소셜 로그인 콜백: token 저장 후 전체 이동(React Query·라우터 타이밍 이슈로 /auth/me 실패 방지)
  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      setStoredToken(token)
      window.location.replace('/account')
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-dot-bg px-6 pb-24 pt-32 md:px-16 md:pt-40">
      <div className="mx-auto max-w-[400px]">
        <h1 className="text-center text-3xl font-medium tracking-[0.04em] text-dot-primary">
          로그인
        </h1>
        <p className="mt-4 text-center text-sm leading-relaxed text-dot-secondary">
          자주 사용하는 계정으로 간편하게 시작하세요.
        </p>

        <div className="mt-10">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
