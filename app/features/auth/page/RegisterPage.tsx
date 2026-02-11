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
        <h1 className="font-serif text-3xl tracking-[0.15em] text-dot-primary">
          Register
        </h1>
        <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#aaa]">
          Already have an account?{' '}
          <Link to="/login" className="text-dot-primary underline underline-offset-4 hover:opacity-70 transition-opacity">
            Login
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-12 flex flex-col gap-6">
          {error && (
            <p className="rounded border border-red-100 bg-red-50/50 px-3 py-2 text-[10px] text-red-600">
              {error}
            </p>
          )}
          <label className="flex flex-col gap-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#aaa]">
              Email <span className="text-red-400">*</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                'border-b border-[#eee] bg-transparent py-2 text-[11px] tracking-wide text-dot-primary',
                'focus:border-dot-primary focus:outline-none transition-colors'
              )}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#aaa]">
              Password <span className="text-red-400">*</span> (8+ chars)
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                'border-b border-[#eee] bg-transparent py-2 text-[11px] tracking-wide text-dot-primary',
                'focus:border-dot-primary focus:outline-none transition-colors'
              )}
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#aaa]">
              Name
            </span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={cn(
                'border-b border-[#eee] bg-transparent py-2 text-[11px] tracking-wide text-dot-primary',
                'focus:border-dot-primary focus:outline-none transition-colors'
              )}
              placeholder="Your Name"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#aaa]">
              Phone
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={cn(
                'border-b border-[#eee] bg-transparent py-2 text-[11px] tracking-wide text-dot-primary',
                'focus:border-dot-primary focus:outline-none transition-colors'
              )}
              placeholder="010-0000-0000"
            />
          </label>
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className={cn(
                'mt-6 bg-[#1A1A1A] py-3.5 text-[10px] font-medium uppercase tracking-[0.3em] text-white!',
                'transition-opacity hover:opacity-90 disabled:opacity-50'
              )}
            >
              {registerMutation.isPending ? 'Registering…' : 'Register'}
            </button>
        </form>
      </div>
    </div>
  )
}
