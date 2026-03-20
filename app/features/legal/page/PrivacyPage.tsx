const sectionClass = 'mt-10 scroll-mt-24'
const h2Class =
  'mb-4 font-serif text-xl tracking-[0.06em] text-dot-primary md:text-2xl'
const pClass = 'text-[0.95rem] leading-relaxed text-dot-secondary md:text-base'
const listClass = 'mt-3 list-disc space-y-2 pl-5 text-[0.95rem] leading-relaxed text-dot-secondary md:text-base'

export const PrivacyPage = () => {
  return (
    <article className="mx-auto max-w-3xl px-6 py-24 md:px-8 md:py-32 lg:px-16">
      <h1 className="font-serif text-3xl tracking-[0.08em] text-dot-primary md:text-4xl">
        개인정보 처리방침
      </h1>
      <p className={`${pClass} mt-6`}>
        DOT(이하 &quot;회사&quot;)는 「개인정보 보호법」 등 관련 법령에 따라
        이용자의 개인정보를 보호하고, 이와 관련한 고충을 신속하게 처리하기 위하여
        다음과 같이 개인정보 처리방침을 수립·공개합니다. 본 방침은 온라인 쇼핑몰
        회원 가입·관리, 상품 주문 및 배송 등 서비스에 적용됩니다.
      </p>
      <p className={`${pClass} mt-4`}>
        도예 클래스 예약 등은 별도 외부 링크·채널로 안내될 수 있으며, 해당
        채널에서 수집하는 정보는 각 채널의 정책을 따릅니다.
      </p>

      <section className={sectionClass}>
        <h2 className={h2Class}>1. 수집하는 개인정보 항목</h2>
        <p className={pClass}>회사는 서비스 제공을 위해 다음과 같은 정보를 수집할 수 있습니다.</p>
        <ul className={listClass}>
          <li>
            <strong className="text-dot-primary">회원 가입 및 계정 관리</strong>
            : 이메일 주소, 비밀번호(암호화 저장), 이름(또는 닉네임), 휴대전화번호,
            로그인에 사용하는 소셜 계정 식별자(소셜 로그인 시 해당 제공 범위에 한함)
          </li>
          <li>
            <strong className="text-dot-primary">상품 주문·결제·배송</strong>:
            주문자·수령인 이름, 배송지 주소(우편번호, 기본·상세 주소), 연락처(휴대전화
            등), 결제 과정에서 결제대행사가 요구하는 정보(회사는 직접 카드번호 전체를
            저장하지 않는 것이 원칙입니다)
          </li>
          <li>
            <strong className="text-dot-primary">서비스 이용 과정에서 자동 수집</strong>
            : IP 주소, 쿠키, 접속 로그, 기기정보 등(보안·통계·서비스 개선 목적)
          </li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>2. 개인정보의 수집·이용 목적</h2>
        <p className={pClass}>회사는 수집한 개인정보를 다음의 목적 범위에서만 이용합니다.</p>
        <ul className={listClass}>
          <li>회원 가입 의사 확인, 본인 식별·인증, 회원자격 유지·관리, 부정이용 방지</li>
          <li>재화 또는 서비스 제공, 주문·결제·배송, 계약서·청구서 발송, 고객 문의 응대</li>
          <li>배송업체 등에 배송 위탁 시, 배송에 필요한 최소 정보(이름, 주소, 연락처) 제공</li>
          <li>서비스 품질 개선, 통계·분석(식별 불가 형태로 가공하는 경우 포함 가능)</li>
          <li>관련 법령에 따른 보존·신고 의무 이행</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>3. 개인정보의 보유 및 이용 기간</h2>
        <p className={pClass}>
          ① 회사는 원칙적으로 개인정보 수집·이용 목적이 달성된 후에는 해당 정보를
          지체 없이 파기합니다. 다만 관계 법령에 따라 일정 기간 보관이 필요한
          경우에는 법령에서 정한 기간 동안 보관합니다.
        </p>
        <p className={`${pClass} mt-3`}>
          ② 예시: 전자상거래 등에서의 소비자보호에 관한 법률에 따른 계약·청약철회
          기록, 대금결제·재화공급 기록, 소비자 불만·분쟁처리 기록 등은 해당 법령이
          정한 기간 동안 보관할 수 있습니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>4. 개인정보의 제3자 제공 및 처리 위탁</h2>
        <p className={pClass}>
          ① 회사는 이용자의 개인정보를 제1조에서 고지한 범위를 넘어 제3자에게
          제공하지 않습니다. 다만 이용자의 동의가 있거나 법령에 의해 요구되는 경우는
          예외로 합니다.
        </p>
        <p className={`${pClass} mt-3`}>
          ② 상품 배송을 위해 택배·퀵 등 배송사에 수령인 이름, 주소, 연락처를
          전달하는 것은 배송 목적에 필요한 최소한의 위탁·제공에 해당합니다.
        </p>
        <p className={`${pClass} mt-3`}>
          ③ 결제 서비스는 PG사 등 결제대행 업체를 통해 이루어질 수 있으며, 해당
          업체는 결제 처리에 필요한 범위에서 정보를 처리합니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>5. 이용자의 권리·의무 및 행사 방법</h2>
        <p className={pClass}>
          이용자는 언제든지 등록된 자신의 개인정보를 조회·수정·삭제(탈퇴)할 수
          있으며, 회사에 서면·전자우편 등으로 열람·정정·삭제·처리정지를 요청할 수
          있습니다. 회사는 지체 없이 필요한 조치를 하겠습니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>6. 개인정보의 파기</h2>
        <p className={pClass}>
          보유기간이 경과하거나 처리목적이 달성된 개인정보는 복구·재생되지 않는
          방법으로 파기합니다. 전자파일은 복구 불가능한 방식으로 삭제하고, 출력물은
          분쇄 또는 소각 등으로 파기합니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>7. 개인정보의 안전성 확보 조치</h2>
        <p className={pClass}>
          회사는 개인정보의 분실·도난·유출·변조·훼손을 방지하기 위해 접근권한 관리,
          비밀번호 암호화, 전송 구간 보안(SSL 등), 백신·방화벽 운영 등 관련 법령이
          요구하는 수준의 기술적·관리적 조치를 취합니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>8. 쿠키의 운영</h2>
        <p className={pClass}>
          회사는 로그인 유지·장바구니·서비스 이용 통계 등을 위해 쿠키를 사용할 수
          있습니다. 브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 일부 기능 이용이
          제한될 수 있습니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>9. 개인정보 보호책임자</h2>
        <p className={pClass}>
          개인정보 처리에 관한 문의·불만·피해 구제는 몰의 CONTACT 페이지에 안내된
          연락처(이메일 등)로 요청해 주시기 바랍니다. 회사는 신속히 답변 및 조치를
          하겠습니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>10. 고지의 의무</h2>
        <p className={pClass}>
          본 처리방침의 내용 추가·삭제·수정이 있는 경우 시행일 7일 전부터 몰
          공지사항 또는 별도 창을 통해 공지합니다. 중요한 변경의 경우 그 기간을
          달리 정할 수 있습니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>부칙</h2>
        <p className={pClass}>
          본 개인정보 처리방침은 2019년부터 적용됩니다. 시행일은 몰 하단 공지에
          따릅니다.
        </p>
      </section>
    </article>
  )
}
