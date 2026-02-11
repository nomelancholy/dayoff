import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Provider } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { KakaoStrategy } from './strategies/kakao.strategy';
import { NaverStrategy } from './strategies/naver.strategy';

// 소셜 로그인은 env 설정이 있을 때만 전략 등록 (미설정 시 OAuth2Strategy가 clientID 필수로 크래시 방지)
const socialProviders: Provider[] = [];
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CALLBACK_URL) {
  socialProviders.push(GoogleStrategy);
}
if (process.env.KAKAO_CLIENT_ID && process.env.KAKAO_CALLBACK_URL) {
  socialProviders.push(KakaoStrategy);
}
if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CALLBACK_URL) {
  socialProviders.push(NaverStrategy);
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'change-me',
        signOptions: {
          expiresIn: 604800,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy, ...socialProviders],
  exports: [AuthService],
})
export class AuthModule {}
