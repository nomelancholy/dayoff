import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export const RegisterPage = () => {
  const navigate = useNavigate()

  // 소셜 로그인만 제공: 회원가입 페이지는 /login으로 안내/리다이렉트
  useEffect(() => {
    navigate('/login', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#F9F8F6] px-4 py-32 md:px-16">
      <div className="mx-auto max-w-md text-center">
        소셜 로그인만 제공됩니다.{' '}
        <Link to="/login" className="text-dot-primary underline underline-offset-4 hover:opacity-70 transition-opacity">
          로그인으로 이동
        </Link>
      </div>
    </div>
  )
}
