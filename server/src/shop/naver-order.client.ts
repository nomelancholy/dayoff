import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { naverReviewEnabled } from '../auth/naver-review.config';

@Injectable()
export class NaverOrderClient {
  constructor(private readonly config: ConfigService) {}

  value(key: string) {
    return this.config.get<string>(key)?.trim() || '';
  }

  private reviewUserIds() {
    const ids = this.value('NAVER_ORDER_REVIEW_USER_IDS')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (naverReviewEnabled(this.config))
      ids.push(this.value('NAVER_REVIEW_USER_ID'));
    return [...new Set(ids)];
  }

  canAccess(userId?: string): boolean {
    const audience = this.value('NAVER_ORDER_AUDIENCE') || 'review';
    if (audience === 'review')
      return !!userId && this.reviewUserIds().includes(userId);
    // 테스트 환경을 실수로 전체 공개하지 않으며, 미지의 설정값은 차단합니다.
    return (
      audience === 'public' &&
      this.value('NAVER_ORDER_MODE') === 'production' &&
      this.value('NAVER_ORDER_PRODUCTION_READY') === 'true'
    );
  }

  assertAccess(userId?: string) {
    this.assertEnabled();
    if (!this.canAccess(userId))
      throw new ForbiddenException(
        '현재 네이버페이 구매를 이용할 수 없습니다.',
      );
  }

  getStatus() {
    const mode = this.value('NAVER_ORDER_MODE');
    const required = [
      'NAVER_ORDER_MERCHANT_ID',
      'NAVER_ORDER_CERTI_KEY',
      'NAVER_ORDER_BUTTON_KEY',
      'NAVER_ORDER_ACCOUNT_ID',
      'FRONTEND_URL',
    ];
    const missingKeys = required.filter((key) => !this.value(key));
    if (!['test', 'production'].includes(mode))
      missingKeys.push('NAVER_ORDER_MODE');
    let originValid = false;
    try {
      const u = new URL(this.value('FRONTEND_URL'));
      originValid = u.protocol === 'https:' && !u.username && !u.password;
    } catch {
      /* incomplete setup */
    }
    const productionReady =
      this.value('NAVER_ORDER_PRODUCTION_READY') === 'true';
    return {
      provider: 'naver-order',
      audience: this.value('NAVER_ORDER_AUDIENCE') || 'review',
      reviewAccountCount: this.reviewUserIds().length,
      mode,
      configured: !missingKeys.length && originValid,
      missingKeys,
      originValid,
      productionReady,
      enabled:
        this.value('NAVER_ORDER_ENABLED') === 'true' &&
        !missingKeys.length &&
        originValid &&
        (mode === 'test' || productionReady),
    };
  }

  publicConfig(userId?: string) {
    const status = this.getStatus();
    if (!status.enabled || !this.canAccess(userId))
      return { enabled: false as const };
    return {
      enabled: true as const,
      buttonKey: this.value('NAVER_ORDER_BUTTON_KEY'),
      accountId: this.value('NAVER_ORDER_ACCOUNT_ID'),
      origin: new URL(this.value('FRONTEND_URL')).origin,
      orderHistoryUrl:
        status.mode === 'production'
          ? 'https://pay.naver.com'
          : 'https://test-pay.naver.com',
      sdkUrl:
        status.mode === 'production'
          ? 'https://npay-order.pstatic.net/assets/button/latest/npay.button.js'
          : 'https://test-pay.naver.com/assets/button/latest/npay.button.js',
    };
  }

  assertEnabled() {
    if (!this.getStatus().enabled)
      throw new ServiceUnavailableException('네이버페이 주문을 준비 중입니다.');
  }

  async register(xml: string) {
    this.assertEnabled();
    const host =
      this.value('NAVER_ORDER_MODE') === 'production'
        ? 'api.pay.naver.com'
        : 'test-api.pay.naver.com';
    let response: Response;
    let body: string;
    try {
      response = await fetch(
        `https://${host}/o/customer/api/order/v20/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/xml; charset=utf-8' },
          body: xml,
          signal: AbortSignal.timeout(15_000),
          redirect: 'error',
        },
      );
      body = (await response.text()).trim();
    } catch {
      throw new BadGatewayException(
        '네이버페이 주문서에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
    // 원문 응답이나 인증키가 포함된 XML을 로그/클라이언트 오류에 노출하지 않습니다.
    // 공식 PDF의 19자 설명과 달리 실제 테스트 API는 22자 base64url 형식(-, _ 포함)의 키도 반환합니다.
    // 키는 불투명한 식별자로 취급하며 길이 확장을 허용하되 구분자/제어문자는 거부합니다.
    const match = /^SUCCESS:([a-zA-Z0-9_-]{1,128}):([0-9]+)$/.exec(body);
    if (!response.ok || !match)
      throw new BadGatewayException(
        '네이버페이 주문서를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    return { key: match[1], merchantNo: match[2] };
  }
}
