import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { login, setStoredToken, socialLoginUrls, getApiErrorMessage } from '../api/auth'
import { cn } from '@/common/lib/utils'

interface LoginFormProps {
  onSuccess?: () => void
}

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loginMutation = useMutation({
    mutationFn: () => login({ email, password }),
    onSuccess: (data) => {
      setStoredToken(data.access_token)
      if (onSuccess) {
        onSuccess()
      } else {
        navigate('/account', { replace: true })
      }
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, '로그인에 실패했습니다.'))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.')
      return
    }
    loginMutation.mutate()
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && (
          <p className="rounded border border-red-100 bg-red-50/50 px-3 py-2 text-[10px] text-red-600">
            {error}
          </p>
        )}
        <label className="flex flex-col gap-2">
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#aaa]">
            Email
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
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#aaa]">
            Password
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
            autoComplete="current-password"
          />
        </label>
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className={cn(
              'mt-4 bg-[#1A1A1A] py-3.5 text-[10px] font-medium uppercase tracking-[0.3em] text-white!',
              'transition-opacity hover:opacity-90 disabled:opacity-50'
            )}
          >
            {loginMutation.isPending ? 'Logging in…' : 'Login'}
          </button>
      </form>

      <div className="mt-12 border-t border-[#eee] pt-10">
        <p className="mb-6 text-center text-[9px] uppercase tracking-[0.3em] text-[#bbb]">
          Social Login
        </p>
        <div className="flex flex-col gap-3">
          <a
            href={socialLoginUrls.google}
            className="flex items-center justify-center border border-[#eee] bg-white py-3 text-[10px] uppercase tracking-[0.2em] text-dot-primary transition-colors hover:bg-[#f5f5f5]"
          >
            Google
          </a>
          <a
            href={socialLoginUrls.kakao}
            className="flex items-center justify-center bg-[#FEE500] py-3 text-[10px] uppercase tracking-[0.2em] text-[#191919] transition-opacity hover:opacity-90"
          >
            Kakao
          </a>
          <a
            href={socialLoginUrls.naver}
            className="flex items-center justify-center bg-[#03C75A] py-3 text-[10px] uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-90"
          >
            Naver
          </a>
        </div>
      </div>
    </div>
  )
}
