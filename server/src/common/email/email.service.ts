import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type OrderMailItem = {
  productName: string;
  quantity: number;
  lineTotal: number;
  optionLabel?: string | null;
};

@Injectable()
export class EmailService {
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

  private async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }) {
    if (!this.resendApiKey) return;

    const body: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
      reply_to?: string;
    } = {
      from: this.fromEmail,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    };
    if (this.replyTo) {
      body.reply_to = this.replyTo;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.resendApiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(
        `resend request failed (${res.status})${errorText ? `: ${errorText}` : ''}`,
      );
    }
  }

  async sendWelcomeEmail(params: { to: string; name?: string | null }) {
    const displayName = params.name?.trim() || '고객';
    const subject = `[Day Off] 가입이 완료되었습니다`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;letter-spacing:0.01em">Day Off에 오신 것을 환영합니다</h2>
        <p style="margin:0 0 8px">${displayName}님, 회원가입이 정상적으로 완료되었습니다.</p>
        <p style="margin:0 0 16px;color:#555">마이페이지에서 배송지와 주문 내역을 확인하실 수 있습니다.</p>
        <a href="${this.frontendUrl}/shop" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:6px">쇼핑하러 가기</a>
        <p style="margin:18px 0 0;color:#777;font-size:12px">본 메일은 발신 전용입니다.</p>
      </div>
    `;
    const text = [
      `${displayName}님, 회원가입이 정상적으로 완료되었습니다.`,
      `쇼핑하러 가기: ${this.frontendUrl}/shop`,
      '',
      '본 메일은 발신 전용입니다.',
    ].join('\n');

    try {
      await this.sendEmail({ to: params.to, subject, html, text });
    } catch (err) {
      console.error('[mail] welcome email failed', err);
    }
  }

  async sendOrderPaidEmail(params: {
    to: string;
    name?: string | null;
    orderNumber: string;
    total: number;
    items: OrderMailItem[];
  }) {
    const displayName = params.name?.trim() || '고객';
    const subject = `[Day Off] 주문이 완료되었습니다`;
    const itemsHtml = params.items
      .map((item) => {
        const option = item.optionLabel ? ` (${item.optionLabel})` : '';
        return `<li style="margin:0 0 4px">${item.productName}${option} · ${item.quantity}개 · ₩${item.lineTotal.toLocaleString('ko-KR')}</li>`;
      })
      .join('');
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;letter-spacing:0.01em">주문이 접수되었습니다</h2>
        <p style="margin:0 0 8px">${displayName}님, 결제가 정상적으로 완료되었습니다.</p>
        <p style="margin:0 0 4px"><strong>주문번호</strong> ${params.orderNumber}</p>
        <p style="margin:0 0 12px"><strong>결제금액</strong> ₩${params.total.toLocaleString('ko-KR')}</p>
        <div style="padding:12px 14px;border:1px solid #ececec;border-radius:8px;background:#fafafa;margin:0 0 16px">
          <p style="margin:0 0 8px;font-size:13px;color:#555">주문 상품</p>
          <ul style="margin:0;padding-left:18px">${itemsHtml}</ul>
        </div>
        <a href="${this.frontendUrl}/account" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:6px">주문 내역 확인</a>
        <p style="margin:18px 0 0;color:#777;font-size:12px">배송 상태가 변경되면 안내 메일을 보내드립니다.</p>
      </div>
    `;
    const text = [
      `${displayName}님, 결제가 정상 완료되었습니다.`,
      `주문번호: ${params.orderNumber}`,
      `결제금액: ₩${params.total.toLocaleString('ko-KR')}`,
      ...params.items.map((item) => {
        const option = item.optionLabel ? ` (${item.optionLabel})` : '';
        return `- ${item.productName}${option} · ${item.quantity}개 · ₩${item.lineTotal.toLocaleString('ko-KR')}`;
      }),
      `주문 내역 확인: ${this.frontendUrl}/account`,
      '',
      '배송 상태가 변경되면 안내 메일을 보내드립니다.',
    ].join('\n');

    try {
      await this.sendEmail({ to: params.to, subject, html, text });
    } catch (err) {
      console.error('[mail] order paid email failed', err);
    }
  }

  async sendOrderShippedEmail(params: {
    to: string;
    name?: string | null;
    orderNumber: string;
    trackingNumber: string;
    items: OrderMailItem[];
  }) {
    const displayName = params.name?.trim() || '고객';
    const subject = `[Day Off] 상품이 발송되었습니다`;
    const itemsHtml = params.items
      .map((item) => {
        const option = item.optionLabel ? ` (${item.optionLabel})` : '';
        return `<li style="margin:0 0 4px">${item.productName}${option} · ${item.quantity}개</li>`;
      })
      .join('');
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',sans-serif;line-height:1.6;color:#111">
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;letter-spacing:0.01em">상품이 발송되었습니다</h2>
        <p style="margin:0 0 8px">${displayName}님 주문 상품이 발송되었습니다.</p>
        <p style="margin:0 0 4px"><strong>주문번호</strong> ${params.orderNumber}</p>
        <p style="margin:0 0 12px"><strong>송장번호</strong> ${params.trackingNumber}</p>
        <div style="padding:12px 14px;border:1px solid #ececec;border-radius:8px;background:#fafafa;margin:0 0 16px">
          <p style="margin:0 0 8px;font-size:13px;color:#555">발송 상품</p>
          <ul style="margin:0;padding-left:18px">${itemsHtml}</ul>
        </div>
        <p style="margin:0 0 12px;color:#555">상품을 수령하신 뒤 주문 내역에서 리뷰를 남겨주시면 큰 도움이 됩니다.</p>
        <a href="${this.frontendUrl}/account" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:6px">주문 내역 / 리뷰 작성</a>
      </div>
    `;
    const text = [
      `${displayName}님 주문건이 발송되었습니다.`,
      `주문번호: ${params.orderNumber}`,
      `송장번호: ${params.trackingNumber}`,
      ...params.items.map((item) => {
        const option = item.optionLabel ? ` (${item.optionLabel})` : '';
        return `- ${item.productName}${option} · ${item.quantity}개`;
      }),
      '상품을 수령하신 뒤 주문 내역에서 리뷰를 남겨주세요.',
      `주문 내역 / 리뷰 작성: ${this.frontendUrl}/account`,
    ].join('\n');

    try {
      await this.sendEmail({ to: params.to, subject, html, text });
    } catch (err) {
      console.error('[mail] shipped email failed', err);
    }
  }
}
