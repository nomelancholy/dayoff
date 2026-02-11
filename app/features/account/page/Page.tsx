import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchMe, getStoredToken, clearStoredToken } from '@/features/auth/api/auth'
import { cn } from '@/common/lib/utils'
import { LoginForm } from '@/features/auth/components/LoginForm'

export const AccountPage = () => {
  const navigate = useNavigate()
  const token = getStoredToken()

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    enabled: !!token,
  })

  const handleLogout = () => {
    clearStoredToken()
    navigate('/login', { replace: true })
    window.location.reload()
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] px-4 py-32 md:px-16">
        <div className="mx-auto max-w-md">
          <h1 className="font-serif text-4xl tracking-[0.12em] text-dot-primary">
            My Account
          </h1>
          <p className="mt-2 text-sm text-[#666]">
            로그인이 필요합니다.
          </p>

          <div className="mt-8">
            <LoginForm onSuccess={() => window.location.reload()} />
          </div>

          <div className="mt-8 border-t border-[#ddd] pt-8 text-center">
            <p className="mb-4 text-xs uppercase tracking-widest text-[#666]">
              아직 회원이 아니신가요?
            </p>
            <Link
              to="/register"
              className={cn(
                'inline-block w-full rounded border border-dot-primary bg-transparent px-4 py-3 text-sm font-medium uppercase tracking-widest text-dot-primary',
                'transition-colors hover:bg-dot-primary hover:text-white'
              )}
            >
              회원가입하기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] px-4 py-32 md:px-16">
        <div className="mx-auto max-w-md">
          <p className="text-[#666]">로딩 중…</p>
        </div>
      </div>
    )
  }

  if (isError || !user) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] px-4 py-32 md:px-16">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-serif text-4xl tracking-[0.12em] text-dot-primary">
            My Account
          </h1>
          <p className="mt-4 text-[#666]">
            세션이 만료되었을 수 있습니다.
          </p>
          <button
            onClick={() => {
              clearStoredToken()
              window.location.reload()
            }}
            className="mt-6 underline hover:opacity-80"
          >
            다시 로그인하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6] px-4 py-32 md:px-16">
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-4xl tracking-[0.12em] text-dot-primary">
          My Account
        </h1>

        <div className="mt-8 rounded border border-[#ddd] bg-white p-6">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-widest text-[#666]">
                이메일
              </dt>
              <dd className="mt-1 text-dot-primary">{user.email}</dd>
            </div>
            {user.fullName && (
              <div>
                <dt className="text-xs uppercase tracking-widest text-[#666]">
                  이름
                </dt>
                <dd className="mt-1 text-dot-primary">{user.fullName}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase tracking-widest text-[#666]">
                권한
              </dt>
              <dd className="mt-1 text-dot-primary">
                {user.role === 'admin' ? '관리자' : '회원'}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              'mt-6 rounded border border-[#999] bg-transparent px-4 py-2 text-sm uppercase tracking-widest text-[#666]',
              'transition-colors hover:border-dot-primary hover:text-dot-primary'
            )}
          >
            로그아웃
          </button>
        </div>

        <p className="mt-6 text-sm text-[#666]">
          주문 내역, 주소록 등은 추후 구현 예정입니다.
        </p>
      </div>
    </div>
  )
}
