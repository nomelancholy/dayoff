import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Patch,
  Delete,
  Param,
  Res,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import * as express from 'express';
import { AuthService } from './auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { UserRow } from './auth.service';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /** 소셜 콜백 후 리다이렉트용 (끝 슬래시 제거) */
  private frontendOrigin(): string {
    const raw =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    return raw.replace(/\/+$/, '');
  }

  @Get('admin/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  adminListUsers(@Query() query: AdminUsersQueryDto) {
    return this.authService.listUsersForAdmin({
      q: query.q,
      role: query.role,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get('admin/users/:id/addresses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  adminListUserAddresses(@Param('id') id: string) {
    return this.authService.listUserAddressesForAdmin(id);
  }

  @Patch('admin/users/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  adminUpdateUserRole(
    @CurrentUser() actor: UserRow,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.authService.updateUserRoleByAdmin(actor.id, id, dto.role);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: UserRow) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: UserRow,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, {
      fullName: dto.fullName,
      phone: dto.phone,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
    });
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteMe(@CurrentUser() user: UserRow) {
    return this.authService.deleteMyAccount(user.id);
  }

  @Get('addresses')
  @UseGuards(JwtAuthGuard)
  async getAddresses(@CurrentUser() user: UserRow) {
    return this.authService.getAddresses(user.id);
  }

  @Post('addresses')
  @UseGuards(JwtAuthGuard)
  async createAddress(
    @CurrentUser() user: UserRow,
    @Body() dto: CreateAddressDto,
  ) {
    return this.authService.createAddress(user.id, {
      label: dto.label,
      recipientName: dto.recipientName,
      phone: dto.phone,
      postalCode: dto.postalCode,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      isDefault: dto.isDefault,
    });
  }

  @Patch('addresses/:id')
  @UseGuards(JwtAuthGuard)
  async updateAddress(
    @CurrentUser() user: UserRow,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.authService.updateAddress(user.id, id, {
      label: dto.label,
      recipientName: dto.recipientName,
      phone: dto.phone,
      postalCode: dto.postalCode,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      isDefault: dto.isDefault,
    });
  }

  @Delete('addresses/:id')
  @UseGuards(JwtAuthGuard)
  async deleteAddress(@CurrentUser() user: UserRow, @Param('id') id: string) {
    return this.authService.deleteAddress(user.id, id);
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
    const frontUrl = this.frontendOrigin();
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
    const frontUrl = this.frontendOrigin();
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
    const frontUrl = this.frontendOrigin();
    return res.redirect(
      `${frontUrl}/login?token=${encodeURIComponent(result.access_token)}`,
    );
  }
}
