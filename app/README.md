# Dayoff Client (Vite + React)

디오티(DIOTI) 서비스 프론트엔드 애플리케이션입니다.  
Vite + React + TypeScript 기반이며, 백엔드(NestJS) API와 통신합니다.

## 기술 스택

- React 19
- Vite 7
- TypeScript
- React Router
- TanStack Query
- Zustand
- Tailwind CSS

## 디렉터리 구조

`app` 폴더는 기능 단위(feature-sliced)로 구성됩니다.

- `app/common`: 공용 컴포넌트/훅/유틸/스토어
- `app/features`: 도메인 기능별 UI, API, 타입
- `app/db`: 프론트 문맥의 DB 관련 문서

## 요구 사항

- Node.js 20+
- npm

## 시작하기

프로젝트 루트에서 실행합니다.

```bash
cd "/Volumes/sub ssd/dev/dayoff"
npm install
```

## 실행

```bash
# 개발 서버
npm run dev

# 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

기본 개발 주소:

- `http://localhost:5173`

## API 연동

- 공통 API 클라이언트: `app/common/lib/apiClient`
- API 기준 주소 처리: `app/common/lib/viteApiBaseUrl`
- 인증 토큰은 로컬 스토리지(`auth_token`)를 사용합니다.

## 주요 기능

- 회원가입/로그인/소셜 로그인
- 장바구니, 결제, 주문 내역
- 주문 취소(발송 전)
- 리뷰 작성/수정/삭제
- 관리자 페이지(상품/주문/쿠폰/유저)

## 품질 관리

```bash
npm run lint
npm run format
```

## 배포

클라이언트 정적 빌드는 루트 배포 설정을 따릅니다.

- 웹 이미지 빌드: `deploy/Dockerfile.web`
- Nginx 설정: `deploy/nginx.prod.conf`
- 통합 배포: `docker-compose.prod.yml`
