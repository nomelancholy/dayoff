/**
 * e2e 테스트가 실제 외부 서비스(메일, 결제, 이미지 저장소)나 개발 DB에 닿지 않도록
 * 앱 모듈을 불러오기 전에 환경변수를 고정합니다. (.env 값보다 process.env가 우선합니다.)
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'e2e-test-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.RESEND_API_KEY = '';
process.env.SPACES_ENABLED = 'false';
process.env.SPACES_ACCESS_KEY_ID = '';
process.env.SPACES_SECRET_ACCESS_KEY = '';
process.env.NAVER_PAY_ENABLED = 'true';
process.env.NAVER_PAY_MODE = 'development';
process.env.NAVER_PAY_CLIENT_ID = 'e2e-client-id';
process.env.NAVER_PAY_CLIENT_SECRET = 'e2e-client-secret';
process.env.NAVER_PAY_CHAIN_ID = 'e2e-chain-id';
// 실수로 실제 DatabaseModule 팩토리가 호출되더라도 테스트 DB만 바라보게 합니다.
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://invalid:invalid@127.0.0.1:1/x';
