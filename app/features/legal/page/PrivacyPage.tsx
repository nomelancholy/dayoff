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
        디오티(DOT)(이하 &quot;회사&quot;)가 운영하는 DOT. 서비스는 「개인정보 보호법」 등 관련 법령에 따라
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

      <section className={sectionClass} aria-labelledby="google-data-heading">
        <h2 id="google-data-heading" className={h2Class}>
          1-1. Google 로그인을 통한 개인정보 처리
        </h2>
        <p className={pClass}>
          회사는 Google 계정을 이용한 회원 가입·로그인 시 이용자가 Google 동의
          화면에서 허용한 이메일 및 기본 프로필 정보에 접근합니다. Google 로그인으로
          제공받은 정보에도 본 처리방침이 적용되며, 구체적인 처리 내용은 다음과 같습니다.
        </p>
        <ul className={listClass}>
          <li>
            <strong className="text-dot-primary">수집·저장 항목</strong>: Google
            계정 식별자, 이메일 주소, 이름. 기본 프로필에 포함될 수 있는 프로필
            사진은 회원정보로 저장하거나 서비스에 표시하지 않습니다.
          </li>
          <li>
            <strong className="text-dot-primary">이용 목적</strong>: 회원 식별,
            계정 생성·관리, 로그인 인증, 가입 안내 메일 발송, 가입 축하 쿠폰 및
            회원 혜택 제공, 주문 내역과 회원 계정 연결 등 온라인 스토어 서비스 제공.
            이메일 마케팅에는 별도의 수신 동의를 받은 경우에만 이용합니다.
          </li>
          <li>
            <strong className="text-dot-primary">접근 범위</strong>: 이메일 및
            기본 프로필 권한만 요청하며, Gmail 메일 내용, Google Drive 파일,
            캘린더 및 연락처에는 접근하지 않습니다. Google 계정 비밀번호는
            제공받지 않으며, Google 액세스 토큰과 갱신 토큰은 회원정보로 저장하지 않습니다.
          </li>
          <li>
            <strong className="text-dot-primary">보관 및 보호</strong>: 수집한
            계정 정보는 서비스 데이터베이스에 저장하고, 인증 및 업무상 필요한
            권한에 따라 접근을 제한합니다. 서비스와의 통신에는 HTTPS를 사용합니다.
          </li>
          <li>
            <strong className="text-dot-primary">보유 기간 및 삭제</strong>:
            Google 계정 식별자, 이메일 주소 및 이름은 회원 계정 유지 기간 동안
            보유하며, 회원 탈퇴 처리 시 서비스의 회원정보에서 삭제합니다. 별도로
            처리하는 거래 기록 등의 보관에는 제3조가 적용됩니다.
          </li>
          <li>
            <strong className="text-dot-primary">외부 처리</strong>: 가입·주문·혜택
            안내 메일 발송 시 이메일 주소, 이름 및 해당 안내에 필요한 내용이
            메일 발송 서비스인 Resend에 전달됩니다. 자세한 내용은 제4조에 안내합니다.
          </li>
        </ul>
        <p className={`${pClass} mt-4`}>
          회사는 Google에서 제공받은 정보를 본 방침에 안내한 목적 범위에서만
          처리하며, Google API 서비스 사용자 데이터 정책을 준수합니다.
        </p>
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy?hl=ko"
          target="_blank"
          rel="noopener noreferrer"
          className={`${pClass} mt-3 inline-block underline underline-offset-4`}
        >
          Google API 서비스 사용자 데이터 정책 (새 탭)
        </a>
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
          Google 로그인을 포함한 회원 계정의 식별자, 이메일 주소 및 이름은 회원
          탈퇴 처리 시 회원정보에서 삭제합니다. 법령에 따라 별도로 보관해야 하는
          기록은 해당 의무를 이행하기 위한 목적으로만 처리합니다.
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
        <p className={`${pClass} mt-3`}>
          ④ 회사는 메일 발송 서비스 Resend를 이용해 가입, 주문, 배송, 쿠폰 및
          문의 관련 메일을 발송합니다. 이 과정에서 수신자 이메일 주소와 메일
          본문에 포함된 이름, 주문·혜택·문의 관련 정보가 메일 발송 및 전달을 위해
          처리됩니다. Google 계정으로 가입한 회원의 이메일 주소와 이름도 동일하게
          처리되며, Google 계정 비밀번호나 Google 액세스 토큰·갱신 토큰은 메일
          발송 업체에 전달하지 않습니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>5. 이용자의 권리·의무 및 행사 방법</h2>
        <p className={pClass}>
          이용자는 언제든지 등록된 자신의 개인정보를 조회·수정·삭제(탈퇴)할 수
          있으며, 회사에 서면·전자우편 등으로 열람·정정·삭제·처리정지를 요청할 수
          있습니다. 회사는 지체 없이 필요한 조치를 하겠습니다.
        </p>
        <p className={`${pClass} mt-3`}>
          회원 탈퇴는 로그인 후 내 정보의 프로필에서 &quot;회원 탈퇴&quot;를 선택하여
          요청할 수 있습니다. 발송을 기다리는 주문이 있는 경우 주문 취소 또는
          상품 발송 후 다시 요청해 주세요. 로그인이 어렵거나 별도의 삭제 요청이
          필요한 경우 제9조의 이메일로 연락하시면 본인 확인 후 처리합니다.
        </p>
        <p className={`${pClass} mt-3`}>
          Google 계정의 서드 파티 연결 관리에서도 DOT.에 대한 연결을
          해제할 수 있습니다. Google 연결 해제는 사이트 회원 탈퇴와 별개이므로,
          이미 저장된 회원정보의 삭제를 원하시면 사이트에서 회원 탈퇴하거나
          이메일로 삭제를 요청해 주세요. 회원 탈퇴가 Google 계정 자체를 삭제하지는 않습니다.
        </p>
        <a
          href="https://myaccount.google.com/connections"
          target="_blank"
          rel="noopener noreferrer"
          className={`${pClass} mt-3 inline-block underline underline-offset-4`}
        >
          Google 계정 연결 관리 (새 탭)
        </a>
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
          이메일 로그인 비밀번호의 해시 처리, HTTPS를 통한 전송 구간 보호 등
          기술적·관리적 조치를 취합니다. Google 로그인 계정의 비밀번호는
          회사가 수집하거나 저장하지 않습니다.
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
          개인정보 열람·정정·삭제·처리정지 및 Google 로그인 정보에 관한 문의는
          아래 이메일 또는 CONTACT 페이지로 요청해 주세요. 회사는 요청자 본인
          여부를 확인한 후 신속히 답변 및 조치하겠습니다.
        </p>
        <ul className={listClass}>
          <li>운영자: 디오티(DOT)</li>
          <li>
            개인정보 문의 이메일:{' '}
            <a href="mailto:eundi2c@naver.com" className="underline underline-offset-4">
              eundi2c@naver.com
            </a>
          </li>
        </ul>
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
        <p className={`${pClass} mt-3`}>
          Google 로그인 정보의 수집·이용·보관·삭제 및 메일 발송 처리 안내를
          보완한 개정본 작성일은 2026년 11월 7일입니다. 공고일과 시행일은 별도
          공지에 따릅니다.
        </p>
      </section>
    </article>
  )
}
