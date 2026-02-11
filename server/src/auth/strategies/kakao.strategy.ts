import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';
import { AuthService } from '../auth.service';

interface KakaoProfile {
  id: string;
  username?: string;
  displayName?: string;
  _json?: {
    kakao_account?: { email?: string };
  };
}

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      clientID: configService.get<string>('KAKAO_CLIENT_ID') ?? '',
      clientSecret: configService.get<string>('KAKAO_CLIENT_SECRET'),
      callbackURL: configService.get<string>('KAKAO_CALLBACK_URL'),
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: KakaoProfile,
  ) {
    const email =
      profile._json?.kakao_account?.email ??
      `${profile.id}@kakao.placeholder`;
    const fullName = profile.displayName ?? profile.username;
    return this.authService.findOrCreateSocialUser(
      'kakao',
      String(profile.id),
      email,
      fullName,
    );
  }
}
