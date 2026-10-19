# 실운영 전환 상태

최종 승인 후 네이버페이 주문형을 전체 공개합니다. 아래 검수 관련 절차는 과거 기록입니다.

- 운영 SDK: `https://npay-order.pstatic.net/assets/button/latest/npay.button.js`
- 운영 주문등록: `https://api.pay.naver.com/o/customer/api/order/v20/register`
- 비회원 포함 전체 상품 상세와 장바구니에서 구매 가능합니다. 비회원 장바구니는 현재 브라우저에 상품·옵션 ID와 수량만 저장하며, 가격과 구매 가능 여부는 서버에서 확인합니다.
- `/npay-review`는 `/shop`으로 이동합니다. 검수 로그인 비활성화와 함께 기존 검수 JWT도 거부합니다.
- 배송비: 기본 4,000원 / 10만원 이상 기본배송비 무료 / 제주 +3,000원 / 제주 외 도서산간 +5,000원.
- 주문관리 API 조회·재고 동기화는 구현되어 있으며 현재 Sandbox 검증 단계입니다. 운영 API 키 발급 및 재고 반영 활성화 전에는 자동 반영되지 않습니다. 네이버페이센터에서 주문·취소·배송을 처리하고 사이트 관리자에서 재고를 수동 조정합니다.

운영 서버 설정 전환은 코드 배포 완료 후 `Activate Npay production` 수동 워크플로를 실행합니다.
`deploy/activate-npay-production.sh`가 기존 `.env.deploy` 인증키를 재사용하고 비밀값을 출력하지 않습니다.
설정 파일을 권한 600으로 백업하고 기동/설정 확인 실패 시 이전 환경으로 복구합니다.
설정값은 `NAVER_ORDER_MODE=production`, `NAVER_ORDER_AUDIENCE=public`,
`NAVER_ORDER_ENABLED=true`, `NAVER_ORDER_PRODUCTION_READY=true`, `NAVER_REVIEW_LOGIN_ENABLED=false`입니다.
`NAVER_REVIEW_USER_ID`는 기존 검수 세션을 계속 차단하기 위해 보존합니다.

---

# 네이버페이 주문형 2.1 운영 준비

신규 구매는 **주문형**으로 전환했습니다. 상품 상세의 Npay 버튼은 사이트 로그인 없이
네이버 주문서를 엽니다. 회원·비회원 장바구니에서 선택한 상품들을 네이버 주문서로 보냅니다. 빈 장바구니에는 버튼을 표시하지 않으며, 선택 상품이 없거나 구매할 수 없는 상품이 선택되어 있으면 비활성화합니다.
자체 쿠폰은 적용하지 않으며, 클래스 예약은 기존 별도 흐름을 유지합니다.

## 신청할 유형과 받을 정보

- 자체 구축 독립몰 / 주문형 / 주문등록 2.1
- 가맹점 ID, 가맹점 인증키(CERTI_KEY), 버튼 인증키(BUTTON_KEY), 네이버 공통 인증키(Account_Id)
- 가입 승인 안내, 검수 절차 및 테스트 계정 안내
- 네이버페이센터에 반품 주소, 연락처, 반품·교환 배송비 설정

결제형 Client ID/Secret/Chain ID와 네이버 로그인 키는 재사용할 수 없습니다.
인증키는 서버 환경 파일에만 저장하고 Git이나 채팅에 올리지 않습니다.
버튼키와 공통 유입키만 공개 설정 API로 전달합니다.

## 서버 설정

로컬은 `server/.env`, 운영은 서버 프로젝트 **루트 `.env.deploy`**를 사용합니다.
로컬의 `deploy/.env.deploy`는 운영 Compose가 자동으로 읽는 파일이 아닙니다.

```dotenv
FRONTEND_URL=https://dayoff.today
NAVER_ORDER_ENABLED=false
NAVER_ORDER_MODE=test
NAVER_ORDER_AUDIENCE=review
NAVER_ORDER_REVIEW_USER_IDS=
NAVER_ORDER_MERCHANT_ID=
NAVER_ORDER_CERTI_KEY=
NAVER_ORDER_BUTTON_KEY=
NAVER_ORDER_ACCOUNT_ID=
NAVER_ORDER_PRODUCTION_READY=false
```

