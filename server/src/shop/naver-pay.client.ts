import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type NaverPayMode = 'development' | 'production';

interface NaverPayResponse<T> {
  code?: string;
  message?: string;
  body?: T;
}

export interface NaverPayApprovalDetail {
  paymentId?: string;
  payHistId?: string;
  merchantPayKey?: string;
  merchantUserKey?: string;
  totalPayAmount?: number;
  taxScopeAmount?: number;
  taxExScopeAmount?: number;
  productName?: string;
  admissionTypeCode?: string;
  admissionState?: string;
}

interface NaverPayApprovalBody {
  paymentId?: string;
  detail?: NaverPayApprovalDetail;
}

interface NaverPayHistoryBody {
  list?: Array<{
    paymentId?: string;
    merchantPayKey?: string;
    admissionState?: string;
    admissionTypeCode?: string;
  }>;
  totalPageCount?: number;
}

@Injectable()
export class NaverPayClient {
  // 공식 문서가 최소 60초를 요구하므로 네트워크 여유를 포함한다.
  private static readonly REQUEST_TIMEOUT_MS = 65_000;

  constructor(private readonly configService: ConfigService) {}

  private env(key: string): string | undefined {
    const value = this.configService.get<string>(key)?.trim();
    return value || undefined;
  }

  isEnabled(): boolean {
    return this.env('NAVER_PAY_ENABLED') === 'true';
  }

  getConfigurationStatus() {
    const credentialKeys = [
      'NAVER_PAY_CLIENT_ID',
      'NAVER_PAY_CLIENT_SECRET',
      'NAVER_PAY_CHAIN_ID',
    ];
    const missingKeys = credentialKeys.filter((key) => !this.env(key));
    const configuredMode = this.env('NAVER_PAY_MODE');
    const mode =
      configuredMode === 'development' || configuredMode === 'production'
        ? configuredMode
        : null;
    if (!mode) missingKeys.push('NAVER_PAY_MODE');

    return {
      enabled: this.isEnabled(),
      mode,
      configured: missingKeys.length === 0,
      missingKeys,
    };
  }

  private assertEnabled() {
    if (!this.isEnabled()) {
      throw new BadRequestException('네이버페이 결제가 비활성화되어 있습니다.');
    }
  }

  getMode(): NaverPayMode {
    const configured = this.env('NAVER_PAY_MODE');
    if (configured === 'development' || configured === 'production') {
      return configured;
    }

    if (this.env('NODE_ENV') === 'production') {
      throw new BadRequestException(
        '운영 서버에는 NAVER_PAY_MODE=production 설정이 필요합니다.',
      );
    }
    return 'development';
  }

  getCheckoutConfig() {
    this.assertEnabled();
    const clientId = this.env('NAVER_PAY_CLIENT_ID');
    const chainId = this.env('NAVER_PAY_CHAIN_ID');
    if (!clientId || !chainId) {
      throw new BadRequestException(
        '서버 환경설정에 NAVER_PAY_CLIENT_ID/NAVER_PAY_CHAIN_ID가 필요합니다.',
      );
    }
    return { mode: this.getMode(), clientId, chainId };
  }

  private getApiBaseUrl(): string {
    return this.getMode() === 'production'
      ? 'https://pay.paygate.naver.com'
      : 'https://dev-pay.paygate.naver.com';
  }

