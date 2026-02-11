# DOT. 공방 홈페이지 — 프로젝트 세팅 & 작업 진행 계획

> **참고**: 디자인 원본은 `/_reference_ui` 폴더의 HTML 파일들.  
> 스택·코딩 규칙은 `/.cursorrules`, 요구사항은 `/spec.md` 기준.

---

## 1. 프로젝트 세팅

### 1.1 초기 프로젝트 생성

- [x] Vite + React + TypeScript 프로젝트 생성 (`npm create vite@latest . -- --template react-ts`)
- [x] Path Alias 설정 (`@/` → `app`) — `vite.config.ts`, `tsconfig.app.json`
- [x] `app` 폴더 생성 및 진입점 이동 (`.cursorrules` 기준: 모든 소스는 `app` 내)

### 1.2 스타일링

- [x] Tailwind CSS 설치 및 설정 (Tailwind v4 + `@tailwindcss/postcss`)
- [x] Shadcn UI 초기화 (`npx shadcn@latest init`), 컴포넌트 경로 `@/common/components/ui`
- [ ] Magic UI 컴포넌트 연동 (필요 시 — 컴포넌트 추가할 때 연동)
- [x] `cn()` 유틸 (`app/common/lib/utils.ts`) — `clsx` + `tailwind-merge`

### 1.3 라우팅 & 레이아웃

- [x] React-Router v6 설치 및 설정 (`createBrowserRouter` + `RouterProvider`)
- [x] Feature별 페이지 구조 (`app/features/[feature]/page/Page.tsx`), 라우트 설정은 `app/router.tsx`
- [x] Layout 컴포넌트 구현 (Header + `Outlet` + Footer) — `_reference_ui` 레이아웃 참고 (`app/common/components/`)

### 1.4 상태 관리 & 데이터 (Backend Transition: NestJS)

- [x] Zustand 설치, `app/common/store` 구조 (`store/ui.ts`, `store/index.ts`)
- [x] Tanstack Query 설치 및 QueryClient 설정 (`app/common/lib/queryClient.ts`, `QueryClientProvider` in `main.tsx`)
- [x] NestJS 프로젝트 생성 (`server/` 폴더)
- [x] PostgreSQL 연결 및 Drizzle ORM 설정 (NestJS 내에서 관리)
- [x] API Client 설정 (Axios/Fetch) 및 전역 에러 핸들링
- [x] Drizzle 스키마 정의 및 마이그레이션 (NestJS 내)

### 1.5 DB 인프라: NestJS + PostgreSQL 전용

- [x] **docker-compose.yml** 작성 — PostgreSQL만 단일 서비스로 정의 (포트, 비밀번호, 볼륨 등)
- [x] **server/.env**의 `DATABASE_URL`을 로컬/배포용 PostgreSQL 연결 문자열로 설정
- [x] Docker 컨테이너 기동 후 **Drizzle 마이그레이션** 실행 (`db:push` 또는 `db:migrate`) 및 연결 확인

**방향 요약**: DB는 **NestJS + PostgreSQL만** 사용. NestJS + Drizzle + `pg` 조합으로 `server`에서 스키마·마이그레이션 관리. Supabase 미사용.

### 1.6 인증 (NestJS Auth)

- [x] NestJS Passport + JWT 인증 시스템 구현 (이메일 회원가입/로그인, JWT 발급)
- [x] 소셜 로그인 연동 (카카오, 구글, 네이버) — OAuth 리다이렉트 후 콜백에서 JWT 발급
- [x] Auth Guard 및 세션/토큰 관리 로직 구현 (JwtAuthGuard, LocalAuthGuard, CurrentUser 데코레이터, apiClient Bearer/401 처리)

### 1.7 개발 환경

- [x] ESLint/Prettier 설정 (선택) — Prettier + `eslint-config-prettier`, `npm run format`
- [x] `spec.md` Data Structure 기반 Drizzle 스키마 초안 — feature별 `schema/` (auth, shop, order, coupon, class, contact)

---

## 2. 작업 진행 계획 (기능 단위)

### 2.1 공통 UI & 레이아웃

- [x] **Header**: `_reference_ui` 네비게이션, 로고, 장바구니/유저 링크 반영
- [x] **Footer**: 로고, 저작권 문구
- [x] **Layout**: 위 컴포넌트로 Outlet 감싸기, 반응형 (`md:`, `lg:`)
- [x] 공통 스타일(글레이즈 오버레이, 폰트 등) Tailwind로 이식

### 2.2 메인 페이지 (Home)

- [x] Hero 섹션 (이미지, 타이틀, 스크롤 인디케이터)
- [x] About 미리보기
- [x] Shop 상품 그리드 미리보기 → 상세/장바구니 링크

### 2.3 About 페이지

- [x] `_reference_ui/about.html` 기반 레이아웃·콘텐츠
- [x] 이미지, 텍스트, 갤러리 섹션 컴포넌트화

### 2.4 Shop (쇼핑)

