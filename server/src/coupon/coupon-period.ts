import { BadRequestException } from '@nestjs/common';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 쿠폰 유효 기간 입력을 해석합니다.
 * 관리자 화면은 날짜(YYYY-MM-DD)만 보내므로 한국 시간 기준 하루 전체가 유효하도록
 * 시작일은 00:00:00, 종료일은 23:59:59.999(KST)로 맞춥니다.
 * (날짜만 있는 문자열을 그대로 Date로 바꾸면 UTC 자정 = 한국 시간 오전 9시가 됩니다.)
 */
export function parseCouponDate(
  value: string,
  boundary: 'start' | 'end',
): Date {
  const trimmed = value.trim();
  const date = DATE_ONLY_PATTERN.test(trimmed)
    ? new Date(
        `${trimmed}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}+09:00`,
      )
    : new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('유효 기간 날짜 형식이 올바르지 않습니다.');
  }
  return date;
}

/** 한국 시간 오프셋(+09:00)이 붙은 ISO 문자열. 앞 10자리가 한국 날짜가 됩니다. */
export function toKstIsoString(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS)
    .toISOString()
    .replace('Z', '+09:00');
}

export function assertValidCouponPeriod(validFrom: Date, validUntil: Date) {
  if (validUntil.getTime() < validFrom.getTime()) {
    throw new BadRequestException('유효 종료일은 시작일보다 빠를 수 없습니다.');
  }
}
