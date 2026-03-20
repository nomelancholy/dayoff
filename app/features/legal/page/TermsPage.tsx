const sectionClass = 'mt-10 scroll-mt-24'
const h2Class =
  'mb-4 font-serif text-xl tracking-[0.06em] text-dot-primary md:text-2xl'
const pClass = 'text-[0.95rem] leading-relaxed text-dot-secondary md:text-base'
const listClass = 'mt-3 list-disc space-y-2 pl-5 text-[0.95rem] leading-relaxed text-dot-secondary md:text-base'

export const TermsPage = () => {
  return (
    <article className="mx-auto max-w-3xl px-6 py-24 md:px-8 md:py-32 lg:px-16">
      <h1 className="font-serif text-3xl tracking-[0.08em] text-dot-primary md:text-4xl">
        이용약관
      </h1>
      <p className={`${pClass} mt-6`}>
        본 약관은 DOT(이하 &quot;회사&quot;)가 운영하는 온라인 쇼핑몰 웹사이트(이하
        &quot;몰&quot;)에서 제공하는 전자상거래 관련 서비스의 이용과 관련하여 회사와
        이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
      </p>

      <section className={sectionClass}>
        <h2 className={h2Class}>제1조 (목적)</h2>
        <p className={pClass}>
          이 약관은 회사가 운영하는 몰에서 판매하는 도자기 등 상품(이하
          &quot;상품&quot;)의 구매, 회원 서비스 이용 등에 관한 제반 사항을 정합니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>제2조 (정의)</h2>
        <ul className={listClass}>
          <li>
            &quot;몰&quot;이란 회사가 재화 또는 용역을 이용자에게 제공하기 위하여
            컴퓨터 등 정보통신설비를 이용하여 상품 등을 거래할 수 있도록 설정한
            가상의 영업장을 말합니다.
          </li>
          <li>
            &quot;이용자&quot;란 몰에 접속하여 이 약관에 따라 몰이 제공하는 서비스를
            받는 회원 및 비회원을 말합니다.
          </li>
          <li>
            &quot;회원&quot;이란 몰에 회원등록을 한 자로서, 계속적으로 몰이 제공하는
            서비스를 이용할 수 있는 자를 말합니다.
          </li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>제3조 (약관의 효력 및 변경)</h2>
        <p className={pClass}>
          ① 본 약관은 몰에 게시하거나 기타의 방법으로 이용자에게 공지함으로써
          효력이 발생합니다.
        </p>
        <p className={`${pClass} mt-3`}>
          ② 회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며,
          개정 시 적용일자 및 개정사유를 명시하여 몰에 사전 공지합니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>제4조 (회원가입 및 관리)</h2>
        <p className={pClass}>
          ① 이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에
          동의한다는 의사표시를 함으로써 회원가입을 신청합니다.
        </p>
        <p className={`${pClass} mt-3`}>
          ② 회사는 다음 각 호에 해당하는 경우 회원가입을 거절하거나 사후에
          이용계약을 해지할 수 있습니다.
        </p>
        <ul className={listClass}>
          <li>가입신청자가 이전에 회원자격을 상실한 사실이 있는 경우</li>
          <li>허위의 정보를 기재하거나 회사가 요구하는 내용을 기재하지 않은 경우</li>
          <li>기타 회원으로 등록하는 것이 회사의 기술상 또는 업무상 현저히 지장이 있다고 판단되는 경우</li>
        </ul>
        <p className={`${pClass} mt-3`}>
          ③ 회원은 등록사항에 변경이 있는 경우 지체 없이 몰에서 수정하거나 회사에
          알려야 하며, 미변경으로 인한 불이익은 회원 본인에게 있습니다.
        </p>
        <p className={`${pClass} mt-3`}>
          ④ 회원은 언제든지 몰의 회원탈퇴 기능 등을 통해 이용계약 해지를 요청할 수
          있으며, 회사는 관련 법령이 정하는 바에 따라 즉시 처리합니다. 다만
          진행 중인 주문·분쟁이 있는 경우 일부 처리가 지연될 수 있습니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>제5조 (서비스의 제공)</h2>
        <p className={pClass}>
          ① 회사는 몰을 통해 상품에 대한 정보 제공, 구매계약의 체결, 배송 등
          전자상거래와 관련된 서비스를 제공합니다.
        </p>
        <p className={`${pClass} mt-3`}>
          ② 도예 클래스 등 일부 프로그램은 회사 정책에 따라 별도의 외부 페이지나
          채널로 안내될 수 있으며, 해당 예약·결제는 본 몰의 주문·결제 절차와
          별도로 운영될 수 있습니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>제6조 (주문 및 결제)</h2>
        <p className={pClass}>
          ① 이용자는 몰에 안내된 절차에 따라 상품을 주문할 수 있습니다. 회사는
          주문에 대해 승낙의 의사표시를 하고, 승낙 시 구매계약이 성립합니다.
        </p>
        <p className={`${pClass} mt-3`}>
          ② 결제 수단·시점은 주문 화면 및 결제 대행사 정책에 따릅니다. 회사는
          안전한 결제를 위해 노력하며, 결제 과정에서 발생하는 기술적 문제에 대해
          관련 법령이 정하는 범위 내에서 책임을 집니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>제7조 (배송, 청약철회 및 환불)</h2>
        <p className={pClass}>
          ① 회사는 이용자가 주문 시 입력한 수령인 정보(이름, 주소, 연락처 등)를
          바탕으로 상품을 발송합니다. 정보 오기재로 인한 배송 오류에 대해서는
          이용자의 책임이 원칙입니다.
        </p>
        <p className={`${pClass} mt-3`}>
          ② 전자상거래 등에서의 소비자보호에 관한 법률 등 관련 법령이 정하는
          청약철회·환불 규정을 따릅니다. 수작업 제품·주문 제작 등 법령상 철회가
          제한될 수 있는 경우 몰에 별도 고지합니다.
        </p>
        <p className={`${pClass} mt-3`}>
          ③ 파손·불량 등 회사 귀책 사유가 있는 경우, 회사는 수령 후 합리적인
          기간 내 고객센터를 통해 접수받아 교환·환불 등 필요한 조치를 취합니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>제8조 (이용자의 의무)</h2>
        <p className={pClass}>이용자는 다음 행위를 하여서는 안 됩니다.</p>
        <ul className={listClass}>
          <li>허위 정보의 등록 또는 타인의 정보 도용</li>
          <li>몰에 게시된 정보의 무단 변경, 시스템 해킹, 매크로 등 부정한 방법으로 서비스 이용</li>
          <li>회사 또는 제3자의 저작권 등 지적재산권 침해</li>
          <li>기타 관련 법령 및 이 약관이 금지하는 행위</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>제9조 (면책)</h2>
        <p className={pClass}>
          ① 천재지변, 통신 장애, 결제 시스템 장애 등 회사의 합리적 통제 범위를
          벗어난 사유로 서비스를 제공할 수 없는 경우 회사는 책임이 면제될 수
          있습니다.
        </p>
        <p className={`${pClass} mt-3`}>
          ② 몰에 게시된 상품 이미지 및 설명은 실제 제품과 색감·질감 등에서 차이가
          있을 수 있으며, 수작업 특성상 미세한 차이는 불량에 해당하지 않을 수
          있습니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>제10조 (준거법 및 분쟁 해결)</h2>
        <p className={pClass}>
          본 약관의 해석 및 회사와 이용자 간 분쟁에 대하여는 대한민국 법을
          준거법으로 하며, 소송이 제기되는 경우 관할 법원은 민사소송법 등 관련
          법령에 따릅니다.
        </p>
      </section>

      <section className={sectionClass}>
        <h2 className={h2Class}>부칙</h2>
        <p className={pClass}>
          본 약관은 2019년부터 적용됩니다. 공고일자 및 시행일자는 몰 하단 또는
          별도 공지에 따릅니다.
        </p>
      </section>
    </article>
  )
}
