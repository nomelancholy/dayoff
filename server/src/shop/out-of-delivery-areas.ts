export type PostalRange = { start: number; end: number };

// `out-of-delivery-areas.md`의 우편번호 구간(포함) 기반
// - 비교는 숫자(5자리 우편번호) 기준
const OUT_OF_DELIVERY_RANGES: PostalRange[] = [
  { start: 63000, end: 63644 }, // 제주도
  { start: 22386, end: 22388 }, // 인천 중구
  { start: 23004, end: 23010 }, // 인천 강화
  { start: 23100, end: 23116 }, // 인천 옹진
  { start: 23124, end: 23136 }, // 인천 옹진
  { start: 31708, end: 31708 }, // 충남 당진
  { start: 32133, end: 32133 }, // 충남 태안
  { start: 33411, end: 33411 }, // 충남 보령
  { start: 40200, end: 40240 }, // 경북 울릉
  { start: 46768, end: 46771 }, // 부산 강서
  { start: 52570, end: 52571 }, // 경남 사천
  { start: 53031, end: 53033 }, // 경남 통영
  { start: 53089, end: 53104 }, // 경남 통영
  { start: 54000, end: 54000 }, // 경남 통영
  { start: 56347, end: 56349 }, // 전북 부안
  { start: 57068, end: 57069 }, // 전남 영광
  { start: 58760, end: 58762 }, // 전남 목포
  { start: 58800, end: 58810 }, // 전남 신안
  { start: 58816, end: 58818 }, // 전남 신안
  { start: 28826, end: 28826 }, // 전남 신안(단일)
  { start: 58828, end: 58866 }, // 전남 신안
  { start: 58953, end: 58958 }, // 전남 진도
  { start: 59102, end: 59103 }, // 전남 완도
  { start: 59106, end: 59106 }, // 전남 완도
  { start: 59127, end: 59127 }, // 전남 완도
  { start: 59129, end: 59129 }, // 전남 완도
  { start: 59137, end: 59166 }, // 전남 완도
  { start: 59650, end: 59650 }, // 전남 여수
  { start: 59766, end: 59766 }, // 전남 여수
  { start: 59781, end: 59790 }, // 전남 여수
];

export function isOutOfDeliveryPostalCode(
  postalCode: string | null | undefined,
) {
  const digits = postalCode?.replace(/\D/g, '') ?? '';
  if (digits.length < 5) return false;

  const num = Number(digits);
  if (!Number.isFinite(num)) return false;

  return OUT_OF_DELIVERY_RANGES.some((r) => num >= r.start && num <= r.end);
}