테스트 키와 검수용 HTTPS 사이트를 준비한 뒤 `NAVER_ORDER_ENABLED=true`로 설정합니다.
버튼은 `/shop/naver-order/config`의 설정을 읽으므로 Vite 빌드 변수는 필요 없습니다.
운영 모드는 `production`이며, 검수와 아래 운영 준비를 끝내기 전에는
`NAVER_ORDER_PRODUCTION_READY=false`로 유지합니다. false이면 운영 주문서 등록과
구매 버튼이 차단됩니다. 네이버 검수 승인 여부를 서버가 자동 확인하는 기능은 아닙니다.

## 시스템 연동 검수: 특정 계정만 노출

**네이버에 전달하는 검수 환경은 운영 도메인 `https://dayoff.today`입니다.**
로컬 테스트 결과만으로 검수 준비 완료로 간주하지 않습니다. 운영 DB의 계정과 운영 전체 상품을
사용하며, 운영 API의 `NODE_ENV=production`은 유지합니다. `NAVER_ORDER_MODE=test`는
네이버페이 연결 환경을 뜻하므로 운영 사이트에서도 사용합니다.

새 API/Web 이미지 배포 및 운영 `.env.deploy`에 네 가지 주문형 키·HTTPS `FRONTEND_URL`을
설정한 뒤, **운영 호스트의 프로젝트 루트**에서 실행합니다.

```sh
sh deploy/setup-npay-review.sh
```

이 명령은 Compose의 운영 DB 연결로 전용 일반 회원을 생성하고, 운영 호스트의
`npay-review-credentials.local`에 비밀번호를 저장합니다. `.env.deploy`에 검수 계정 UUID,
로그인 활성화, `NAVER_ORDER_ENABLED=true`, `NAVER_ORDER_MODE=test`,
`NAVER_ORDER_AUDIENCE=review`, `NAVER_ORDER_PRODUCTION_READY=false`를 설정한 다음
API 컨테이너를 재생성합니다. 이미 공개/운영 결제 모드인 경우 임의 전환하지 않고 중단합니다.
설정이 누락되면 계정 생성 전에 중단합니다. 로컬 인증정보 파일은 운영 계정의 증빙이 아닙니다.

운영에서 완료해야 할 확인:

- 별도 시크릿 창의 일반 방문자·일반 회원은 상품/장바구니 버튼과 SDK가 비노출이며 직접 주문등록도 거부됩니다.
- `/npay-review`에서 운영 계정으로 로그인하면 모든 상품 상세와 장바구니에서 검수할 수 있습니다.
- 로그아웃 후 버튼이 사라지고, XML 콜백은 네이버 서버에서 로그인 없이 조회할 수 있습니다.
- 품절 상품을 검수하기 위해 운영 재고를 임의로 변경하지 않습니다. 구매 흐름 검증용 재고는 운영자와 확인합니다.
- 검수 종료 시 `NAVER_REVIEW_LOGIN_ENABLED=false`로 변경 후 API를 재생성하여 기존 검수 세션까지 차단합니다.

담당자 메일의 요구에 따라 **검수 전용 로그인 `/npay-review`와 일반 회원 계정**을 사용합니다.
검수자에게 소셜 계정 제공이나 사전 가입을 요청하지 않습니다. 일반 고객의 소셜 로그인은 유지합니다.
`NAVER_ORDER_AUDIENCE=review`가 기본값입니다. 일반 방문자/일반 회원에게는 구매 버튼,
버튼키, SDK를 제공하지 않고 주문등록 API 직접 호출도 차단합니다. 지정한 계정은
모든 상품 상세와 장바구니에서 같은 검수 흐름을 이용합니다. 상품별 허용 목록은 없습니다.
품절 상품은 비활성 버튼으로 표시하며, 테스트 때문에 실제 재고를 임의로 올리지 않습니다.

1. 대상 DB에 연결되는 환경에서 `cd server && npm run npay:review:setup`을 실행합니다.
   `.env`의 `DATABASE_URL`을 사용하며 기존 회원을 수정하지 않고 전용 일반 회원만 생성합니다.
   운영에서는 위의 `sh deploy/setup-npay-review.sh`를 사용합니다.
   로컬 DB에 생성한 계정이 운영 DB에 자동 복제되지는 않습니다.
