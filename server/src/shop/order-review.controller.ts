import {
  Body,
  Param,
  ParseUUIDPipe,
  Controller,
  Header,
  HttpCode,
  HttpException,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsBoolean, IsOptional, IsUUID, IsInt, Min } from 'class-validator';
import type { Request } from 'express';
import { RegisterNaverOrderDto } from './dto/naver-order.dto';
import { NaverOrderSessionGuard } from './naver-order-session.guard';
import { NaverCouponCheckoutService } from './naver-coupon-checkout.service';
import { OrderReviewService } from './order-review.service';

export class ReviewOrderDto extends RegisterNaverOrderDto {
  @IsOptional() @IsUUID() userCouponId?: string;
  @IsOptional() @IsBoolean() useCoupon?: boolean;
}

export class CouponOrderDto extends ReviewOrderDto {
  @IsUUID() requestId!: string;
  @IsInt() @Min(1) expectedTotal!: number;
}

@Controller('shop')
export class OrderReviewController {
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();
  private throttle(req: Request) {
    const now = Date.now();
    for (const [ip, v] of this.attempts)
      if (v.until <= now) this.attempts.delete(ip);
    const ip = req.ip || 'unknown',
      v = this.attempts.get(ip) ?? { count: 0, until: now + 60000 };
    if (
      v.count >= 10 ||
      (!this.attempts.has(ip) && this.attempts.size >= 10000)
    )
      throw new HttpException('잠시 후 다시 시도해 주세요.', 429);
    v.count++;
    this.attempts.set(ip, v);
  }
  constructor(
    private readonly review: OrderReviewService,
    private readonly config: ConfigService,
    private readonly checkout: NaverCouponCheckoutService,
  ) {}

  @Post('order-review')
  @UseGuards(NaverOrderSessionGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Vary', 'Authorization')
  async preview(
    @Body() dto: ReviewOrderDto,
    @Req() req: Request & { user?: { id: string } },
  ) {
    // Preparation only. Deployment cannot accidentally activate coupon checkout.
    if (
      this.config.get('ORDER_REVIEW_PREVIEW_ENABLED') !== 'true' &&
      !this.checkout.enabled()
    )
      throw new NotFoundException();
    return {
      ...(await this.review.preview(dto, req.user?.id)),
      pendingCheckouts: await this.checkout.pending(req.user?.id),
      paymentEnabled: this.checkout.enabled(),
      previewOnly: !this.checkout.enabled(),
    };
  }
  @Post('order-review/register')
  @UseGuards(NaverOrderSessionGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  register(
    @Body() dto: CouponOrderDto,
    @Req() req: Request & { user?: { id: string } },
  ) {
    this.throttle(req);
    return this.checkout.register(dto, req.user?.id);
  }

  @Post('order-review/:id/resume')
  @UseGuards(NaverOrderSessionGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  resume(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request & { user?: { id: string } },
  ) {
    return this.checkout.resume(id, req.user?.id);
  }
  @Post('order-review/:id/release')
  @UseGuards(NaverOrderSessionGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  release(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request & { user?: { id: string } },
  ) {
    return this.checkout.release(id, req.user?.id);
  }
}
