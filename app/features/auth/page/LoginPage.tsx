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
    <div className="min-h-screen bg-[#F9F8F6] px-4 py-32 md:px-16">
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-4xl tracking-[0.12em] text-dot-primary">
          로그인
        </h1>
        <p className="mt-2 text-sm text-[#666]">
          소셜 로그인은 버튼을 통해 자동으로 계정이 생성됩니다.
        </p>

        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