2. 스크립트가 환경 파일 옆에 `npay-review-credentials.local`을 만듭니다(권한 600, Git 제외).
   아이디 `npay_test`, 이메일 `npay_test@dayoff.invalid`, 무작위 비밀번호가 들어 있습니다.
   이메일은 로그인 식별자이며 실제 수신함은 아닙니다. 생성 시 이메일을 발송하지 않습니다.
   같은 환경에서 다시 실행해도 비밀번호를 바꾸거나 계정을 중복 생성하지 않습니다.
3. `NAVER_REVIEW_LOGIN_ENABLED=true`, `NAVER_REVIEW_LOGIN_ID`, `NAVER_REVIEW_USER_ID`는
   스크립트가 설정합니다. 해당 UUID는 검수 허용 목록에 자동 포함됩니다.
   기존 회원을 추가 허용하려면 별도로 `NAVER_ORDER_REVIEW_USER_IDS`에 UUID를 지정할 수 있습니다.
4. `NAVER_ORDER_ENABLED=true`, `NAVER_ORDER_MODE=test`, `NAVER_ORDER_AUDIENCE=review`를
   설정하고 API를 재시작합니다. `NAVER_ORDER_PRODUCTION_READY=false`는 유지합니다.
5. 검수 계정에서 전체 상품 상세/장바구니 노출, 로그아웃·일반 계정에서 비노출을 확인합니다.
6. 네이버 담당자에게 로그인 URL, 검수 전용 계정 이메일/비밀번호, 상품정보 XML URL을
   보냅니다. 전달은 운영자가 직접 진행합니다. 키/관리자 비밀번호는 보내지 않습니다.

예시 전달 항목(배포 및 계정 설정 후 유효):

- 로그인: `https://dayoff.today/npay-review`
- 전체 상품: `https://dayoff.today/shop`
- 장바구니: `https://dayoff.today/cart`
- 상품정보 XML: `https://dayoff.today/shop/naver-order/products`
- 검수 전용 일반 회원 이메일/비밀번호: 별도 전달

XML 콜백은 네이버 서버가 로그인 없이 요청하므로 계정 제한을 적용하지 않습니다.
상품정보·가격·재고만 반환하며 회원정보나 인증키는 반환하지 않습니다.
로그인/로그아웃 시 버튼 설정 캐시를 분리하며, 서버는 매 주문등록 때 JWT와 허용 계정을
다시 검사합니다. 삭제/만료/위조된 로그인으로는 검수 구매가 불가능합니다.
검수 세션은 4시간 유효하며 비밀번호 교체 시 기존 검수 세션도 무효화됩니다.
`NAVER_REVIEW_LOGIN_ENABLED=false` 후 API를 재시작하면 기존 검수 토큰도 차단됩니다.
검수 로그인은 `NAVER_ORDER_MODE=test`, `NAVER_ORDER_AUDIENCE=review`에서만 동작합니다.
로그인 API는 IP별 15분 10회 및 프로세스 전체 분당 100회로 제한합니다.

최종 오픈은 검수 완료 및 재고 운영 준비 후 `NAVER_ORDER_MODE=production`,
`NAVER_ORDER_PRODUCTION_READY=true`, `NAVER_ORDER_AUDIENCE=public`을 모두 설정해야 합니다.
`public`을 테스트 환경에 지정하거나 오타를 입력하면 계정과 관계없이 차단됩니다.

## 네이버에 전달할 URL

- 서비스: `https://dayoff.today`
- 상품 상세: `https://dayoff.today/shop/<상품 slug>`
- 상품정보 XML: `https://dayoff.today/shop/naver-order/products`

네이버페이센터의 연동 정보에 XML URL을 등록해야 합니다. 상품 조회는
`product[0][id]=<상품번호>&optionSearch=true` 형식입니다.
추가배송비는 XML의 권역별 설정으로 전달하며 자체 배송비 조회 API는 사용하지 않습니다.
상품번호는 DB UUID를 base64url로 표현한 22자 값이며 서버가 주문등록 때 자동 전송합니다.
이미지는 외부에서 접근 가능한 URL이어야 합니다.

## 구현 범위와 오픈 전 남은 작업

