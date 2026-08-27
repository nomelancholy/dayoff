# 네이버페이 결제형 운영 준비

이 프로젝트는 네이버페이 **결제형 단건결제**를 사용합니다. 네이버페이 주문형과
네이버 로그인용 `NAVER_CLIENT_*` 인증값은 서로 다른 기능입니다.

## 1. 네이버페이에서 직접 진행할 작업

1. [네이버페이 결제형 가입 및 연동 절차](https://developers.pay.naver.com/introduce/process)를 진행합니다.
2. 네이버페이 개발자센터의 `내 개발정보 > 결제형 > 내 인증값 확인하기`에서
   동일한 환경의 Client ID, Client Secret, Chain ID를 발급받습니다.
3. 개발환경에서 결제창 호출, 승인, 전체취소를 먼저 시험합니다.
4. 네이버페이센터에서 단건결제 연동 체크리스트를 내려받아 자체 점검 후 기술검수를
   요청합니다.
5. 운영 검수 담당자에게 서비스 주소와 결제 결과 복귀 주소를 전달합니다.
   - 서비스: `https://dayoff.today`
   - 결제 결과: `https://dayoff.today/checkout/success`
6. 정산 방식이 `거래 완료일 기준`인지 확인합니다. 이 방식이면 배송 완료 후
   `거래 완료 API`를 호출하는 추가 작업이 필요하므로 오픈 전에 담당자에게 알려주세요.
7. 검수에서 공식 Npay BI 버튼 자산 사용을 요청하면 네이버페이가 제공한
   자산과 표시 규정을 전달해 주세요. 임의로 제작한 로고 이미지는 사용하지 않습니다.

공식 문서:

- [결제창 호출](https://docs.pay.naver.com/docs/onetime-payment/payment/payment-auth-window)
- [단건 결제 승인](https://docs.pay.naver.com/docs/onetime-payment/payment/apply)
- [단건 결제 취소](https://docs.pay.naver.com/docs/onetime-payment/payment/cancel)
- [결제형 검수](https://developers.pay.naver.com/support/inspection/payment)

## 2. 개발환경 설정

루트 `.env`:

```dotenv
VITE_CHECKOUT_ENABLED=true
```

`server/.env`:

```dotenv
NAVER_PAY_ENABLED=true
NAVER_PAY_MODE=development
NAVER_PAY_CLIENT_ID=개발환경_Client_ID
NAVER_PAY_CLIENT_SECRET=개발환경_Client_Secret
NAVER_PAY_CHAIN_ID=개발환경_Chain_ID
FRONTEND_URL=http://localhost:5173
```

Client Secret은 절대로 `VITE_*` 변수나 프론트 코드에 넣지 않습니다.

## 3. 운영 서버 설정

DigitalOcean 서버의 프로젝트 디렉터리에 있는 `.env.deploy`에 다음 값을 넣습니다.
주의: 배포 워크플로와 Compose가 읽는 파일은 `deploy/.env.deploy`가 아니라
프로젝트 **루트의 `.env.deploy`**입니다.

```dotenv
NAVER_PAY_ENABLED=true
NAVER_PAY_MODE=production
NAVER_PAY_CLIENT_ID=운영환경_Client_ID
NAVER_PAY_CLIENT_SECRET=운영환경_Client_Secret
NAVER_PAY_CHAIN_ID=운영환경_Chain_ID
VITE_CHECKOUT_ENABLED=true
FRONTEND_URL=https://dayoff.today
PUBLIC_ORIGIN=https://dayoff.today
```

운영 키 세 값은 반드시 같은 운영 환경에서 발급된 한 세트여야 합니다.

GitHub 저장소 `Settings > Secrets and variables > Actions > Variables`에도 다음
Repository variable을 추가합니다.

```text
VITE_CHECKOUT_ENABLED=true
```

CI가 웹 이미지를 미리 빌드하므로 서버의 `.env.deploy`만 바꾸면 버튼이 활성화되지
않습니다. GitHub 변수까지 설정한 뒤 새 배포가 필요합니다.

## 4. 배포 후 점검

관리자 토큰으로 아래 API를 호출하면 비밀값을 노출하지 않고 설정 상태를 확인할 수
있습니다.

```http
GET /shop/admin/naver-pay/status
Authorization: Bearer {관리자 JWT}
```

정상 운영 설정 예시:

```json
{
  "enabled": true,
  "mode": "production",
  "configured": true,
  "missingKeys": []
}
```

실결제 오픈 전에는 아래 흐름을 모두 확인합니다.

- 결제 성공 후 주문이 `paid`가 되고 재고와 장바구니가 정확히 반영되는지
- 사용자 취소와 결제 시간 초과 사유가 화면에 그대로 표시되는지
- 발송 전 주문 전체취소 시 네이버페이 취소, 재고 원복, 쿠폰 원복이 함께 되는지
- 같은 승인/취소 요청을 다시 보내도 중복 결제나 중복 환불이 발생하지 않는지
- 모바일 및 인앱 브라우저에서 결제창이 페이지 전환 방식으로 정상 노출되는지

## 5. 즉시 비활성화

장애 시 서버 `.env.deploy`의 `NAVER_PAY_ENABLED=false`로 신규 결제 준비를 차단할 수
있습니다. 이 상태에서도 기존 주문의 취소·환불은 가능합니다. 구매 버튼도
숨기려면 GitHub의 `VITE_CHECKOUT_ENABLED=false`로 변경 후 웹 이미지를 다시
배포합니다.
