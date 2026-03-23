import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import * as React from 'react';
import {
  OrderPaidEmail,
  OrderShippedEmail,
  WelcomeEmail,
} from './email.templates';

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
    const subject = `[디오티] 가입이 완료되었습니다`;
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
    const subject = `[디오티] 주문이 완료되었습니다`;
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
    const subject = `[디오티] 상품이 발송되었습니다`;
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

    try {
      await this.sendEmail({ to: params.to, subject, html, text });
    } catch (err) {
      console.error('[mail] shipped email failed', err);
    }
  }
}
