import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

export function naverReviewEnabled(config: ConfigService): boolean {
  return (
    config.get<string>('NAVER_REVIEW_LOGIN_ENABLED') === 'true' &&
    config.get<string>('NAVER_ORDER_MODE') === 'test' &&
    (config.get<string>('NAVER_ORDER_AUDIENCE') || 'review') === 'review' &&
    !!config.get<string>('NAVER_REVIEW_USER_ID')?.trim()
  );
}

/** 비밀번호를 교체하면 이미 발급된 검수 세션도 무효화합니다. */
export function reviewCredentialVersion(hash: string): string {
  return createHash('sha256').update(hash).digest('hex');
}
