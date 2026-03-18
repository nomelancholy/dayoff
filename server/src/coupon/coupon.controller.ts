import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CouponService } from './coupon.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserRow } from '../auth/auth.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { IssueCouponDto } from './dto/issue-coupon.dto';

@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  /** 관리자: 쿠폰 목록 */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async findAll() {
    return this.couponService.findAll();
  }

  /** 관리자: 쿠폰 생성 */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreateCouponDto) {
    return this.couponService.create({
      code: dto.code,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      minOrderAmount: dto.minOrderAmount,
      validFrom: dto.validFrom,
      validUntil: dto.validUntil,
      usageLimit: dto.usageLimit,
      isActive: dto.isActive,
    });
  }

  /** 관리자: 쿠폰 수정 */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponService.update(id, {
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.discountType !== undefined && { discountType: dto.discountType }),
      ...(dto.discountValue !== undefined && {
        discountValue: dto.discountValue,
      }),
      ...(dto.minOrderAmount !== undefined && {
        minOrderAmount: dto.minOrderAmount,
      }),
      ...(dto.validFrom !== undefined && { validFrom: dto.validFrom }),
      ...(dto.validUntil !== undefined && { validUntil: dto.validUntil }),
      ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
  }

  /** 관리자: 쿠폰 삭제 */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string) {
    return this.couponService.remove(id);
  }

  /** 관리자: 회원에게 쿠폰 지급 */
  @Post(':id/issue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async issue(@Param('id') id: string, @Body() dto: IssueCouponDto) {
    return this.couponService.issueToUser(id, dto.userId);
  }

  /** 회원: 내 보유 쿠폰 목록 (미사용) */
  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyCoupons(@CurrentUser() user: UserRow) {
    return this.couponService.getMyCoupons(user.id);
  }

  /** 회원: 쿠폰 코드 검증 (주문 금액 기준 할인액) */
  @Post('validate')
  @UseGuards(JwtAuthGuard)
  async validate(@CurrentUser() user: UserRow, @Body() dto: ValidateCouponDto) {
    return this.couponService.validateCode(user.id, dto.code, dto.orderAmount);
  }
}
