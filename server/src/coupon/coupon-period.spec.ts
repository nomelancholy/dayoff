import { BadRequestException } from '@nestjs/common';
import {
  assertValidCouponPeriod,
  parseCouponDate,
  toKstIsoString,
} from './coupon-period';

describe('쿠폰 유효 기간', () => {
  it('날짜만 받으면 한국 시간 하루의 시작/끝으로 해석한다', () => {
    expect(parseCouponDate('2026-10-05', 'start').toISOString()).toBe(
      '2026-10-04T15:00:00.000Z',
    );
    expect(parseCouponDate(' 2026-10-31 ', 'end').toISOString()).toBe(
      '2026-10-31T14:59:59.999Z',
    );
  });

  it('시각이 포함된 값은 그대로 사용한다', () => {
    expect(
      parseCouponDate('2026-10-05T03:30:00.000Z', 'start').toISOString(),
    ).toBe('2026-10-05T03:30:00.000Z');
    expect(
      parseCouponDate('2026-10-05T12:00:00+09:00', 'end').toISOString(),
    ).toBe('2026-10-05T03:00:00.000Z');
  });

  it('해석할 수 없는 날짜는 400으로 거부한다', () => {
    expect(() => parseCouponDate('not-a-date', 'start')).toThrow(
      BadRequestException,
    );
  });

  it('응답 문자열의 앞 10자리가 한국 날짜가 되고 같은 시각을 가리킨다', () => {
    const from = parseCouponDate('2026-10-05', 'start');
    const until = parseCouponDate('2026-10-31', 'end');

    expect(toKstIsoString(from)).toBe('2026-10-05T00:00:00.000+09:00');
    expect(toKstIsoString(until)).toBe('2026-10-31T23:59:59.999+09:00');
    expect(new Date(toKstIsoString(from)).getTime()).toBe(from.getTime());
    // 수정 폼이 앞 10자리를 그대로 다시 보내도 같은 기간으로 저장된다.
    expect(
      parseCouponDate(toKstIsoString(from).slice(0, 10), 'start').getTime(),
    ).toBe(from.getTime());
    expect(
      parseCouponDate(toKstIsoString(until).slice(0, 10), 'end').getTime(),
    ).toBe(until.getTime());
  });

  it('예전 방식(UTC 자정)으로 저장된 쿠폰도 같은 날짜로 보인다', () => {
    expect(
      toKstIsoString(new Date('2026-10-05T00:00:00.000Z')).slice(0, 10),
    ).toBe('2026-10-05');
  });

  it('하루짜리 기간은 허용하고, 종료일이 시작일보다 빠르면 거부한다', () => {
    expect(() =>
      assertValidCouponPeriod(
        parseCouponDate('2026-10-05', 'start'),
        parseCouponDate('2026-10-05', 'end'),
      ),
    ).not.toThrow();
    expect(() =>
      assertValidCouponPeriod(
        parseCouponDate('2026-10-06', 'start'),
        parseCouponDate('2026-10-05', 'end'),
      ),
    ).toThrow(BadRequestException);
  });
});
