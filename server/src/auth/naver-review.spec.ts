import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AuthService, type UserRow } from './auth.service';
import { AuthController } from './auth.controller';
import { NaverReviewController } from './naver-review.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DRIZZLE } from '../common/database/database.module';
import { EmailService } from '../common/email/email.service';
import { NaverOrderClient } from '../shop/naver-order.client';

describe('검수 전용 로그인', () => {
  let app: INestApplication;
  let config: ConfigService;
  let user: UserRow;
  let jwt: JwtService;
  let client: NaverOrderClient;
  const emailService = { sendWelcomeEmail: jest.fn() };

  beforeEach(async () => {
    user = {
      id: '10b821e3-bbe5-4485-a1fe-dd7b15831e2a',
      email: 'npay_test@dayoff.invalid',
      password: await bcrypt.hash('test-password-only', 4),
      provider: 'email',
      providerId: null,
      role: 'member',
      fullName: '네이버페이 검수',
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    config = new ConfigService({
      // 운영 사이트에서도 네이버페이 테스트 모드 + 검수 권한으로 로그인 가능해야 합니다.
      NODE_ENV: 'production',
      JWT_SECRET: 'isolated-review-test-secret',
      NAVER_REVIEW_LOGIN_ENABLED: 'true',
      NAVER_REVIEW_USER_ID: user.id,
      NAVER_REVIEW_LOGIN_ID: 'npay_test',
      NAVER_ORDER_AUDIENCE: 'review',
      NAVER_ORDER_MODE: 'test',
      NAVER_ORDER_ENABLED: 'true',
      NAVER_ORDER_REVIEW_USER_IDS: '',
      NAVER_ORDER_MERCHANT_ID: 'merchant',
      NAVER_ORDER_CERTI_KEY: 'private',
      NAVER_ORDER_BUTTON_KEY: 'button',
      NAVER_ORDER_ACCOUNT_ID: 'account',
      FRONTEND_URL: 'https://dayoff.today',
    });
    const module = await Test.createTestingModule({
      controllers: [NaverReviewController, AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        JwtService,
        NaverOrderClient,
        { provide: ConfigService, useValue: config },
        { provide: DRIZZLE, useValue: {} },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();
    jest
      .spyOn(module.get(AuthService), 'findById')
      .mockImplementation(async (id) => (id === user.id ? user : undefined));
    client = module.get(NaverOrderClient);
    jwt = module.get(JwtService);
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  const login = () =>
    request(app.getHttpServer()).post('/auth/npay-review/login');
  const credentials = {
    identifier: 'npay_test',
    password: 'test-password-only',
  };
  const me = (token: string) =>
    request(app.getHttpServer())
      .get('/auth/me')
      .auth(token, { type: 'bearer' });

  it('아이디·이메일 모두 로그인하고 일반 회원 세션으로 전체 상품 검수 권한을 얻는다', async () => {
    for (const identifier of ['npay_test', 'npay_test@dayoff.invalid']) {
      const result = await login()
        .send({ ...credentials, identifier })
        .expect(200);
      expect(result.headers['cache-control']).toBe('no-store');
      expect(result.body.user.role).toBe('member');
      expect(result.body).not.toHaveProperty('password');
      await me(result.body.access_token).expect(200);
      const claims = jwt.decode<{
        exp: number;
        iat: number;
        npayReview: string;
      }>(result.body.access_token);
      expect(claims.exp - claims.iat).toBe(4 * 3600);
      expect(claims.npayReview).toHaveLength(64);
    }
    expect(client.publicConfig(user.id).enabled).toBe(true);
    expect(client.publicConfig()).toEqual({ enabled: false });
    expect(client.publicConfig('ordinary-user')).toEqual({ enabled: false });
    expect(emailService.sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('잘못된 비밀번호와 일반 회원 식별자를 거부한다', async () => {
    for (const body of [
      { ...credentials, password: 'wrong' },
      { ...credentials, identifier: 'ordinary@example.com' },
    ])
      await login().send(body).expect(401);
    await login()
      .send({ ...credentials, role: 'admin' })
      .expect(400);
    await login()
      .send({ ...credentials, password: 'a'.repeat(73) })
      .expect(400);
  });

  it.each(['admin', 'social'])(
    '관리자 및 소셜 계정을 검수 로그인으로 사용할 수 없다: %s',
    async (type) => {
      if (type === 'admin') user.role = 'admin';
      else user.provider = 'naver';
      await login().send(credentials).expect(401);
    },
  );

  it.each([
    ['NAVER_REVIEW_LOGIN_ENABLED', 'false'],
    ['NAVER_ORDER_MODE', 'production'],
    ['NAVER_ORDER_AUDIENCE', 'public'],
    ['NAVER_REVIEW_USER_ID', ''],
  ])(
    '검수 설정 변경은 새 로그인과 기존 세션을 모두 차단한다: %s',
    async (key, value) => {
      const result = await login().send(credentials).expect(200);
      config.set(key, value);
      await login().send(credentials).expect(403);
      await me(result.body.access_token).expect(401);
      expect(client.publicConfig(user.id)).toEqual({ enabled: false });
    },
  );

  it('비밀번호 교체와 권한 변경 시 기존 검수 토큰을 무효화한다', async () => {
    const result = await login().send(credentials).expect(200);
    const original = user.password;
    user.password = await bcrypt.hash('new-password', 4);
    await me(result.body.access_token).expect(401);
    user.password = original;
    user.role = 'admin';
    await me(result.body.access_token).expect(401);
  });

  it('검수 표시가 없는 토큰·다른 사용자 토큰·만료·위조 토큰은 검수 세션이 될 수 없다', async () => {
    const result = await login().send(credentials).expect(200);
    const claims = jwt.decode<{ npayReview: string }>(result.body.access_token);
    for (const token of [
      jwt.sign({ sub: user.id }, { secret: 'isolated-review-test-secret' }),
      jwt.sign(
        { sub: 'missing-user', npayReview: claims.npayReview },
        { secret: 'isolated-review-test-secret' },
      ),
      jwt.sign(
        { sub: user.id, npayReview: claims.npayReview },
        { secret: 'isolated-review-test-secret', expiresIn: -1 },
      ),
      jwt.sign(
        { sub: user.id, npayReview: claims.npayReview },
        { secret: 'wrong-secret' },
      ),
    ])
      await me(token).expect(401);
  });

  it('반복 비밀번호 추측을 제한한다', async () => {
    for (let i = 0; i < 10; i++)
      await login()
        .send({ ...credentials, password: 'wrong' })
        .expect(401);
    await login().send(credentials).expect(429);
  });
});
