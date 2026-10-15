import { BadRequestException } from '@nestjs/common';
import { basename, join, parse } from 'path';
import { rename, unlink } from 'fs/promises';
import sharp from 'sharp';
import type { Multer } from 'multer';
import {
  UNSUPPORTED_IMAGE_MESSAGE,
  type MediaDirectory,
} from './upload.config';

type OptimizeUploadedImageOptions = {
  publicDirectory: MediaDirectory;
  maxWidth: number;
};

export type PreparedUploadedImage = {
  filePath: string;
  filename: string;
  contentType: string;
  localUrl: string;
};

// 실제 파일 내용에서 판별한 형식만 허용합니다. (SVG·HTML 등은 스크립트를 담을 수 있어 제외)
const ALLOWED_FORMATS: Record<string, { ext: string; contentType: string }> = {
  jpeg: { ext: '.jpg', contentType: 'image/jpeg' },
  png: { ext: '.png', contentType: 'image/png' },
  webp: { ext: '.webp', contentType: 'image/webp' },
  gif: { ext: '.gif', contentType: 'image/gif' },
};

/**
 * 업로드 원본을 브라우저 전송용 WebP로 변환합니다.
 * - 요청의 MIME·파일명은 신뢰하지 않고, 파일 내용이 실제 이미지인지 먼저 확인합니다.
 * - GIF는 애니메이션 손실을 피하기 위해 원본을 유지합니다.
 * - 정상 이미지인데 변환만 실패한 경우에는 판별된 형식의 확장자로 원본을 사용합니다.
 */
export const optimizeUploadedImage = async (
  file: Multer.File,
  { publicDirectory, maxWidth }: OptimizeUploadedImageOptions,
): Promise<PreparedUploadedImage> => {
  const parsed = parse(file.path);

  let format: string | undefined;
  try {
    format = (await sharp(file.path).metadata()).format;
  } catch {
    format = undefined;
  }
  const detected = format ? ALLOWED_FORMATS[format] : undefined;
  if (!detected) {
    await unlink(file.path).catch(() => undefined);
    throw new BadRequestException(UNSUPPORTED_IMAGE_MESSAGE);
  }

  const keepOriginal = async (): Promise<PreparedUploadedImage> => {
    const safePath = join(parsed.dir, `${parsed.name}${detected.ext}`);
    if (safePath !== file.path) await rename(file.path, safePath);
    const filename = basename(safePath);
    return {
      filePath: safePath,
      filename,
      contentType: detected.contentType,
      localUrl: `/uploads/${publicDirectory}/${filename}`,
    };
  };

  if (format === 'gif') return keepOriginal();

  const optimizedFilename = `${parsed.name}-optimized.webp`;
  const optimizedPath = join(parsed.dir, optimizedFilename);
  const temporaryPath = join(parsed.dir, `${parsed.name}.optimized.webp`);

  try {
    await sharp(file.path)
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toFile(temporaryPath);

    await rename(temporaryPath, optimizedPath);
    await unlink(file.path);
    const filename = basename(optimizedPath);
    return {
      filePath: optimizedPath,
      filename,
      contentType: 'image/webp',
      localUrl: `/uploads/${publicDirectory}/${filename}`,
    };
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    console.warn(`Image optimization failed for ${file.filename}`, error);
    return keepOriginal();
  }
};
