import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/**
 * 경로의 ID가 UUID가 아니면 DB 조회 전에 400으로 응답합니다.
 * (검증 없이 조회하면 Postgres uuid 형변환 오류가 500으로 노출됩니다.)
 */
export const UuidParam = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('잘못된 ID 형식입니다.'),
});