구현: 공식 버튼 SDK, 공통 유입 스크립트, 비회원 주문등록, 서버 가격·옵션·공유 재고
검증, 상품정보 XML, 네이버 권역별 추가배송비 설정, 비밀값을 제외한 관리자 설정 상태 조회.
주문등록 성공은 결제 완료가 아니므로 자체 주문을 만들거나 재고/쿠폰/장바구니를
변경하지 않습니다. 과세 실물 상품만 지원합니다.

주문관리 API 인증·변경 주문 조회·상세 조회·재고 동기화는 구현되어 있습니다.
실제 운영 재고 자동 반영은 **주문관리 API Sandbox 검수와 Production 애플리케이션 발급 후**에
활성화합니다. 구매 버튼 승인과 API 애플리케이션 검수는 별도입니다.
현재 Sandbox 데이터는 별도 원장에만 기록하며 운영 상품 재고를 변경하지 않습니다.

상세 운영·검증·전환 절차는 [NAVER_ORDER_SYNC.md](NAVER_ORDER_SYNC.md)를 참고합니다.
키 입력은 `server/.env`, 서버 적용 후 장기 보관은 운영 서버의 `.env.deploy`입니다.
기존 구매용 키 4개 및 `NAVER_ORDER_MODE=production`은 유지합니다.

```env
NAVER_ORDER_API_MODE=sandbox
NAVER_ORDER_API_CLIENT_ID=발급받은_애플리케이션_ID
NAVER_ORDER_API_CLIENT_SECRET='발급받은_시크릿_전체값'
NAVER_ORDER_SYNC_ENABLED=false
NAVER_ORDER_SYNC_START_AT=
NAVER_ORDER_INVENTORY_ENABLED=false
```

실제 재고 반영을 활성화하기 전까지 결제/취소 재고는 사이트 관리자에서 수동으로 조정합니다.
주문 발주·송장·취소·반품 처리는 네이버페이센터를 계속 사용합니다.
사이트 회원의 주문내역·구매평·결제완료 메일에 네이버 주문을 자동 연결하는 기능은 이번 범위에 포함되지 않습니다.

배송 정책은 4,000원 / 10만원 이상 기본배송비 무료 / 제주 추가비 3,000원·제주 외 도서산간
추가비 5,000원을 XML로 제공합니다. 권역 판별은 네이버페이에 맡기며
`apiSupport=false`, `splitUnit=3`, `area2Price=5000`, `area3Price=3000`을 주문등록·상품정보에 동일 적용합니다. **네이버 주문서가 무료배송 기준을 충족할 때
추가비를 처리하는 결과를 검수해야 합니다.** 기존 결제형은 10만원 이상이면 도서산간도
무료였으므로 금액 일치 확인 전 실결제 오픈하지 않습니다. 반품비는 센터 설정을 사용합니다.

## 검증 항목

- 로그아웃 상품 구매: 옵션 미선택, 옵션 위조, 품절, 수량 초과, 중복 클릭
- 같은 상품의 다른 옵션을 함께 구매할 때 합산 재고 초과 차단
- 장바구니 선택 상품과 수량, 상품 할인가 전송 / 사이트 쿠폰 미적용
- XML: 한글·특수문자, 비활성·삭제·품절 상품, 옵션 조회, 가격 변경
- 일반/제주/도서산간, 10만원 미만/이상, 묶음배송 최종 금액
- 공식 SDK의 PC·모바일 주문서 열기와 SPA 이동 후 버튼 정리
- 실제 결제/취소 후 센터 주문 확인, 재고 운영, 배송 및 반품

관리자 설정 점검: `GET /shop/admin/naver-order/status` (관리자 JWT 필요).
실제 키를 사용한 API 시험과 네이버 검수는 가입 승인 후 진행해야 합니다.

## 기존 결제형 주문

기존 승인·취소 API와 결제 인증정보는 기존 주문 처리용으로 보존합니다.
신규 결제형 주문은 기본 차단하며 운영 Compose는
`NAVER_PAY_LEGACY_CHECKOUT_ENABLED=false`를 고정합니다.
`/checkout`은 장바구니로 이동하고 기존 성공/실패 복귀 경로는 유지합니다.
주문형 비활성화: `NAVER_ORDER_ENABLED=false` 후 API 재기동.

## 공식 자료

