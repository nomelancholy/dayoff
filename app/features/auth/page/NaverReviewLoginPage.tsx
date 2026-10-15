import { useState, type FormEvent } from 'react'
import {
  getApiErrorMessage,
  setStoredToken,
  type AuthResult,
} from '../api/auth'
import { getViteApiBaseUrl } from '@/common/lib/viteApiBaseUrl'
import axios from 'axios'

export function NaverReviewLoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    try {
      // 로그인 실패는 이 화면에서 안내하고 일반 소셜 로그인으로 이동시키지 않습니다.
      const { data } = await axios.post<AuthResult>(
        `${getViteApiBaseUrl()}/auth/npay-review/login`,
        { identifier, password }
      )
      setStoredToken(data.access_token)
      window.location.replace('/shop')
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        )
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6] px-4 py-32 md:px-16">
      <meta name="robots" content="noindex, nofollow" />
      <title>네이버페이 검수 로그인 | Day Off</title>
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-3xl text-dot-primary">
          네이버페이 검수 로그인
        </h1>
        <p className="mt-4 text-sm text-[#666]">
          전달받은 검수 계정으로 로그인해 주세요. 로그인 후 전체 상품과
          장바구니를 확인할 수 있습니다.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="review-identifier" className="block text-sm">
              아이디 또는 이메일
            </label>
            <input
              id="review-identifier"
              autoComplete="username"
              required
              maxLength={254}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-3"
            />
          </div>
          <div>
            <label htmlFor="review-password" className="block text-sm">
              비밀번호
            </label>
            <input
              id="review-password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-3"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-dot-primary px-4 py-3 text-white disabled:opacity-50"
          >
            {pending ? '로그인 중…' : '검수 시작'}
          </button>
        </form>
      </div>
    </div>
  )
}
