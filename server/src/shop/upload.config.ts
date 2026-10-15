import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomBytes } from 'crypto';
import { diskStorage } from 'multer';

export type MediaDirectory = 'product' | 'review';

export const UNSUPPORTED_IMAGE_MESSAGE =
  '이미지 파일만 업로드 가능합니다 (jpg, png, gif, webp).';

// 사용자가 올리는 이미지가 큰 경우가 있어 관리자·구매평 업로드 모두 30MB까지 허용합니다.
const UPLOAD_MAX_FILE_SIZE = 30 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

export function imageUploadOptions(directory: MediaDirectory): MulterOptions {
  return {
    storage: diskStorage({
      destination: `./uploads/${directory}`,
      filename: (_req, file, cb) => {
        // 확장자는 사용자가 보낸 파일명이 아니라 허용된 MIME에서만 정합니다.
        // (evil.html 같은 이름이 그대로 저장·서빙되지 않도록)
        const ext = EXTENSION_BY_MIME[file.mimetype] ?? '.img';
        cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`);
      },
    }),
    limits: { fileSize: UPLOAD_MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (EXTENSION_BY_MIME[file.mimetype]) cb(null, true);
      else cb(new BadRequestException(UNSUPPORTED_IMAGE_MESSAGE), false);
    },
  };
}
