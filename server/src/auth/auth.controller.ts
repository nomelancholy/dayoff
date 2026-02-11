import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Res,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import * as express from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { UserRow } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(
      dto.email,
      dto.password,
      dto.fullName,
      dto.phone,
    );
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  async login(@Body() _dto: LoginDto, @CurrentUser() user: UserRow) {
    return this.authService.login(user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: UserRow) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
    };
  }

  /** 구글 로그인: 이 라우트로 리다이렉트하면 구글 로그인 페이지로 이동 */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Guard가 구글 로그인 페이지로 리다이렉트
  }

  /** 구글 로그인 콜백: 로그인 성공 후 JWT 발급하고 프론트로 리다이렉트 */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @CurrentUser() user: UserRow,
    @Res({ passthrough: false }) res: express.Response,
  ) {
    const result = await this.authService.login(user);
    const frontUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    return res.redirect(
      `${frontUrl}/login?token=${encodeURIComponent(result.access_token)}`,
    );
  }

  /** 카카오 로그인 */
  @Get('kakao')
  @UseGuards(AuthGuard('kakao'))
  async kakaoAuth() {}

  @Get('kakao/callback')
  @UseGuards(AuthGuard('kakao'))
  async kakaoCallback(
    @CurrentUser() user: UserRow,
    @Res({ passthrough: false }) res: express.Response,
  ) {
    const result = await this.authService.login(user);
    const frontUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    return res.redirect(
      `${frontUrl}/login?token=${encodeURIComponent(result.access_token)}`,
    );
  }

  /** 네이버 로그인 */
  @Get('naver')
  @UseGuards(AuthGuard('naver'))
  async naverAuth() {}

  @Get('naver/callback')
  @UseGuards(AuthGuard('naver'))
  async naverCallback(
    @CurrentUser() user: UserRow,
    @Res({ passthrough: false }) res: express.Response,
  ) {
    const result = await this.authService.login(user);
    const frontUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    return res.redirect(
      `${frontUrl}/login?token=${encodeURIComponent(result.access_token)}`,
    );
  }
}
