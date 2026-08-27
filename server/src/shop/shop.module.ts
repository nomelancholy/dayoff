import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { CouponModule } from '../coupon/coupon.module';
import { EmailModule } from '../common/email/email.module';
import { NaverPayClient } from './naver-pay.client';
import { SpacesStorageService } from './spaces-storage.service';

@Module({
  imports: [
    CouponModule,
    EmailModule,
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/review',
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname) || '.jpg';
          cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`);
        },
      }),
      // 리뷰 이미지 업로드는 사용자가 업로드하는 이미지가 큰 경우가 있어
      // 관리자 업로드와 동일한 수준(30MB)으로 상향
      limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
      fileFilter: (_req, file, cb) => {
        const allowed = /^image\/(jpeg|png|gif|webp)$/;
        if (allowed.test(file.mimetype)) cb(null, true);
        else
          cb(
            new Error('이미지 파일만 업로드 가능합니다 (jpg, png, gif, webp).'),
            false,
          );
      },
    }),
  ],
  controllers: [ShopController],
  providers: [ShopService, NaverPayClient, SpacesStorageService],
  exports: [ShopService],
})
export class ShopModule {}
