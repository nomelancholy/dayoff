import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/review',
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname) || '.jpg'
          cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`)
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const allowed = /^image\/(jpeg|png|gif|webp)$/
        if (allowed.test(file.mimetype)) cb(null, true)
        else cb(new Error('이미지 파일만 업로드 가능합니다 (jpg, png, gif, webp).'), false)
      },
    }),
  ],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
