import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-naver';
import { AuthService } from '../auth.service';

interface NaverProfile {
  id: string;
  displayName?: string;
  emails?: Array<{ value: string }>;
}

@Injectable()
export class NaverStrategy extends PassportStrategy(Strategy, 'naver') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      clientID: configService.get<string>('NAVER_CLIENT_ID') ?? '',
      clientSecret: configService.get<string>('NAVER_CLIENT_SECRET') ?? '',
      callbackURL: configService.get<string>('NAVER_CALLBACK_URL'),
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: NaverProfile,
  ) {
    const email =
      profile.emails?.[0]?.value ?? `${profile.id}@naver.placeholder`;
    const fullName = profile.displayName;
    return this.authService.findOrCreateSocialUser(
      'naver',
      profile.id,
      email,
      fullName,
    );
  }
}
