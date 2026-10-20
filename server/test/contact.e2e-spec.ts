import { ConfigModule, ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/app.setup';
import { ContactModule } from '../src/contact/contact.module';

const PATH = '/api/contact/inquiries';
const CONFIG = {
  CONTACT_ENABLED: 'true',
  CONTACT_TO_EMAIL: 'owner@example.com',
  RESEND_API_KEY: 'test-key',
  RESEND_FROM_EMAIL: '디오티 <contact@example.com>',
  RESEND_REPLY_TO: 'default@example.com',
};
const DATA = {
  name: ' 문의자 ',
  email: ' visitor@example.com ',
  category: '상품 문의',
  subject: ' 제품 문의 ',
  message: '안녕하세요.\n<script>alert("test")</script>',
  privacyConsent: 'true',
};
const PDF = Buffer.from('%PDF-1.7\nContact test');

describe('CONTACT 문의 접수 (외부 메일·DB 호출 없음)', () => {
  let app: NestExpressApplication;
  let config: ConfigService;
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(async () => {
    global.fetch = fetchMock as typeof fetch;
    fetchMock.mockReset().mockResolvedValue({ ok: true });
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    config = new ConfigService({ ...CONFIG });
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ContactModule,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(config)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
  });

  afterEach(async () => {
    await app.close();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const submit = (data = DATA) => {
    let call = request(app.getHttpServer()).post(PATH);
    for (const [key, value] of Object.entries(data))
      call = call.field(key, value);
    return call;
  };

  it('문의 내용을 운영자에게 보내고 문의자 주소로 답장할 수 있다', async () => {
    await submit().expect(200, { success: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(url).toBe('https://api.resend.com/emails');
    const mail = JSON.parse(options.body) as { html: string; text: string };
    expect(mail).toEqual(
      expect.objectContaining({
        to: ['owner@example.com'],
        from: CONFIG.RESEND_FROM_EMAIL,
        reply_to: 'visitor@example.com',
        subject: '[디오티 문의] [상품 문의] 제품 문의',
      }),
    );
    expect(mail.text).toContain('성함: 문의자');
    expect(mail.text).toContain(DATA.message);
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('새 문의가 도착했습니다');
    expect(mail.html).toContain('문의자에게 답장하기');
    expect(mail.html).toContain('문의 유형 · 상품 문의');
    expect(mail.html).toContain('mailto:visitor@example.com?subject=Re%3A%20');
    expect(mail.html).toContain('안녕하세요.<br/>');
    expect(mail.text).toContain('접수일시:');
    expect(mail.html).not.toContain('첨부파일 1개');
  });

  it('선택한 파일을 공개 업로드 저장소 없이 메일에 첨부한다', async () => {
    await submit()
      .attach('attachment', PDF, {
        filename: 'reference.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);
    const mail = JSON.parse(fetchMock.mock.calls[0][1].body) as {
      attachments: unknown;
      html: string;
    };
    expect(mail.attachments).toEqual([
      { filename: 'reference.pdf', content: PDF.toString('base64') },
    ]);
    expect(mail.html).toContain('첨부파일 1개');
    expect(mail.html).toContain('reference.pdf');
  });

  it.each([
    ['name', '   '],
    ['email', 'invalid'],
    ['category', '임의 분류'],
    ['subject', '제목\n위조'],
    ['message', '   '],
    ['message', 'x'.repeat(5001)],
    ['privacyConsent', 'false'],
  ])('%s 값이 올바르지 않으면 발송하지 않는다', async (field, value) => {
    await submit({ ...DATA, [field]: value }).expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('수신자 변경 같은 허용되지 않은 필드는 거부한다', async () => {
    await submit().field('to', 'other@example.com').expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('이미지·PDF로 위장한 파일은 발송하지 않는다', async () => {
    await submit()
      .attach('attachment', Buffer.from('<html>invalid</html>'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('허용되지 않은 확장자 파일을 거부한다', async () => {
    await submit()
      .attach('attachment', PDF, {
        filename: 'file.html',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('5MB를 초과한 파일을 거부한다', async () => {
    await submit()
      .attach('attachment', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'large.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('2개 이상의 첨부파일을 거부한다', async () => {
    await submit()
      .attach('attachment', PDF, 'one.pdf')
      .attach('attachment', PDF, 'two.pdf')
      .expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['CONTACT_TO_EMAIL', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL'])(
    '%s 미설정을 성공으로 표시하지 않는다',
    async (key) => {
      config.set(key, '');
      await submit().expect(503);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('기본 비활성 상태에서는 문의를 발송하지 않는다', async () => {
    config.set('CONTACT_ENABLED', 'false');
    await submit().expect(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Resend 오류를 접수 성공으로 표시하지 않는다', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'test provider failure',
    });
    const response = await submit().expect(503);
    expect(response.body.message).toContain('문의 전송에 실패했습니다');
    expect(response.body.message).not.toContain('test provider failure');
  });

  it('네트워크·타임아웃 오류를 접수 성공으로 표시하지 않는다', async () => {
    fetchMock.mockRejectedValue(new Error('Timeout'));
    await submit().expect(503);
  });

  it('봇 필드가 채워진 문의는 이메일을 보내지 않는다', async () => {
    await submit().field('website', 'https://spam.example').expect(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('동일 IP에서 10분 내 6번째 요청은 차단한다', async () => {
    for (let index = 0; index < 5; index += 1) await submit().expect(200);
    await submit().expect(429);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
