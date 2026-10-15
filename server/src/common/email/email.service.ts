import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CouponIssuedEmail,
  OrderPaidEmail,
  ProductRestockedEmail,
  OrderShippedEmail,
  WelcomeEmail,
} from './email.templates';

type OrderMailItem = {
  productName: string;
  quantity: number;
  lineTotal: number;
  optionLabel?: string | null;
};

type MailContent = { subject: string; html: string; text: string };

const KST_DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

@Injectable()
export class EmailService {
  private static readonly REQUEST_TIMEOUT_MS = 10_000;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  private get frontendUrl(): string {
    const raw =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    return raw.replace(/\/+$/, '');
  }

  private get resendApiKey(): string {
    return this.configService.get<string>('RESEND_API_KEY') ?? '';
  }

  private get fromEmail(): string {
    return (
      this.configService.get<string>('RESEND_FROM_EMAIL') ??
      'Day Off <onboarding@resend.dev>'
    );
  }

  private get replyTo(): string | null {
    const value = this.configService.get<string>('RESEND_REPLY_TO');
    return value?.trim() ? value.trim() : null;
  }

  /** 소셜 로그인에서 이메일을 받지 못한 계정은 `*.placeholder` 주소를 가지므로 발송하지 않습니다. */
  private isDeliverable(to: string | null | undefined): to is string {
    if (!to) return false;
    const address = to.trim().toLowerCase();
    return address.includes('@') && !address.endsWith('.placeholder');
  }