- https://order-docs.pay.naver.com/docs/
- https://order-docs.pay.naver.com/docs/button-sdk/integration-guide
- https://order-docs.pay.naver.com/docs/button-sdk/api-reference
- https://github.com/npay-mall-order-api/merchant-order-api (주문등록 2.1 상세 PDF 및 주문관리 API 안내)


## 2026-10-16 URL 변경 후 검수 재확인

네이버 담당자가 Sandbox 가맹점 URL을 변경한 후 버튼 metadata의 merchantUrl이
`https://dayoff.today/`로 응답하는 것을 확인했습니다. 기존 Origin verification failed는
재현되지 않습니다. 검수 계정과 테스트 모드를 유지하며 운영 결제로 전환하지 않습니다.

- 기본 연동 버전: **2.1**, 공식 버튼 SDK 사용.
- PC 주문서: `https://test-order.pay.naver.com/customer/buy/{key}/{merchantNo}`.
- 모바일 주문서: `https://test-m.pay.naver.com/o/customer/buy/{key}/{merchantNo}`.
- 검수 계정 주문내역 링크: `https://test-pay.naver.com`.
- 찜하기·톡톡은 현재 제공하지 않습니다. 구매 버튼만 노출합니다.
- 전체 10개 상품에서 공식 구매 버튼과 XML 응답을 확인했습니다.
- 상품/장바구니 주문등록 성공 및 네이버 로그인으로의 이동까지 확인했습니다.
  네이버 로그인 이후 주문서 금액·배송비·테스트 결제 완료는 별도 확인이 필요합니다.
- 테스트 계정 장바구니의 수량 4개가 재고 1개를 초과하여 1개로 조정했습니다.
  실제 상품 재고는 변경하지 않았습니다.

검수 담당자에게 회신할 정보:

1. 기본 연동 2.1
2. 로그인 `https://dayoff.today/npay-review` (아이디 `npay_test`, 비밀번호 별도 전달)
3. 전체 상품 `https://dayoff.today/shop`
4. 상품 상세 `https://dayoff.today/shop/moucheture-plate`
5. 장바구니 `https://dayoff.today/cart`
6. 상품정보 XML 기본 URL `https://dayoff.today/shop/naver-order/products`

XML 기본 URL에는 네이버가 조회할 상품 ID를 쿼리로 추가합니다. 파라미터 없이
브라우저에서 열면 400이 반환되는 것이 정상입니다. 브라우저 확인용 실제 상품 예시:

`https://dayoff.today/shop/naver-order/products?product%5B0%5D%5Bid%5D=lhIAKnrhRuqXDvhbfPYWzQ&optionSearch=true`

검수 비밀번호와 인증키는 이 문서 또는 Git에 저장하지 않습니다.


## 검수 보완: 복귀 주소 및 권역별 추가배송비

- 상품 상세 주문등록의 `order/backUrl`은 서버 상품 slug로 만든 해당 상세 URL입니다.
- 장바구니 주문등록은 `https://dayoff.today/cart`로 복귀합니다.
- 클라이언트는 출발 화면(`source=product|cart`)만 전송합니다. 외부 복귀 URL은 받지 않습니다.
- 주문등록과 상품정보 XML 모두 `surchargeByArea/apiSupport=false`입니다.
- `splitUnit=3`: 네이버가 내륙 / 제주 외 도서산간 / 제주를 구분합니다.
- `area2Price=5000`: 제주 외 도서산간 추가비 5,000원.
- `area3Price=3000`: 제주 추가비 3,000원.
- 기본배송비 4,000원, 10만원 이상 기본배송비 무료, 배송비 묶음 그룹 `dayoff`는 유지합니다.
- 자체 우편번호표를 조회하던 `/shop/naver-order/shipping-fees`는 제거했습니다. 네이버에 추가배송비 조회 API URL을 등록할 필요가 없습니다.

## 비회원 장바구니 운영 검증

- 로그아웃 상태에서 상품 옵션 선택 → 담기 → `/cart` 접근 → 새로고침 후 수량 유지 → 네이버 주문서 연결을 확인합니다.
- 마지막 상품 삭제 후에는 네이버페이 버튼이 표시되지 않아야 합니다.
- 비회원 장바구니는 브라우저별로 보관하며 회원 장바구니와 분리됩니다.
- 로컬 저장 데이터 정합성, 최신 가격 조회, 옵션·공유 재고 검증: `node --test tests/guest-cart.test.mjs`.
