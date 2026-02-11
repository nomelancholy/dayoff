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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-[#666]">
            이메일
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
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-[#666]">
            비밀번호
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
            autoComplete="current-password"
          />
        </label>
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className={cn(
            'mt-2 rounded border border-dot-primary bg-dot-primary px-4 py-3 text-sm font-medium uppercase tracking-widest text-white',
            'transition-opacity hover:opacity-90 disabled:opacity-50'
          )}
        >
          {loginMutation.isPending ? '로그인 중…' : '로그인'}
        </button>
      </form>

      <div className="mt-8 border-t border-[#ddd] pt-8">
        <p className="mb-4 text-center text-xs uppercase tracking-widest text-[#666]">
          소셜 로그인
        </p>
        <div className="flex flex-col gap-3">
          <a
            href={socialLoginUrls.google}
            className="flex items-center justify-center gap-2 rounded border border-[#ddd] bg-white px-4 py-3 text-sm text-dot-primary transition-colors hover:bg-[#f5f5f5]"
          >
            Google로 로그인
          </a>
          <a
            href={socialLoginUrls.kakao}
            className="flex items-center justify-center gap-2 rounded border border-[#FEE500] bg-[#FEE500] px-4 py-3 text-sm text-[#191919] transition-opacity hover:opacity-90"
          >
            카카오로 로그인
          </a>
          <a
            href={socialLoginUrls.naver}
            className="flex items-center justify-center gap-2 rounded border border-[#03C75A] bg-[#03C75A] px-4 py-3 text-sm text-white transition-opacity hover:opacity-90"
          >
            네이버로 로그인
          </a>
        </div>
      </div>
    </div>
  )
}
