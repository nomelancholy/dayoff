import { Link } from 'react-router-dom'
import { socialLoginUrls } from '../api/auth'

const legalLinkClass =
  'text-dot-primary underline underline-offset-4 transition-opacity hover:opacity-70'

export const LoginForm = () => {
  return (
    <div className="w-full">
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
        <p className="mt-8 text-center text-[11px] leading-relaxed text-[#666] md:text-xs">
          계정 생성 및 로그인함으로써{' '}
          <Link to="/terms" className={legalLinkClass}>
            이용약관
          </Link>
          {' '}및{' '}
          <Link to="/privacy" className={legalLinkClass}>
            개인정보 처리방침
          </Link>
          에 동의합니다.
        </p>
      </div>
    </div>
  )
}
