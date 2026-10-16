import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { NaverOrderSessionGuard } from './naver-order-session.guard';
import { NaverOrderClient } from './naver-order.client';
import { NaverOrderService } from './naver-order.service';
import { RegisterNaverOrderDto } from './dto/naver-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('shop')
export class NaverOrderController {
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();
  constructor(
    private readonly client: NaverOrderClient,
    private readonly orders: NaverOrderService,
  ) {}

  @Get('naver-order/config')
  @UseGuards(NaverOrderSessionGuard)
  @Header('Vary', 'Authorization')
  @Header('Cache-Control', 'no-store')
  config(@Req() req: Request & { user?: { id: string } }) {
    return this.client.publicConfig(req.user?.id);
  }

  @Get('admin/naver-order/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  status() {
    return this.client.getStatus();
  }

  @Post('naver-order/register')
  @UseGuards(NaverOrderSessionGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  register(
    @Body() dto: RegisterNaverOrderDto,
    @Req() req: Request & { user?: { id: string } },
  ) {
    this.client.assertAccess(req.user?.id);
    const now = Date.now();
    for (const [ip, value] of this.attempts)
      if (value.until <= now) this.attempts.delete(ip);
    const ip = req.ip || 'unknown';
    const value = this.attempts.get(ip) ?? { count: 0, until: now + 60_000 };
    if (
      value.count >= 10 ||
      (!this.attempts.has(ip) && this.attempts.size >= 10000)
    ) {
      throw new HttpException('잠시 후 다시 시도해 주세요.', 429);
    }
    value.count += 1;
    this.attempts.set(ip, value);
    return this.orders.register(dto);
  }

  @Get('naver-order/products')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  products(@Req() req: Request) {
    const params = new URL(req.originalUrl, 'http://localhost').searchParams;
    const ids = this.ids(params, /^product\[\d+\]\[id\]$/);
    return this.orders.productInfo(
      ids.map((id) => ({ id })),
      params.get('optionSearch') === 'true',
    );
  }

  private ids(params: URLSearchParams, pattern: RegExp) {
    const ids = [...params]
      .filter(([key]) => pattern.test(key))
      .map(([, value]) => value);
    if (!ids.length || ids.length > 50 || new Set(ids).size !== ids.length)
      throw new BadRequestException('상품 조회 요청이 올바르지 않습니다.');
    return ids;
  }
}
