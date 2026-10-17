import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { NaverOrderApiClient, kst } from './naver-order-api.client';

describe('Naver order API client', () => {
  const original = global.fetch;
  const config = () =>
    new ConfigService({
      NAVER_ORDER_API_MODE: 'sandbox',
      NAVER_ORDER_API_CLIENT_ID: 'test-app',
      NAVER_ORDER_API_CLIENT_SECRET: '$2a$04$abcdefghijklmnopqrstuu',
    });
  let fetchMock: jest.Mock;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });
  afterEach(() => {
    global.fetch = original;
  });
  it('signs the token request, uses SELF and caches the token', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ access_token: 'test-token', expires_in: 10800 }),
      )
      .mockImplementation(async () =>
        json({ data: { count: 0, lastChangeStatuses: [] } }),
      );
    const api = new NaverOrderApiClient(config());
    await api.changes(new Date(0), new Date(1000));
    await api.changes(new Date(0), new Date(1000));
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('type')).toBe('SELF');
    expect(body.has('client_secret')).toBe(false);
    const hash = Buffer.from(
      body.get('client_secret_sign')!,
      'base64',
    ).toString();
    expect(
      await bcrypt.compare(`test-app_${body.get('timestamp')}`, hash),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://sandbox-api.pay.naver.com/npay/partner/v1/oauth2/token',
    );
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
      'Bearer test-token',
    );
    expect(kst(new Date('2026-10-17T00:00:00Z'))).toBe(
      '2026-10-17T09:00:00.000+09:00',
    );
  });
  it('refreshes once on GW.AUTHN and does not loop indefinitely', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ access_token: 'expired', expires_in: 10800 }),
      )
      .mockResolvedValueOnce(json({ code: 'GW.AUTHN' }, 401))
      .mockResolvedValueOnce(json({ access_token: 'fresh', expires_in: 10800 }))
      .mockResolvedValueOnce(json({ code: 'GW.AUTHN' }, 401));
    await expect(
      new NaverOrderApiClient(config()).changes(new Date(0), new Date(1000)),
    ).rejects.toThrow('GW.AUTHN');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it('does not print upstream secrets/PII and surfaces IP restriction', async () => {
    fetchMock.mockResolvedValue(
      json({ code: 'GW.IP_NOT_ALLOWED', message: 'private-data' }, 403),
    );
    await expect(
      new NaverOrderApiClient(config()).changes(new Date(0), new Date(1000)),
    ).rejects.toThrow(/^GW.IP_NOT_ALLOWED$/);
  });
  it('rejects missing detail rows instead of moving the cursor', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'token', expires_in: 10800 }))
      .mockResolvedValueOnce(json({ data: [] }));
    await expect(
      new NaverOrderApiClient(config()).details(['123']),
    ).rejects.toThrow('MISSING_ORDER_DETAILS');
  });
  it('fails closed for an unknown mode', async () => {
    const c = config();
    c.set('NAVER_ORDER_API_MODE', 'test');
    await expect(
      new NaverOrderApiClient(c).changes(new Date(0), new Date(1000)),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
