import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { register, setStoredToken, getApiErrorMessage } from '../api/auth'
import { cn } from '@/common/lib/utils'

export const RegisterPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  const registerMutation = useMutation({
    mutationFn: () =>
      register({
        email,
        password,
        ...(fullName.trim() && { fullName: fullName.trim() }),
        ...(phone.trim() && { phone: phone.trim() }),
      }),
    onSuccess: (data) => {
      setStoredToken(data.access_token)
      navigate('/account', { replace: true })
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, '회원가입에 실패했습니다.'))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.')
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    registerMutation.mutate()
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6] px-4 py-32 md:px-16">
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-4xl tracking-[0.12em] text-dot-primary">
          회원가입
        </h1>
        <p className="mt-2 text-sm text-[#666]">
          이미 계정이 있으시면{' '}
          <Link to="/login" className="underline hover:opacity-80">
            로그인
          </Link>
          해 주세요.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-[#666]">
              이메일 <span className="text-red-500">*</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                'rounded border border-[#ddd] bg-white px-3 py-2.5 text-dot-primary',
                'focus:border-dot-primary focus:outline-none focus:ring-1 focus:ring-dot-primary'
              )}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-[#666]">
              비밀번호 <span className="text-red-500">*</span> (8자 이상)
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                'rounded border border-[#ddd] bg-white px-3 py-2.5 text-dot-primary',
                'focus:border-dot-primary focus:outline-none focus:ring-1 focus:ring-dot-primary'
              )}
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-[#666]">
              이름
            </span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={cn(
                'rounded border border-[#ddd] bg-white px-3 py-2.5 text-dot-primary',
                'focus:border-dot-primary focus:outline-none focus:ring-1 focus:ring-dot-primary'
              )}
              placeholder="홍길동"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-[#666]">
              전화번호
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={cn(
                'rounded border border-[#ddd] bg-white px-3 py-2.5 text-dot-primary',
                'focus:border-dot-primary focus:outline-none focus:ring-1 focus:ring-dot-primary'
              )}
              placeholder="010-0000-0000"
            />
          </label>
          <button
            type="submit"
            disabled={registerMutation.isPending}
            className={cn(
              'mt-2 rounded border border-dot-primary bg-dot-primary px-4 py-3 text-sm font-medium uppercase tracking-widest text-white',
              'transition-opacity hover:opacity-90 disabled:opacity-50'
            )}
          >
            {registerMutation.isPending ? '가입 중…' : '회원가입'}
          </button>
        </form>
      </div>
    </div>
  )
}
