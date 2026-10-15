# Dayoff Server (NestJS)

디오티(DIOTI) 서비스 백엔드 서버입니다.  
NestJS + Drizzle ORM + PostgreSQL 기반으로 인증, 주문/결제, 관리자 기능을 제공합니다.

## 기술 스택

- NestJS 11
- TypeScript
- PostgreSQL
- Drizzle ORM / Drizzle Kit
- Passport (JWT, Google, Kakao, Naver)
- Naver Pay
- Resend (React Email 템플릿)

## 요구 사항

- Node.js 20+
- npm
- PostgreSQL (로컬 또는 Docker)

## 시작하기

```bash
cd "/Volumes/sub ssd/dev/dayoff/server"
npm install
```

## 실행

```bash
# 개발 (watch)
npm run start:dev

# 일반 실행
npm run start

# 프로덕션 빌드 실행
npm run build
npm run start:prod
```

## DB 작업

```bash
# 스키마 기준 SQL 마이그레이션 생성
npm run db:generate

# 코드 스키마를 DB에 바로 반영 (개발 편의)
npm run db:push

# 생성된 마이그레이션 적용
npm run db:migrate

# migrate 이력 부트스트랩
npm run db:bootstrap

# 샘플 데이터
npm run db:seed-example
npm run db:seed-orders

# DB Studio
npm run db:studio
```

## 메일 발송(Resend)

이 서버는 아래 이벤트에서 메일을 발송합니다.

- 회원가입 완료
- 주문 결제 완료
- 발송 완료
- 재입고 알림 (재고 수정 또는 주문 취소로 품절 상품이 다시 구매 가능해졌을 때)
- 쿠폰 지급 (관리자가 회원에게 쿠폰을 지급했을 때 쿠폰 코드·조건 안내)

메일은 부가 알림이므로 전송이 지연되거나 실패해도 결제·발송·지급 처리 자체는 그대로
완료되고, 실패 사유만 서버 로그에 남습니다. `RESEND_API_KEY`가 없으면 발송을 건너뜁니다.

## CONTACT 문의

CONTACT 문의 폼은 `POST /api/contact/inquiries`로 접수해 운영자 메일로 전달합니다.
기본 비활성 상태이며 `CONTACT_ENABLED=true`, `CONTACT_TO_EMAIL` 및 기존 Resend
설정이 필요합니다. 문의 발송 실패는 폼에 오류로 표시합니다.
Resend 설정과 로컬 검증 방법은 [`deploy/CONTACT_SETUP.md`](../deploy/CONTACT_SETUP.md)를 참고합니다.

## 결제/주문 관련 참고

신규 구매는 네이버페이 **주문형 2.1**입니다.

- 공개 설정: `GET /shop/naver-order/config`
- 비회원 주문서 등록: `POST /shop/naver-order/register`
- 상품정보 XML: `GET /shop/naver-order/products`
- 도서산간 배송비 XML: `GET /shop/naver-order/shipping-fees`
- 관리자 설정 점검: `GET /shop/admin/naver-order/status`

주문관리 API의 결제/취소 수집과 재고 자동 동기화는 아직 미구현입니다.
운영 오픈 전 준비 사항은 [주문형 설정 문서](../deploy/NAVER_PAY_SETUP.md)를 참고합니다.
기존 결제형 승인·취소는 기존 주문용으로 유지하며 신규 결제형 주문은 기본 차단합니다.