  private async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
    attachments?: { filename: string; content: string }[];
  }) {
    const body: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
      reply_to?: string;
      attachments?: { filename: string; content: string }[];
    } = {
      from: this.fromEmail,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    };
    const replyTo = params.replyTo || this.replyTo;
    if (replyTo) body.reply_to = replyTo;
    if (params.attachments?.length) body.attachments = params.attachments;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.resendApiKey}`,
      },
      body: JSON.stringify(body),
      // 메일 서버 지연이 주문·발송 처리 응답을 붙잡지 않도록 제한합니다.
      signal: AbortSignal.timeout(EmailService.REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(
        `resend request failed (${res.status})${errorText ? `: ${errorText}` : ''}`,
      );
    }
  }

  async sendContactInquiry(params: {
    to: string;
    name: string;
    email: string;
    category: string;
    subject: string;
    message: string;
    attachment?: { filename: string; buffer: Buffer };
  }): Promise<void> {
    if (!this.resendApiKey) {
      throw new ServiceUnavailableException(
        '문의 접수 설정을 준비 중입니다. 안내된 이메일로 연락해 주세요.',
      );
    }
    const text = [
      'CONTACT 페이지에 새 문의가 도착했습니다.',
      '',
      `성함: ${params.name}`,
      `이메일: ${params.email}`,
      `카테고리: ${params.category}`,
      `제목: ${params.subject}`,
      '',
      params.message,
    ].join('\n');
    const html = renderToStaticMarkup(
      React.createElement(
        'div',
        { style: { whiteSpace: 'pre-wrap', lineHeight: 1.7 } },
        text,
      ),
    );
    // 문의는 메일 자체가 접수 수단이므로 주문 알림과 달리 실패를 호출자에게 전달합니다.
    await this.sendEmail({
      to: params.to,
      subject: `[디오티 문의] [${params.category}] ${params.subject}`,
      html,
      text,
      replyTo: params.email,
      attachments: params.attachment
        ? [
            {
              filename: params.attachment.filename,
              content: params.attachment.buffer.toString('base64'),
            },
          ]
        : undefined,
    });
  }

  /**
   * 메일은 부가 알림이므로 템플릿 렌더링·전송 중 어떤 오류가 나도
   * 호출한 쪽(결제 확정, 발송 처리 등)을 실패시키지 않고 로그만 남깁니다.
   */
  private async deliver(
    label: string,
    to: string | null | undefined,
    build: () => Promise<MailContent>,
  ): Promise<void> {
    try {
      if (!this.resendApiKey || !this.isDeliverable(to)) return;
      const content = await build();
      await this.sendEmail({ to, ...content });
    } catch (err) {
      this.logger.error(
        `[mail] ${label} email failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async sendWelcomeEmail(params: { to: string; name?: string | null }) {
    await this.deliver('welcome', params.to, async () => {
      const displayName = params.name?.trim() || '고객';
      const html = await render(
        React.createElement(WelcomeEmail, {
          displayName,
          shopUrl: `${this.frontendUrl}/shop`,
        }),
      );
      const text = [
        `${displayName}님, 회원가입이 정상적으로 완료되었습니다.`,
        `쇼핑하러 가기: ${this.frontendUrl}/shop`,
        '',
        '본 메일은 발신 전용입니다.',
      ].join('\n');
      return { subject: `[디오티] 가입이 완료되었습니다`, html, text };
    });
  }

  async sendOrderPaidEmail(params: {
    to: string;
    name?: string | null;
    orderNumber: string;
    total: number;
    items: OrderMailItem[];
  }) {
    await this.deliver('order paid', params.to, async () => {
      const displayName = params.name?.trim() || '고객';
      const html = await render(
        React.createElement(OrderPaidEmail, {
          displayName,
          orderNumber: params.orderNumber,
          total: params.total,
          items: params.items,
          accountUrl: `${this.frontendUrl}/account?section=orders`,
        }),
      );
      const text = [
        `${displayName}님, 결제가 정상 완료되었습니다.`,
        `주문번호: ${params.orderNumber}`,
        `결제금액: ₩${params.total.toLocaleString('ko-KR')}`,
        ...params.items.map((item) => {
          const option = item.optionLabel ? ` (${item.optionLabel})` : '';
          return `- ${item.productName}${option} · ${item.quantity}개 · ₩${item.lineTotal.toLocaleString('ko-KR')}`;
        }),
        `주문 내역 확인: ${this.frontendUrl}/account?section=orders`,
        '',
        '배송 상태가 변경되면 안내 메일을 보내드립니다.',
      ].join('\n');
      return { subject: `[디오티] 주문이 완료되었습니다`, html, text };
    });
  }

  async sendOrderShippedEmail(params: {
    to: string;
    name?: string | null;
    orderNumber: string;
    trackingNumber: string;
    items: OrderMailItem[];
  }) {
    await this.deliver('shipped', params.to, async () => {
      const displayName = params.name?.trim() || '고객';
      const html = await render(
        React.createElement(OrderShippedEmail, {
          displayName,
          orderNumber: params.orderNumber,
          trackingNumber: params.trackingNumber,
          items: params.items,
          accountUrl: `${this.frontendUrl}/account?section=orders`,
        }),
      );
      const text = [
        `${displayName}님 주문건이 발송되었습니다.`,
        `주문번호: ${params.orderNumber}`,
        `송장번호: ${params.trackingNumber}`,
        ...params.items.map((item) => {
          const option = item.optionLabel ? ` (${item.optionLabel})` : '';
          return `- ${item.productName}${option} · ${item.quantity}개`;
        }),
        '상품을 수령하신 뒤 주문 내역에서 리뷰를 남겨주세요.',
        `주문 내역 / 리뷰 작성: ${this.frontendUrl}/account?section=orders`,
      ].join('\n');
      return { subject: `[디오티] 상품이 발송되었습니다`, html, text };
    });
  }

  async sendProductRestockedEmail(params: {
    to: string;
    name?: string | null;
    productName: string;
    productSlug: string;
  }) {
    await this.deliver('restocked', params.to, async () => {
      const displayName = params.name?.trim() || '고객';
      const productUrl = `${this.frontendUrl}/shop/${params.productSlug}`;
      const html = await render(
        React.createElement(ProductRestockedEmail, {
          displayName,
          productName: params.productName,
          productUrl,
        }),
      );
      const text = [
        `${displayName}님이 알림 신청하신 상품이 재입고되었습니다.`,
        `상품명: ${params.productName}`,
        `상품 보러 가기: ${productUrl}`,
        '',
        '재입고 알림 신청은 발송 후 자동으로 초기화됩니다.',
      ].join('\n');
      return {
        subject: `[디오티] 요청하신 상품이 재입고되었습니다`,
        html,
        text,
      };
    });
  }

  /** 관리자가 회원에게 쿠폰을 지급했을 때 쿠폰 코드와 사용 조건을 안내합니다. */
  async sendCouponIssuedEmail(params: {
    to: string;
    name?: string | null;
    code: string;
    discountType: 'percent' | 'fixed';
    discountValue: number;
    minOrderAmount?: number | null;
    validFrom: Date;
    validUntil: Date;
  }) {
    await this.deliver('coupon issued', params.to, async () => {
      const displayName = params.name?.trim() || '고객';
      const shopUrl = `${this.frontendUrl}/shop`;
      const discountLabel =
        params.discountType === 'percent'
          ? `${params.discountValue}% 할인`
          : `₩${params.discountValue.toLocaleString('ko-KR')} 할인`;
      const conditionLabel =
        params.minOrderAmount != null && params.minOrderAmount > 0
          ? `₩${params.minOrderAmount.toLocaleString('ko-KR')} 이상 구매 시 사용 가능`
          : '최소 주문 금액 제한 없음';
      const periodLabel = `${KST_DATE_FORMAT.format(params.validFrom)} ~ ${KST_DATE_FORMAT.format(params.validUntil)}`;
      const html = await render(
        React.createElement(CouponIssuedEmail, {
          displayName,
          code: params.code,
          discountLabel,
          conditionLabel,
          periodLabel,
          shopUrl,
        }),
      );
      const text = [
        `${displayName}님께 드리는 할인 쿠폰이 발급되었습니다.`,
        `쿠폰 코드: ${params.code}`,
        discountLabel,
        conditionLabel,
        `사용 기간: ${periodLabel}`,
        '',
        '장바구니의 쿠폰 입력란에 쿠폰 코드를 입력하시면 할인이 적용됩니다.',
        `쇼핑하러 가기: ${shopUrl}`,
        '',
        '본 메일은 발신 전용입니다.',
      ].join('\n');
      return { subject: `[디오티] 쿠폰이 도착했습니다`, html, text };
    });
  }
}
