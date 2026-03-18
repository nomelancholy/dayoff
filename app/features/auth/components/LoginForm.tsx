import { socialLoginUrls } from '../api/auth'

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
      </div>
    </div>
  )
}
