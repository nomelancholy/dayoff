import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

// @react-email/render는 내부에서 동적 import를 사용해 Jest VM에서 실행되지 않으므로,
// 템플릿에 전달된 props를 그대로 문자열로 돌려주는 대역으로 바꿉니다.
jest.mock('@react-email/render', () => ({
  render: jest.fn((element: { props: unknown }) =>
    Promise.resolve(JSON.stringify(element.props)),
  ),
}));

describe('EmailService', () => {
  const createService = (values: Record<string, string> = {}) =>
    new EmailService(
      new ConfigService({
        RESEND_API_KEY: 'test-key',
        FRONTEND_URL: 'https://dayoff.today/',
        ...values,
      }),
    );
  const okResponse = () =>
    new Response(JSON.stringify({ id: 'mail-1' }), { status: 200 });
  const sentBody = (fetchMock: jest.SpyInstance) =>
    JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as {
      to: string[];
      subject: string;
      html: string;
      text: string;
    };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('쿠폰 지급 메일에 코드·할인·조건·한국 시간 기준 기간을 담는다', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());

    await createService().sendCouponIssuedEmail({
      to: 'member@example.com',
      name: '홍길동',
      code: 'THANKS5000',
      discountType: 'fixed',
      discountValue: 5000,
      minOrderAmount: 30000,
      validFrom: new Date('2026-10-04T15:00:00.000Z'),
      validUntil: new Date('2026-10-31T14:59:59.999Z'),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = sentBody(fetchMock);
    expect(body.to).toEqual(['member@example.com']);
    expect(body.subject).toContain('쿠폰');
    expect(body.text).toContain('THANKS5000');
    expect(body.text).toContain('₩5,000 할인');
    expect(body.text).toContain('₩30,000 이상 구매 시 사용 가능');
    expect(body.text).toContain('2026년 10월 5일 ~ 2026년 10월 31일');
    expect(body.text).toContain('https://dayoff.today/shop');
    expect(body.html).toContain('THANKS5000');
  });

  it('정률 쿠폰과 최소 주문 금액이 없는 경우를 구분해 안내한다', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());

    await createService().sendCouponIssuedEmail({
      to: 'member@example.com',
      code: 'TEN',
      discountType: 'percent',
      discountValue: 10,
      minOrderAmount: null,
      validFrom: new Date('2026-10-04T15:00:00.000Z'),
      validUntil: new Date('2026-10-31T14:59:59.999Z'),
    });

    const body = sentBody(fetchMock);
    expect(body.text).toContain('10% 할인');
    expect(body.text).toContain('최소 주문 금액 제한 없음');
    expect(body.text).toContain('고객님께');
  });

  it('API 키가 없거나 이메일을 받지 못한 소셜 계정이면 보내지 않는다', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());

    await createService({ RESEND_API_KEY: '' }).sendWelcomeEmail({
      to: 'member@example.com',
    });
    await createService().sendWelcomeEmail({ to: '12345@kakao.placeholder' });
    await createService().sendOrderShippedEmail({
      to: '',
      orderNumber: 'ORD-1',
      trackingNumber: '1234',
      items: [],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('메일 서버 오류나 네트워크 오류가 호출한 쪽으로 전파되지 않는다', async () => {
    const service = createService();
    const params = {
      to: 'member@example.com',
      orderNumber: 'ORD-1',
      total: 34000,
      items: [{ productName: '머그', quantity: 1, lineTotal: 30000 }],
    };

    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    await expect(service.sendOrderPaidEmail(params)).resolves.toBeUndefined();

    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network'));
    await expect(service.sendOrderPaidEmail(params)).resolves.toBeUndefined();
  });

  it('메일 요청에 시간 제한을 건다', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(okResponse());

    await createService().sendProductRestockedEmail({
      to: 'member@example.com',
      productName: '머그',
      productSlug: 'sand-mug',
    });

    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(
      AbortSignal,
    );
  });
});
