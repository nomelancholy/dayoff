import { Transform } from 'class-transformer';

/** 문자열 앞뒤 공백을 제거한 뒤 검증합니다. (공백만 입력한 값이 필수값 검사를 통과하지 않도록) */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
