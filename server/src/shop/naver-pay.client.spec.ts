import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NaverPayClient } from './naver-pay.client';

describe('NaverPayClient', () => {
  const values: Record<string, string> = {
    NODE_ENV: 'test',
    NAVER_PAY_ENABLED: 'true',
    NAVER_PAY_MODE: 'development',
    NAVER_PAY_CLIENT_ID: 'client-id',
    NAVER_PAY_CLIENT_SECRET: 'client-secret',
    NAVER_PAY_CHAIN_ID: 'chain-id',
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  const client = new NaverPayClient(config);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the official approval endpoint and validates a success response', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'Success',
          body: {
            detail: {
              paymentId: 'payment-1',
              merchantPayKey: 'order-1',
              merchantUserKey: 'user-1',
              totalPayAmount: 10_000,
              taxScopeAmount: 10_000,
              taxExScopeAmount: 0,
              admissionTypeCode: '01',
              admissionState: 'SUCCESS',
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const detail = await client.approvePayment('payment-1');

    expect(detail.merchantPayKey).toBe('order-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://dev-pay.paygate.naver.com/naverpay-partner/naverpay/payments/v2.2/apply/payment',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-NaverPay-Idempotency-Key': 'apply-payment-1',
        }),
      }),
    );
  });

  it('accepts a replayed successful idempotency response with HTTP 409', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'Success',
          body: { detail: { paymentId: 'payment-1' } },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(client.approvePayment('payment-1')).resolves.toEqual(
      expect.objectContaining({ paymentId: 'payment-1' }),
    );
  });

  it('sends a guarded, idempotent full cancellation request', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'Success', body: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await client.cancelPayment({
      paymentId: 'payment-1',
      amount: 10_000,
      reason: '고객 요청',
      requester: '1',
      idempotencyKey: 'cancel-order-1',
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toEqual(
      expect.objectContaining({
        'X-NaverPay-Idempotency-Key': 'cancel-order-1',
      }),
    );
    expect(typeof init.body).toBe('string');
    const body = typeof init.body === 'string' ? init.body : '';
    expect(body).toContain('doCompareRest=1');
    expect(body).toContain('expectedRestAmount=0');
  });

  it('surfaces Naver Pay rejection codes', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'InvalidMerchant' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(client.approvePayment('payment-1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('requires an explicit Naver Pay mode in production', () => {
    const productionConfig = {
      get: (key: string) =>
        key === 'NODE_ENV'
          ? 'production'
          : key === 'NAVER_PAY_ENABLED'
            ? 'true'
            : key === 'NAVER_PAY_CLIENT_ID' || key === 'NAVER_PAY_CHAIN_ID'
              ? 'configured'
              : undefined,
    } as ConfigService;

    expect(() =>
      new NaverPayClient(productionConfig).getCheckoutConfig(),
    ).toThrow(BadRequestException);
  });

  it('does not expose credentials in its configuration status', () => {
    expect(client.getConfigurationStatus()).toEqual({
      enabled: true,
      mode: 'development',
      configured: true,
      missingKeys: [],
    });
  });

  it('blocks payment requests while the feature is disabled', () => {
    const disabledConfig = {
      get: (key: string) =>
        key === 'NAVER_PAY_ENABLED' ? 'false' : values[key],
    } as ConfigService;

    expect(() =>
      new NaverPayClient(disabledConfig).getCheckoutConfig(),
    ).toThrow(BadRequestException);
  });

  it('still permits refunds for existing orders while new payments are disabled', async () => {
    const disabledConfig = {
      get: (key: string) =>
        key === 'NAVER_PAY_ENABLED' ? 'false' : values[key],
    } as ConfigService;
    const disabledClient = new NaverPayClient(disabledConfig);
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'Success', body: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      disabledClient.cancelPayment({
        paymentId: 'payment-1',
        amount: 10_000,
        reason: '고객 요청',
        requester: '1',
        idempotencyKey: 'cancel-order-1',
      }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
