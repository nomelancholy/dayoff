import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

type OrderItem = {
  productName: string;
  quantity: number;
  lineTotal: number;
  optionLabel?: string | null;
};

const styles = {
  body: {
    backgroundColor: '#f6f2ea',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif",
    color: '#1d1d1b',
    margin: '0',
    padding: '36px 16px',
  },
  container: {
    maxWidth: '620px',
    margin: '0 auto',
    backgroundColor: '#fcfaf6',
    border: '1px solid #e8e2d6',
    padding: '28px 24px',
  },
  brand: {
    margin: '0 0 10px',
    fontSize: '12px',
    letterSpacing: '0.18em',
    color: '#7a7468',
  },
  heading: {
    margin: '0 0 14px',
    fontSize: '26px',
    lineHeight: '1.3',
    fontWeight: '600',
    letterSpacing: '0.01em',
    color: '#1f1f1f',
  },
  text: {
    margin: '0 0 10px',
    fontSize: '14px',
    lineHeight: '1.75',
    color: '#46433d',
  },
  card: {
    margin: '16px 0',
    padding: '14px 16px',
    border: '1px solid #e8e2d6',
    backgroundColor: '#f7f3ec',
  },
  cardLabel: {
    margin: '0 0 8px',
    fontSize: '12px',
    letterSpacing: '0.08em',
    color: '#6f685b',
  },
  listItem: {
    margin: '0 0 6px',
    fontSize: '14px',
    lineHeight: '1.7',
    color: '#37342f',
  },
  button: {
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    padding: '10px 14px',
    borderRadius: '0',
    textDecoration: 'none',
    fontSize: '13px',
    letterSpacing: '0.08em',
  },
  footer: {
    margin: '18px 0 0',
    fontSize: '12px',
    color: '#878173',
  },
} as const;

export const WelcomeEmail = ({
  displayName,
  shopUrl,
}: {
  displayName: string;
  shopUrl: string;
}) => (
  <Html>
    <Head />
    <Preview>디오티에 오신 것을 환영합니다</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Text style={styles.brand}>D O T.</Text>
        <Heading style={styles.heading}>디오티에 오신 것을 환영합니다</Heading>
        <Text style={styles.text}>
          반갑습니다, {displayName}님, 회원가입이 정상적으로 완료되었습니다.
        </Text>
        <Text style={styles.text}>
          DOT는 당신이 맞이하는 매순간이 더욱 특별해질 수 있도록, 쓰임새와
          아름다움의 균형을 고민하며 일상의 도자기를 정성껏 빚어냅니다.
        </Text>
        <Text style={styles.text}>
          DOT의 작품들이 당신의 일상에 기분 좋은 쉼표가 되어주길 바랍니다.
        </Text>
        <Section style={{ marginTop: '18px' }}>
          <Button href={shopUrl} style={styles.button}>
            쇼핑하러 가기
          </Button>
        </Section>
        <Hr style={{ borderColor: '#e8e2d6', margin: '22px 0 14px' }} />
        <Text style={styles.footer}>본 메일은 발신 전용입니다.</Text>
      </Container>
    </Body>
  </Html>
);

export const OrderPaidEmail = ({
  displayName,
  orderNumber,
  total,
  items,
  accountUrl,
}: {
  displayName: string;
  orderNumber: string;
  total: number;
  items: OrderItem[];
  accountUrl: string;
}) => (
  <Html>
    <Head />
    <Preview>주문이 접수되었습니다</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Text style={styles.brand}>D O T.</Text>
        <Heading style={styles.heading}>주문이 접수되었습니다</Heading>
        <Text style={styles.text}>
          {displayName}님, 결제가 정상적으로 완료되었습니다.
        </Text>
        <Text style={styles.text}>주문번호 {orderNumber}</Text>
        <Text style={styles.text}>
          결제금액 ₩{total.toLocaleString('ko-KR')}
        </Text>
        <Section style={styles.card}>
          <Text style={styles.cardLabel}>주문 상품</Text>
          {items.map((item, index) => {
            const option = item.optionLabel ? ` (${item.optionLabel})` : '';
            return (
              <Text
                key={`${item.productName}-${index}`}
                style={styles.listItem}
              >
                {item.productName}
                {option} · {item.quantity}개 · ₩
                {item.lineTotal.toLocaleString('ko-KR')}
              </Text>
            );
          })}
        </Section>
        <Section style={{ marginTop: '18px' }}>
          <Button href={accountUrl} style={styles.button}>
            주문 내역 확인
          </Button>
        </Section>
        <Hr style={{ borderColor: '#e8e2d6', margin: '22px 0 14px' }} />
        <Text style={styles.footer}>
          배송 상태가 변경되면 안내 메일을 보내드립니다.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const OrderShippedEmail = ({
  displayName,
  orderNumber,
  trackingNumber,
  items,
  accountUrl,
}: {
  displayName: string;
  orderNumber: string;
  trackingNumber: string;
  items: OrderItem[];
  accountUrl: string;
}) => (
  <Html>
    <Head />
    <Preview>상품이 발송되었습니다</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Text style={styles.brand}>D O T.</Text>
        <Heading style={styles.heading}>상품이 발송되었습니다</Heading>
        <Text style={styles.text}>
          {displayName}님 주문 상품이 발송되었습니다.
        </Text>
        <Text style={styles.text}>주문번호 {orderNumber}</Text>
        <Text style={styles.text}>송장번호 {trackingNumber}</Text>
        <Section style={styles.card}>
          <Text style={styles.cardLabel}>발송 상품</Text>
          {items.map((item, index) => {
            const option = item.optionLabel ? ` (${item.optionLabel})` : '';
            return (
              <Text
                key={`${item.productName}-${index}`}
                style={styles.listItem}
              >
                {item.productName}
                {option} · {item.quantity}개
              </Text>
            );
          })}
        </Section>
        <Text style={styles.text}>
          상품을 수령하신 뒤 주문 내역에서 리뷰를 남겨주시면 큰 도움이 됩니다.
        </Text>
        <Section style={{ marginTop: '8px' }}>
          <Button href={accountUrl} style={styles.button}>
            주문 내역 / 리뷰 작성
          </Button>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const ProductRestockedEmail = ({
  displayName,
  productName,
  productUrl,
}: {
  displayName: string;
  productName: string;
  productUrl: string;
}) => (
  <Html>
    <Head />
    <Preview>요청하신 상품이 재입고되었습니다</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Text style={styles.brand}>D O T.</Text>
        <Heading style={styles.heading}>재입고 알림을 전해드립니다</Heading>
        <Text style={styles.text}>
          {displayName}님이 기다리시던 상품이 다시 준비되었습니다.
        </Text>
        <Section style={styles.card}>
          <Text style={styles.cardLabel}>재입고 상품</Text>
          <Text style={styles.listItem}>{productName}</Text>
        </Section>
        <Section style={{ marginTop: '18px' }}>
          <Button href={productUrl} style={styles.button}>
            상품 보러 가기
          </Button>
        </Section>
        <Hr style={{ borderColor: '#e8e2d6', margin: '22px 0 14px' }} />
        <Text style={styles.footer}>
          재입고 알림 신청은 발송 후 자동으로 초기화됩니다.
        </Text>
      </Container>
    </Body>
  </Html>
);
