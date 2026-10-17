import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  Inject,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../common/database/database.module';
import * as schema from '../db/schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RegisterNaverOrderDto } from './dto/naver-order.dto';
import { NaverOrderClient } from './naver-order.client';
import { NaverOrderService } from './naver-order.service';
import { NaverApiError, NaverOrderApiClient } from './naver-order-api.client';

@Controller('shop/admin/naver-order/sandbox')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class NaverOrderSandboxController {
  private busy = false;
  private nextRequestAt = 0;
  constructor(
    private readonly config: ConfigService,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  private available() {
    return (
      this.config.get('NAVER_ORDER_API_MODE') === 'sandbox' &&
      this.config.get('NAVER_ORDER_INVENTORY_ENABLED') !== 'true'
    );
  }
  private assertSandbox() {
    if (!this.available())
      throw new ServiceUnavailableException(
        '샌드박스 주문관리 API 설정에서만 이용할 수 있습니다.',
      );
  }
  private async exclusive<T>(action: () => Promise<T>) {
    this.assertSandbox();
    if (this.busy || Date.now() < this.nextRequestAt)
      throw new HttpException('잠시 후 다시 시도해 주세요.', 429);
    this.busy = true;
    this.nextRequestAt = Date.now() + 3000;
    try {
      return await action();
    } finally {
      this.busy = false;
    }
  }
  private checkout() {
    // Independent configuration: never change the public checkout singleton.
    const keys = [
      'NAVER_ORDER_MERCHANT_ID',
      'NAVER_ORDER_CERTI_KEY',
      'NAVER_ORDER_BUTTON_KEY',
      'NAVER_ORDER_ACCOUNT_ID',
      'FRONTEND_URL',
    ];
    const settings = Object.fromEntries(
      keys.map((key) => [key, this.config.get(key)]),
    );
    return new NaverOrderClient(
      new ConfigService({
        ...settings,
        NAVER_ORDER_ENABLED: 'true',
        NAVER_ORDER_MODE: 'test',
        NAVER_ORDER_AUDIENCE: 'review',
        NAVER_ORDER_PRODUCTION_READY: 'false',
      }),
    );
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  status() {
    return {
      available: this.available() && this.checkout().getStatus().enabled,
      mode: 'sandbox',
      inventoryModified: false,
    };
  }
  @Post('register')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  register(@Body() dto: RegisterNaverOrderDto) {
    return this.exclusive(async () => {
      const orders = new NaverOrderService(this.db, this.checkout());
      const { key, merchantNo } = await orders.register(dto);
      return {
        desktopUrl: `https://test-order.pay.naver.com/customer/buy/${key}/${merchantNo}`,
        mobileUrl: `https://test-m.pay.naver.com/o/customer/buy/${key}/${merchantNo}`,
        mode: 'sandbox',
        inventoryModified: false,
      };
    });
  }
  @Post('traces')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  traces() {
    return this.exclusive(async () => {
      // Per-request client keeps traces isolated from the background worker.
      const api = new NaverOrderApiClient(this.config);
      const to = new Date();
      const from = new Date(to.getTime() - 86400000);
      try {
        const page = await api.changes(from, to);
        const ids = [
          ...new Set(
            page.lastChangeStatuses.map((item) => item.productOrderId),
          ),
        ];
        const details = ids.length ? await api.details(ids) : [];
        const traces = api.traceIds();
        return {
          mode: 'sandbox',
          from: from.toISOString(),
          to: to.toISOString(),
          changedOrders: ids.length,
          detailsRead: details.length,
          hasMore: !!page.more,
          changesTraceId:
            traces['/v1/pay-order/mall/product-orders/last-changed-statuses'] ??
            null,
          detailsTraceId:
            traces['/v1/pay-order/mall/product-orders/query'] ?? null,
          inventoryModified: false,
        };
      } catch (error) {
        throw new ServiceUnavailableException(
          error instanceof NaverApiError ? error.code : 'SANDBOX_READ_FAILED',
        );
      }
    });
  }
}