- [x] 상품 목록 페이지: 그리드, 카테고리 필터 (컵/그릇/소품 등)
- [x] 상품 상세 페이지: 이미지, 옵션, 수량, 장바구니 담기 / 바로 구매
- [x] 장바구니 페이지: 수량 변경, 삭제, 주문 요약
- [x] **Admin 전용**: 상품 등록/수정/삭제 (권한 체크) — 백엔드 구현 완료, 프론트 어드민 상품 등록 페이지(`/shop/admin/new`) 추가 완료
- [x] 어드민 상품 등록 페이지 추가

### 2.5 Class (원데이 클래스)

- [x] 클래스 소개 페이지: 물레 / 컬러 클레이 / 자유 원데이
- [x] 네이버 예약 링크 연동 또는 자체 예약 플로우 (선택)

### 2.6 Contact

- [x] 연락처 정보: 이메일, 인스타, 블로그
- [x] 지도 표시 (카카오맵/구글맵 등)
- [x] 찾아오는 길: 충무로역 7번 / 을지로3가 8번 탭·단계별 안내

### 2.7 회원 (Auth & Account)

- [x] 로그인/회원가입: 이메일 + 소셜(카카오, 구글) — `/login`, `/register` 페이지, 소셜 버튼 및 콜백 token 처리
- [x] 내 정보 페이지: 로그인 시 이메일/이름/권한 표시, 로그아웃 (`/account`)
- [x] 로그아웃
- [x] 프로필 수정, 주문 내역, 주소록 (`_reference_ui/account.html`)
- [x] 네이버 지도 연동

### 2.8 쿠폰 (회원 할인)

- [ ] 쿠폰 테이블/스키마 설계 (코드, 할인 타입·값, 유효기간 등)
- [ ] 회원-쿠폰 연동 (발급/사용 내역)
- [ ] 장바구니/결제 단계에서 쿠폰 적용 UI & 로직

### 2.9 결제 (선택)

- [ ] 결제 연동 (토스, 스트라이프 등) 또는 “결제 페이지 예정” 플레이스홀더

### 2.10 마무리

- [ ] 반응형 전 구간 점검
- [ ] NestJS Guard 및 권한(일반/Admin) 최종 확인
- [ ] 배포 설정 (Vercel/Netlify/Render 등)

---

## 3. 폴더 구조 (목표)

```
app/
├── common/
│   ├── components/
│   │   ├── ui/          # Shadcn
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── hooks/
│   ├── lib/             # utils.ts, apiClient.ts
│   └── store/           # Zustand
├── features/
│   ├── [feature-name]/
│   │   ├── components/
│   │   ├── api/         # NestJS API 호출
│   │   ├── types/
│   │   └── page/
server/
├── src/
│   ├── common/
│   │   └── database/    # Drizzle Module
│   ├── db/
│   │   ├── schema/      # Drizzle Schemas
│   │   └── migrations/
│   ├── auth/            # Auth Module
│   ├── shop/            # Shop Module
│   └── ...
public/
_reference_ui/
```

---

## 4. 참고 사항

- **DB 쿼리**: NestJS 서버 내에서 Drizzle ORM 사용.
- **데이터 페칭**: 프론트엔드에서는 Tanstack Query를 사용하며, NestJS API 엔드포인트를 호출.
- **컴포넌트**: 함수형, Named Export, `props` 인터페이스 명시.
- **Shadcn 추가**: `npx shadcn@latest add [component]` 사용.
- **Backend**: NestJS를 사용하여 비즈니스 로직 및 보안(Guard) 처리.

---

## 5. 후순위 — 직접 진행할 작업

> 코드/인프라 준비는 되어 있고, 개발자 콘솔·키 설정·콘텐츠 등 **내가 해야 할 일**만 정리한 목록.

### 5.1 소셜 로그인 설정

- [ ] **구글 로그인**: [Google Cloud Console](https://console.cloud.google.com/)에서 OAuth 2.0 클라이언트 ID 생성 → `server/.env`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback` 등록 후 서버 재시작
- [ ] **카카오 로그인**: [카카오 개발자 콘솔](https://developers.kakao.com/)에서 앱 생성, 로그인 활성화 → `server/.env`에 `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `KAKAO_CALLBACK_URL=http://localhost:4000/auth/kakao/callback` 등록 후 서버 재시작
- [ ] **네이버 로그인**: [네이버 개발자 센터](https://developer.naver.com/)에서 애플리케이션 등록, 로그인 API 사용 설정 → `server/.env`에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_CALLBACK_URL=http://localhost:4000/auth/naver/callback` 등록 후 서버 재시작

### 5.3 그 외

- [ ] Magic UI 컴포넌트 연동 (필요 시)
- [ ] 배포 시 `FRONTEND_URL`, `DATABASE_URL`, `JWT_SECRET` 등 환경 변수 설정
- [ ] 반응형 전 구간 점검 및 Admin 권한 최종 확인
