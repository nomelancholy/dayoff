/** 숫자만 추출 */
export function phoneDigitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * 국내 휴대폰 (010 8자리 또는 011·016·017·018·019 등 10~11자리)
 * 비어 있으면 true (선택 입력)
 */
export function isOptionalKoreanMobile(value: string): boolean {
  const d = phoneDigitsOnly(value)
  if (d.length === 0) return true
  return /^(?:010\d{8}|01[1-9]\d{7,8})$/.test(d)
}

export const KOREAN_PHONE_INVALID_MESSAGE =
  '휴대폰 번호를 010-1234-5678 형식(또는 011 등 10자리)으로 입력해 주세요.'
