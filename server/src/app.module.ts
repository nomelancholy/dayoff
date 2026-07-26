import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database/database.module';
import { AuthModule } from './auth/auth.module';
import { ShopModule } from './shop/shop.module';
import { CouponModule } from './coupon/coupon.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Docker 프로덕션은 compose 환경변수만 사용 (빌드 산출물 경로와 무관하게 안전)
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      // 없는 파일은 건너뜀. 뒤쪽이 앞을 덮어씀 → `server/.env`가 항상 최종 우선 (cwd가 레포 루트여도 동일)
      envFilePath:
        process.env.NODE_ENV === 'production'
          ? undefined
          : [join(process.cwd(), '.env'), join(__dirname, '..', '..', '.env')],
    }),
    DatabaseModule,
    AuthModule,
    ShopModule,
    CouponModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
