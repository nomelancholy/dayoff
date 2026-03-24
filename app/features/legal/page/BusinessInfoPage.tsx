const infoRowClass =
  'grid grid-cols-[120px_1fr] gap-4 border-b border-[#eee] py-4 text-[0.95rem] leading-relaxed md:grid-cols-[150px_1fr] md:text-base'

export const BusinessInfoPage = () => {
  return (
    <article className="mx-auto max-w-3xl px-6 py-24 md:px-8 md:py-32 lg:px-16">
      <h1 className="font-serif text-3xl tracking-[0.08em] text-dot-primary md:text-4xl">
        사업자 정보 확인
      </h1>
      <p className="mt-6 text-[0.95rem] leading-relaxed text-dot-secondary md:text-base">
        전자상거래 등에서의 소비자보호에 관한 법률에 따라 아래 사업자 정보를
        제공합니다.
      </p>

      <section className="mt-10 rounded-sm border border-[#eee] bg-white px-5 py-2 md:px-8">
        <div className={infoRowClass}>
          <span className="text-dot-secondary">상호명</span>
          <span className="text-dot-primary">디오티(DOT)</span>
        </div>
        <div className={infoRowClass}>
          <span className="text-dot-secondary">대표자</span>
          <span className="text-dot-primary">신은지</span>
        </div>
        <div className={infoRowClass}>
          <span className="text-dot-secondary">사업자등록번호</span>
          <span className="text-dot-primary">6530501467</span>
        </div>
        <div className={infoRowClass}>
          <span className="text-dot-secondary">사업장 소재지</span>
          <span className="text-dot-primary">
            서울특별시 중구 마른내로4길 31-3 3층 (우 : 04556)
          </span>
        </div>
        <div className={infoRowClass}>
          <span className="text-dot-secondary">통신판매업번호</span>
          <span className="text-dot-primary">2022-서울중구-1157</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-4 py-4 text-[0.95rem] leading-relaxed md:grid-cols-[150px_1fr] md:text-base">
          <span className="text-dot-secondary">이메일</span>
          <span className="text-dot-primary">eundi2c@naver.com</span>
        </div>
      </section>
    </article>
  )
}
