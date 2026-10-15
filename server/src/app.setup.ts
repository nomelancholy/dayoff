import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';

/** 운영 서버와 e2e 테스트가 동일한 전역 설정을 쓰도록 한곳에서 구성합니다. */
export function configureApp(app: NestExpressApplication) {
  // Nginx 뒤에서도 req.protocol이 실제 HTTPS 요청을 반영하도록 합니다.
  app.set('trust proxy', 1);
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // 업로드 파일 서빙 (구매평 사진 등)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
}
