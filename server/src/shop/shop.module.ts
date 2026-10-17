import { NaverOrderSandboxController } from './naver-order-sandbox.controller';
import { NaverOrderApiClient } from './naver-order-api.client';
import { NaverOrderSyncService } from './naver-order-sync.service';
import { NaverOrderSyncController } from './naver-order-sync.controller';
import { NaverOrderSessionGuard } from './naver-order-session.guard';
import { NaverOrderClient } from './naver-order.client';
import { NaverOrderService } from './naver-order.service';
import { NaverOrderController } from './naver-order.controller';
import { Module } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { CouponModule } from '../coupon/coupon.module';
import { EmailModule } from '../common/email/email.module';
import { NaverPayClient } from './naver-pay.client';
import { StorageModule } from './storage.module';

@Module({
  imports: [CouponModule, EmailModule, StorageModule],
  controllers: [
    ShopController,
    NaverOrderController,
    NaverOrderSyncController,
    NaverOrderSandboxController,
  ],
  providers: [
    ShopService,
    NaverOrderApiClient,
    NaverOrderSyncService,
    NaverPayClient,
    NaverOrderClient,
    NaverOrderService,
    NaverOrderSessionGuard,
  ],
  exports: [ShopService],
})
export class ShopModule {}
