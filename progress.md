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

### 1.4 상태 관리 & 데이터
- [x] Zustand 설치, `app/common/store` 구조 (`store/ui.ts`, `store/index.ts`)
- [x] Tanstack Query 설치 및 QueryClient 설정 (`app/common/lib/queryClient.ts`, `QueryClientProvider` in `main.tsx`)
- [x] Supabase 프로젝트 생성/연결, 환경 변수 설정 (`app/common/lib/supabase.ts`, `.env.example`)
- [x] Drizzle ORM 설치, 스키마·마이그레이션 폴더 구성 (`app/db/schema/`, `app/db/migrations/`, `drizzle.config.ts`)
- [x] 타입 사용 원칙: Drizzle 스키마 추론 타입 / Supabase Generated Types (`app/db/README.md` 참고)

### 1.5 인증
- [ ] Supabase Auth 설정 (이메일, 카카오, 구글, 애플)
- [ ] Auth Context/Provider 구현, RLS 연동 시 전달 확인

### 1.6 개발 환경
- [x] ESLint/Prettier 설정 (선택) — Prettier + `eslint-config-prettier`, `npm run format`
- [x] `spec.md` Data Structure 기반 Drizzle 스키마 초안 — feature별 `schema/` (auth, shop, order, coupon, class, contact)

---

## 2. 작업 진행 계획 (기능 단위)

### 2.1 공통 UI & 레이아웃
- [ ] **Header**: `_reference_ui` 네비게이션, 로고, 장바구니/유저 링크 반영
- [ ] **Footer**: 로고, 저작권 문구
- [ ] **Layout**: 위 컴포넌트로 Outlet 감싸기, 반응형 (`md:`, `lg:`)
- [ ] 공통 스타일(글레이즈 오버레이, 폰트 등) Tailwind로 이식

### 2.2 메인 페이지 (Home)
- [ ] Hero 섹션 (이미지, 타이틀, 스크롤 인디케이터)
- [ ] About 미리보기
- [ ] Shop 상품 그리드 미리보기 → 상세/장바구니 링크

### 2.3 About 페이지
- [ ] `_reference_ui/about.html` 기반 레이아웃·콘텐츠
- [ ] 이미지, 텍스트, 갤러리 섹션 컴포넌트화

### 2.4 Shop (쇼핑)
- [ ] 상품 목록 페이지: 그리드, 카테고리 필터 (컵/그릇/소품 등)
- [ ] 상품 상세 페이지: 이미지, 옵션, 수량, 장바구니 담기 / 바로 구매
- [ ] 장바구니 페이지: 수량 변경, 삭제, 주문 요약
- [ ] **Admin 전용**: 상품 등록/수정/삭제 (권한 체크)

### 2.5 Class (원데이 클래스)
- [ ] 클래스 소개 페이지: 물레 / 컬러 클레이 / 자유 원데이
- [ ] 네이버 예약 링크 연동 또는 자체 예약 플로우 (선택)

### 2.6 Contact
- [ ] 연락처 정보: 이메일, 인스타, 블로그
- [ ] 지도 표시 (카카오맵/구글맵 등)
- [ ] 찾아오는 길: 충무로역 7번 / 을지로3가 8번 탭·단계별 안내

### 2.7 회원 (Auth & Account)
- [ ] 로그인/회원가입: 이메일 + 소셜(카카오, 구글, 애플)
- [ ] 내 정보 페이지: 프로필 수정, 주문 내역, 주소록 (`_reference_ui/account.html`)
- [ ] 로그아웃

### 2.8 쿠폰 (회원 할인)
- [ ] 쿠폰 테이블/스키마 설계 (코드, 할인 타입·값, 유효기간 등)
- [ ] 회원-쿠폰 연동 (발급/사용 내역)
- [ ] 장바구니/결제 단계에서 쿠폰 적용 UI & 로직

### 2.9 결제 (선택)
- [ ] 결제 연동 (토스, 스트라이프 등) 또는 “결제 페이지 예정” 플레이스홀더

### 2.10 마무리
- [ ] 반응형 전 구간 점검
- [ ] RLS 및 권한(일반/Admin) 최종 확인
- [ ] 배포 설정 (Vercel/Netlify 등)

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
│   ├── lib/             # utils.ts, supabase
│   └── store/           # Zustand
├── features/
│   ├── home/
│   │   └── page/
│   │       └── Page.tsx
│   ├── about/
│   │   └── page/
│   │       └── Page.tsx
│   ├── shop/
│   │   └── page/
│   │       └── Page.tsx
│   ├── class/
│   ├── contact/
│   ├── cart/
│   ├── account/
│   └── ...
├── router.tsx           # React-Router 라우트 설정
public/
_reference_ui/
```

---

## 4. 참고 사항
- **DB 쿼리**: Drizzle ORM 사용, Supabase Client 직접 호출 지양.
- **데이터 페칭**: Tanstack Query `useQuery` / `useMutation` 내에서 Drizzle 활용.
- **컴포넌트**: 함수형, Named Export, `props` 인터페이스 명시.
- **Shadcn 추가**: `npx shadcn@latest add [component]` 사용.
- **spec.md** Data Structure 섹션이 정리되면 Drizzle 스키마와 RLS 정책을 본격 설계.
