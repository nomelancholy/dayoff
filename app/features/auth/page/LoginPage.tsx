import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { setStoredToken } from '../api/auth'
import { LoginForm } from '../components/LoginForm'

export const LoginPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // 소셜 로그인 콜백: URL에 token이 있으면 저장 후 계정으로 이동
  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      setStoredToken(token)
      navigate('/account', { replace: true })
    }
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-[#F9F8F6] px-4 py-32 md:px-16">
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-4xl tracking-[0.12em] text-dot-primary">
          로그인
        </h1>
        <p className="mt-2 text-sm text-[#666]">
          계정이 없으시면{' '}
          <Link to="/register" className="underline hover:opacity-80">
            회원가입
          </Link>
          을 해 주세요.
        </p>

        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
