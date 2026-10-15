import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '../auth.service';
import { AuthService } from '../auth.service';
import {
  naverReviewEnabled,
  reviewCredentialVersion,
} from '../naver-review.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'change-me',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    if (
      payload.npayReview ||
      user.id === this.configService.get<string>('NAVER_REVIEW_USER_ID')?.trim()
    ) {
      if (
        !naverReviewEnabled(this.configService) ||
        user.id !==
          this.configService.get<string>('NAVER_REVIEW_USER_ID')?.trim() ||
        user.provider !== 'email' ||
        user.role !== 'member' ||
        !user.password ||
        payload.npayReview !== reviewCredentialVersion(user.password)
      )
        throw new UnauthorizedException();
    }
    return user;
  }
}
