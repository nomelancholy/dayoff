import { Link } from 'react-router-dom'
import { socialLoginUrls } from '../api/auth'

const legalLinkClass =
  'text-dot-primary underline underline-offset-4 transition-opacity hover:opacity-70'

const socialButtonClass =
  'relative flex min-h-13 w-full items-center justify-center rounded-md border px-12 py-3.5 text-sm font-medium leading-5 transition-[box-shadow,transform] duration-200 hover:shadow-sm active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-dot-primary motion-reduce:transition-none motion-reduce:transform-none'

export const LoginForm = () => {
  return (
    <div className="w-full">
      <div>
        <div className="mb-6 flex items-center gap-4">
          <span className="h-px flex-1 bg-dot-accent/25" aria-hidden="true" />
          <p className="text-xs tracking-[0.04em] text-dot-secondary">
            간편 로그인
          </p>
          <span className="h-px flex-1 bg-dot-accent/25" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-3">
          <a
            href={socialLoginUrls.google}
            className={`${socialButtonClass} border-[#747775] bg-white text-[#1f1f1f]!`}
          >
            <img
              src="/assets/auth/google-g.png"
              alt=""
              width={20}
              height={20}
              className="absolute left-5 size-5 object-contain"
            />
            Google로 로그인
          </a>
          <a
            href={socialLoginUrls.kakao}
            className={`${socialButtonClass} border-transparent bg-[#FEE500] text-[#191919]!`}
          >
            <svg
              className="absolute left-5 size-5"
              viewBox="0 0 24 24"
              fill="#000000"
              aria-hidden="true"
            >
              <path d="M12 3C6.477 3 2 6.477 2 10.765c0 2.664 1.728 5.014 4.36 6.412l-1.108 4.064a.36.36 0 0 0 .55.393l4.858-3.226c.44.047.888.071 1.34.071 5.523 0 10-3.477 10-7.764S17.523 3 12 3Z" />
            </svg>
            카카오 로그인
          </a>
          <a
            href={socialLoginUrls.naver}
            className={`${socialButtonClass} border-transparent bg-[#03A94D] text-white!`}
          >
            <svg
              className="absolute left-5 size-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
            </svg>
            네이버로 로그인
          </a>
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-dot-secondary">
          처음 방문하셨다면 로그인과 함께 계정이 만들어집니다.
        </p>
        <p className="mt-8 border-t border-dot-accent/20 pt-6 text-center text-[11px] leading-6 text-dot-secondary md:text-xs">
          계정 생성 및 로그인함으로써{' '}
          <Link to="/terms" className={legalLinkClass}>
            이용약관
          </Link>{' '}
          및{' '}
          <Link to="/privacy" className={legalLinkClass}>
            개인정보 처리방침
          </Link>
          에 동의합니다.
        </p>
      </div>
    </div>
  )
}
