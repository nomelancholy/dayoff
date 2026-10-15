# CONTACT 문의 메일 설정

문의 폼 → `POST /api/contact/inquiries` → 기존 서버의 Resend 발송 기능 → 운영자 메일함.
DB 마이그레이션은 필요 없으며 문의 내용과 첨부파일을 서버에 저장하지 않습니다.
첨부파일은 요청 중 메모리에만 유지하고 메일에 첨부합니다.

## Resend에서 할 일

1. [Domains](https://resend.com/domains)에서 본인이 소유한 발신 도메인을 등록합니다.
   이미 기존 회원가입·주문 메일용 도메인이 인증되어 있다면 그대로 사용하면 됩니다.
2. Resend가 표시하는 **발신 인증용 DNS 레코드(DKIM, SPF 등)**를 도메인의 DNS 관리
   화면에 그대로 추가하고 Verify 후 `Verified` 상태를 확인합니다.
   발신 전용 서브도메인을 사용해도 됩니다. 예: `mail.your-domain.com`.
   이 기능은 네이버/Gmail 등 기존 메일함으로 알림을 보내므로 Resend의
   **Enable Receiving이나 인바운드 웹훅은 필요하지 않습니다.**
3. [API Keys](https://resend.com/api-keys)에서 `Sending access` 권한의 키를 생성합니다.
   가능하면 인증한 발신 도메인으로 범위를 제한합니다. 기존 발송용 키가 있다면 재사용할 수 있습니다.
4. 발신 주소를 정합니다. 인증된 도메인의 주소를 사용해야 합니다.
   예: `디오티 <contact@your-domain.com>`.
   운영 발송에 `onboarding@resend.dev`를 사용하지 않습니다. 이 테스트 도메인은
   Resend 계정 이메일 등 허용된 테스트 수신자에게만 발송할 수 있습니다.

참고: [도메인 인증](https://resend.com/docs/dashboard/domains/introduction),
[API 키 관리](https://resend.com/docs/dashboard/api-keys/introduction),
[테스트 도메인 제한](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

## 로컬 설정

`server/.env.contact.example`을 참고해 **기존 `server/.env`에 병합**합니다.
기존 DB·로그인·주문 설정 파일을 덮어쓰지 않습니다.

```dotenv
CONTACT_ENABLED=true
CONTACT_TO_EMAIL=eundi2c@naver.com
RESEND_API_KEY=re_여기에_실제_키
RESEND_FROM_EMAIL="디오티 <contact@your-domain.com>"
```

- `CONTACT_TO_EMAIL`은 문의를 받을 이메일입니다. 다른 네이버/Gmail 주소로 변경 가능합니다.
  Resend에서 별도의 수신 폼을 만들거나 해당 메일함의 비밀번호를 등록할 필요가 없습니다.
- `CONTACT_ENABLED`는 기본적으로 `false`입니다. 나머지 설정이 준비되면 `true`로 바꿉니다.
- `RESEND_API_KEY`는 서버에만 저장합니다. 프론트의 `VITE_` 변수에 넣지 않습니다.
- `RESEND_FROM_EMAIL`은 기존 회원가입·주문 메일에도 적용되는 공통 발신 주소입니다.
  이미 설정된 값이 올바르면 유지합니다.
- 문의 메일의 `Reply-To`는 문의자 이메일로 자동 지정됩니다. 기존 `RESEND_REPLY_TO`
  설정을 수정할 필요 없이 메일함에서 답장 버튼으로 문의자에게 회신할 수 있습니다.

서버를 재시작합니다. 프론트 `VITE_API_URL`이 로컬 서버 주소를 가리키는지 확인합니다
(미설정 시 `http://localhost:4000`). 설정 후 테스트 문의 1건을 보내 실제 메일 수신과
답장 주소를 확인하세요. Resend 대시보드의 발송 내역과 스팸함도 함께 확인합니다.
로컬에서 `CONTACT_ENABLED=true`와 실제 키를 사용하면 **실제 메일이 발송**됩니다.

## 동작과 제한

- 비회원도 문의 가능: 성함·이메일·카테고리·제목·내용·수집 이용 동의 필수.
- 첨부: JPG, PNG, WEBP, PDF 중 1개, 최대 5MB. 서버에서 파일 유형과 시그니처 확인.
- 스팸 방지: 숨김 필드 및 같은 IP에서 10분당 5회 요청 제한.
  제한은 현재 단일 서버 프로세스의 메모리 기준이며 재시작 시 초기화됩니다.
  서버 복제·스팸 증가 시 공통 제한 저장소나 CAPTCHA를 추가할 수 있습니다.
- 설정 누락·발송 실패 시 503 오류를 반환하고 폼 입력은 유지됩니다.
- 접수 완료는 Resend가 발송 요청을 수락한 경우 표시됩니다. 최종 메일함 도착까지
  보장하는 의미는 아닙니다. 전달 상태는 Resend에서 확인합니다.
- 무료 한도는 하루 100통·월 3,000통이며 기존 회원가입·주문 알림과 공유합니다.
  [공식 한도](https://resend.com/docs/knowledge-base/account-quotas-and-limits).

## 운영 반영을 할 때

운영에 코드를 배포하는 것과 실제 메일 발송 활성화는 별도입니다.
`deploy/env.deploy.example`의 CONTACT 항목을 운영 환경에 채우고 활성화해야 합니다.
저장소의 compose에는 변수 전달, Nginx에는 `/api/contact/` 프록시 및 6MB 요청 한도가
준비되어 있습니다. **프론트·백엔드·Nginx 설정을 함께 반영**해야 합니다.
`/contact` 페이지 경로는 계속 프론트에서 처리됩니다.

## 외부 호출 없는 검증

```bash
npm run build
cd server
npm run build
npm run test -- --runInBand common/email/email.service.spec.ts
npm run test:e2e -- --runInBand contact.e2e-spec.ts proxy-routes.e2e-spec.ts
```

위 문의 테스트는 실제 DB나 Resend에 접속하지 않습니다.
