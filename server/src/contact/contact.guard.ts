import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class ContactGuard implements CanActivate {
  private readonly attempts = new Map<
    string,
    { count: number; expires: number }
  >();
  private readonly windowMs = 10 * 60 * 1000;

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get<string>('CONTACT_ENABLED') !== 'true') {
      throw new ServiceUnavailableException(
        '문의 접수 설정을 준비 중입니다. 안내된 이메일로 연락해 주세요.',
      );
    }
    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    for (const [key, value] of this.attempts) {
      if (value.expires <= now) this.attempts.delete(key);
    }
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const previous = this.attempts.get(key);
    if (
      (previous?.count ?? 0) >= 5 ||
      (!previous && this.attempts.size >= 10_000)
    ) {
      throw new HttpException(
        '문의 요청이 많습니다. 10분 후 다시 시도해 주세요.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.attempts.set(key, {
      count: (previous?.count ?? 0) + 1,
      expires: previous?.expires ?? now + this.windowMs,
    });
    return true;
  }
}
