import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpException,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { NaverReviewLoginDto } from './dto/naver-review-login.dto';

@Controller('auth/npay-review')
export class NaverReviewController {
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();
  private total = { count: 0, until: 0 };

  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  login(@Body() dto: NaverReviewLoginDto, @Req() req: Request) {
    const now = Date.now();
    for (const [ip, value] of this.attempts)
      if (value.until <= now) this.attempts.delete(ip);
    if (this.total.until <= now) this.total = { count: 0, until: now + 60_000 };
    const ip = req.ip || 'unknown';
    const value = this.attempts.get(ip) ?? {
      count: 0,
      until: now + 15 * 60_000,
    };
    if (
      value.count >= 10 ||
      this.total.count >= 100 ||
      this.attempts.size >= 10000
    )
      throw new HttpException(
        '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.',
        429,
      );
    value.count += 1;
    this.total.count += 1;
    this.attempts.set(ip, value);
    return this.auth.loginNaverReview(dto.identifier, dto.password);
  }
}
