import { basename, extname, join, parse } from 'path';
import { rename, unlink } from 'fs/promises';
import sharp from 'sharp';
import type { Multer } from 'multer';

type OptimizeUploadedImageOptions = {
  publicDirectory: 'product' | 'review';
  maxWidth: number;
};

export type PreparedUploadedImage = {
  filePath: string;
  filename: string;
  contentType: string;
  localUrl: string;
};

/**
 * 업로드 원본을 브라우저 전송용 WebP로 변환합니다.
 * GIF는 애니메이션 손실을 피하기 위해 원본을 유지합니다.
 * 변환 실패 시에도 업로드 자체는 사용할 수 있도록 원본 URL로 폴백합니다.
 */
export const optimizeUploadedImage = async (
  file: Multer.File,
  { publicDirectory, maxWidth }: OptimizeUploadedImageOptions,
): Promise<PreparedUploadedImage> => {
  const originalUrl = `/uploads/${publicDirectory}/${file.filename}`;
  if (extname(file.filename).toLowerCase() === '.gif') {
    return {
      filePath: file.path,
      filename: file.filename,
      contentType: 'image/gif',
      localUrl: originalUrl,
    };
  }

  const parsed = parse(file.path);
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
    return {
      filePath: file.path,
      filename: file.filename,
      contentType: file.mimetype || 'application/octet-stream',
      localUrl: originalUrl,
    };
  }
};
