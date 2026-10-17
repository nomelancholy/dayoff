import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

export type NaverApiMode = 'sandbox' | 'production';
export class NaverApiError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
export function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new NaverApiError('INVALID_RESPONSE');
  return value as Record<string, any>;
}
export function kst(date: Date): string {
  return new Date(date.getTime() + 9 * 3600000)
    .toISOString()
    .replace('Z', '+09:00');
}
export interface ChangedOrder {
  productOrderId: string;
  lastChangedDate: string;
}
export interface ChangedPage {
  lastChangeStatuses: ChangedOrder[];
  more?: { moreFrom: string; moreSequence: string };
}
export function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
export function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
}

@Injectable()
export class NaverOrderApiClient {
  private readonly traces: Record<string, string> = {};
  traceIds(): Readonly<Record<string, string>> {
    return { ...this.traces };
  }
  private token?: { value: string; expires: number };
  private tokenRequest?: Promise<string>;
  constructor(private readonly config: ConfigService) {}
  value(key: string): string {
    return this.config.get<string>(key)?.trim() || '';
  }
  mode(): NaverApiMode {
    const mode = this.value('NAVER_ORDER_API_MODE');
    if (mode !== 'sandbox' && mode !== 'production')
      throw new NaverApiError('INVALID_API_MODE');
    return mode;
  }
  private base() {
    return this.mode() === 'sandbox'
      ? 'https://sandbox-api.pay.naver.com/npay/partner'
      : 'https://api.pay.naver.com/npay/partner';
  }
  credentialStatus() {
    return {
      clientIdConfigured: !!this.value('NAVER_ORDER_API_CLIENT_ID'),
      secretConfigured: !!this.value('NAVER_ORDER_API_CLIENT_SECRET'),
      secretFormatValid: /^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{22}$/.test(
        this.value('NAVER_ORDER_API_CLIENT_SECRET'),
      ),
    };
  }
  private async request(path: string, init: RequestInit) {
    let response: Response;
    try {
      response = await fetch(this.base() + path, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new NaverApiError('NETWORK_ERROR');
    }
    let data: Record<string, any>;
    try {
      data = object(await response.json());
    } catch {
      throw new NaverApiError('INVALID_RESPONSE');
    }
    if (!response.ok) {
      // Never include the upstream body/message, which may contain credentials or PII.
      const allowed = [
        'GW.IP_NOT_ALLOWED',
        'GW.AUTHN',
        'GW.RATE_LIMIT',
        'GW.QUOTA_LIMIT',
      ];
      throw new NaverApiError(
        allowed.includes(data.code) ? data.code : `HTTP_${response.status}`,
      );
    }
    // Retain only gateway trace headers for order reads, never tokens or payloads.
    const endpoint = path.split('?')[0];
    const trace = response.headers.get('GNCP-GW-Trace-ID');
    if (
      endpoint.startsWith('/v1/pay-order/') &&
      trace &&
      /^[A-Za-z0-9_.:-]{1,256}$/.test(trace)
    )
      this.traces[endpoint] = trace;
    return data;
  }
  private async issueToken(): Promise<string> {
    const status = this.credentialStatus();
    if (!status.clientIdConfigured || !status.secretFormatValid)
      throw new NaverApiError('INVALID_CREDENTIALS');
    const clientId = this.value('NAVER_ORDER_API_CLIENT_ID');
    const timestamp = String(Date.now());
    const hashed = await bcrypt.hash(
      `${clientId}_${timestamp}`,
      this.value('NAVER_ORDER_API_CLIENT_SECRET'),
    );
    const body = new URLSearchParams({
      client_id: clientId,
      timestamp,
      grant_type: 'client_credentials',
      type: 'SELF',
      client_secret_sign: Buffer.from(hashed).toString('base64'),
    });
    const data = await this.request('/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (
      typeof data.access_token !== 'string' ||
      !data.access_token ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0
    )
      throw new NaverApiError('INVALID_TOKEN_RESPONSE');
    this.token = {
      value: data.access_token,
      expires: Date.now() + Math.max(0, data.expires_in - 60) * 1000,
    };
    return data.access_token;
  }
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now()) return this.token.value;
    if (!this.tokenRequest)
      this.tokenRequest = this.issueToken().finally(() => {
        this.tokenRequest = undefined;
      });
    return this.tokenRequest;
  }
  private async authenticated(path: string, init: RequestInit = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.accessToken();
      try {
        return await this.request(path, {
          ...init,
          headers: { ...init.headers, Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        if (
          !(error instanceof NaverApiError) ||
          error.code !== 'GW.AUTHN' ||
          attempt
        )
          throw error;
        this.token = undefined;
      }
    }
    throw new NaverApiError('AUTHENTICATION_FAILED');
  }
  async changes(
    from: Date,
    to: Date,
    moreSequence?: string,
  ): Promise<ChangedPage> {
    if (to < from || to.getTime() - from.getTime() > 86400000)
      throw new NaverApiError('INVALID_WINDOW');
    const query = new URLSearchParams({
      lastChangedFrom: kst(from),
      lastChangedTo: kst(to),
      limitCount: '100',
    });
    if (moreSequence) query.set('moreSequence', moreSequence);
    const result = await this.authenticated(
      '/v1/pay-order/mall/product-orders/last-changed-statuses?' + query,
    );
    const data = object(result.data);
    if (
      !Array.isArray(data.lastChangeStatuses) ||
      !Number.isInteger(data.count) ||
      data.count !== data.lastChangeStatuses.length ||
      data.count > 100
    )
      throw new NaverApiError('INVALID_CHANGED_RESPONSE');
    for (const item of data.lastChangeStatuses) {
      if (
        !identifier(item?.productOrderId) ||
        !validDate(item?.lastChangedDate)
      )
        throw new NaverApiError('INVALID_CHANGED_RESPONSE');
    }
    if (
      data.more &&
      (!validDate(data.more.moreFrom) ||
        typeof data.more.moreSequence !== 'string' ||
        !data.more.moreSequence)
    )
      throw new NaverApiError('INVALID_CURSOR');
    return data as ChangedPage;
  }
  async details(ids: string[]): Promise<unknown[]> {
    if (!ids.length || ids.length > 300 || ids.some((id) => !identifier(id)))
      throw new NaverApiError('INVALID_ORDER_IDS');
    const result = await this.authenticated(
      '/v1/pay-order/mall/product-orders/query',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productOrderIds: ids }),
      },
    );
    if (!Array.isArray(result.data))
      throw new NaverApiError('INVALID_DETAIL_RESPONSE');
    const returned = result.data.map(
      (item) => item?.productOrder?.productOrderId,
    );
    if (
      returned.length !== ids.length ||
      new Set(returned).size !== ids.length ||
      returned.some((id) => !ids.includes(id))
    )
      throw new NaverApiError('MISSING_ORDER_DETAILS');
    return result.data;
  }
}
