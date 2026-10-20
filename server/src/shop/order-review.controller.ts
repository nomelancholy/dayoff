import {
  Body,
  Controller,
  Header,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import type { Request } from 'express';
import { RegisterNaverOrderDto } from './dto/naver-order.dto';
import { NaverOrderSessionGuard } from './naver-order-session.guard';
import { OrderReviewService } from './order-review.service';

export class ReviewOrderDto extends RegisterNaverOrderDto {
  @IsOptional() @IsUUID() userCouponId?: string;
  @IsOptional() @IsBoolean() useCoupon?: boolean;
}

@Controller('shop')
export class OrderReviewController {
  constructor(
    private readonly review: OrderReviewService,
    private readonly config: ConfigService,
  ) {}

  @Post('order-review')
  @UseGuards(NaverOrderSessionGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Vary', 'Authorization')
  preview(
    @Body() dto: ReviewOrderDto,
    @Req() req: Request & { user?: { id: string } },
  ) {
    // Preparation only. Deployment cannot accidentally activate coupon checkout.
    if (this.config.get('ORDER_REVIEW_PREVIEW_ENABLED') !== 'true')
      throw new NotFoundException();
    return this.review.preview(dto, req.user?.id);
  }
}