  private getHeaders(extra?: Record<string, string>) {
    const clientId = this.env('NAVER_PAY_CLIENT_ID');
    const clientSecret = this.env('NAVER_PAY_CLIENT_SECRET');
    const chainId = this.env('NAVER_PAY_CHAIN_ID');
    if (!clientId || !clientSecret || !chainId) {
      throw new BadRequestException(
        '서버 환경설정에 NAVER_PAY_CLIENT_ID/NAVER_PAY_CLIENT_SECRET/NAVER_PAY_CHAIN_ID가 필요합니다.',
      );
    }
    return {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
      'X-NaverPay-Chain-Id': chainId,
      ...extra,
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit,
  ): Promise<{ response: Response; data: NaverPayResponse<T> }> {
    let response: Response;
    try {
      response = await fetch(`${this.getApiBaseUrl()}${path}`, {
        ...init,
        signal: AbortSignal.timeout(NaverPayClient.REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new GatewayTimeoutException(
          '네이버페이 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
        );
      }
      throw new BadGatewayException(
        '네이버페이 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }

    let data: NaverPayResponse<T>;
    try {
      data = (await response.json()) as NaverPayResponse<T>;
    } catch {
      throw new BadGatewayException(
        '네이버페이에서 올바르지 않은 응답을 반환했습니다.',
      );
    }
    return { response, data };
  }

  private apiError(action: string, data: NaverPayResponse<unknown>) {
    const detail = [data.code, data.message].filter(Boolean).join(': ');
    return new BadGatewayException(
      `${action}에 실패했습니다.${detail ? ` ${detail}` : ''}`,
    );
  }

  async approvePayment(paymentId: string): Promise<NaverPayApprovalDetail> {
    const form = new URLSearchParams({ paymentId });
    const { response, data } = await this.request<NaverPayApprovalBody>(
      '/naverpay-partner/naverpay/payments/v2.2/apply/payment',
      {
        method: 'POST',
        headers: this.getHeaders({
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-NaverPay-Idempotency-Key': `apply-${paymentId}`.slice(0, 64),
        }),
        body: form.toString(),
      },
    );

    // 멱등성 재요청은 HTTP 409로 이전 성공 응답이 다시 전달될 수 있다.
    if (data.code !== 'Success' || (!response.ok && response.status !== 409)) {
      throw this.apiError('네이버페이 결제 승인', data);
    }
    if (!data.body?.detail) {
      throw new BadGatewayException(
        '네이버페이 결제 승인 상세정보가 없습니다.',
      );
    }
    return data.body.detail;
  }

  async cancelPayment(params: {
    paymentId: string;
    amount: number;
    reason: string;
    requester: '1' | '2';
    idempotencyKey: string;
  }): Promise<void> {
    const form = new URLSearchParams({
      paymentId: params.paymentId,
      cancelAmount: String(params.amount),
      cancelReason: params.reason,
      cancelRequester: params.requester,
      taxScopeAmount: String(params.amount),
      taxExScopeAmount: '0',
      doCompareRest: '1',
      expectedRestAmount: '0',
    });
    const { response, data } = await this.request<unknown>(
      '/naverpay-partner/naverpay/payments/v1/cancel',
      {
        method: 'POST',
        headers: this.getHeaders({
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-NaverPay-Idempotency-Key': params.idempotencyKey.slice(0, 64),
        }),
        body: form.toString(),
      },
    );

    // CancelNotComplete는 네이버페이가 자동 재처리하므로 가맹점은 취소로 처리해야 한다.
    const acceptedCodes = ['Success', 'CancelNotComplete', 'AlreadyCanceled'];
    if (
      !acceptedCodes.includes(data.code ?? '') ||
      (!response.ok && response.status !== 409)
    ) {
      throw this.apiError('네이버페이 결제 취소', data);
    }
  }

  /** paymentId 저장 기능 도입 전 주문을 취소하기 위한 호환 경로입니다. */
  async findPaymentIdByMerchantPayKey(
    merchantPayKey: string,
    orderCreatedAt: Date,
  ): Promise<string | null> {
    const now = new Date();
    const oldest = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start = orderCreatedAt > oldest ? orderCreatedAt : oldest;

    for (let pageNumber = 1; pageNumber <= 20; pageNumber += 1) {
      const { response, data } = await this.request<NaverPayHistoryBody>(
        '/naverpay-partner/naverpay/payments/v2.3/list/history',
        {
          method: 'POST',
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            startTime: this.formatKst(start),
            endTime: this.formatKst(now),
            approvalType: 'APPROVAL',
            pageNumber,
            rowsPerPage: 100,
          }),
        },
      );
      if (!response.ok || data.code !== 'Success') {
        throw this.apiError('네이버페이 결제 조회', data);
      }
      const match = data.body?.list?.find(
        (item) =>
          item.merchantPayKey === merchantPayKey &&
          item.admissionState === 'SUCCESS' &&
          item.admissionTypeCode === '01',
      );
      if (match?.paymentId) return match.paymentId;

      const totalPages = data.body?.totalPageCount ?? 1;
      if (pageNumber >= totalPages) break;
    }
    return null;
  }

  private formatKst(date: Date): string {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(
      kst.getUTCDate(),
    )}${pad(kst.getUTCHours())}${pad(kst.getUTCMinutes())}${pad(
      kst.getUTCSeconds(),
    )}`;
  }
}
