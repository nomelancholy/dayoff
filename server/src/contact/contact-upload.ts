import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { basename, extname } from 'path';

export const CONTACT_FILE_MAX_BYTES = 5 * 1024 * 1024;
const FILE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
};
const INVALID_FILE_MESSAGE = 'JPG, PNG, WEBP, PDF 파일만 첨부할 수 있습니다.';

export interface ContactAttachment {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export const contactUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: CONTACT_FILE_MAX_BYTES,
    files: 1,
    fields: 8,
    fieldSize: 24 * 1024,
    parts: 9,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = FILE_TYPES[file.mimetype]?.includes(
      extname(file.originalname).toLowerCase(),
    );
    if (allowed) cb(null, true);
    else cb(new BadRequestException(INVALID_FILE_MESSAGE), false);
  },
};

export function validateContactAttachment(file: ContactAttachment) {
  if (file.size === 0 || file.size > CONTACT_FILE_MAX_BYTES) {
    throw new BadRequestException(
      '첨부파일은 0바이트보다 크고 5MB 이하여야 합니다.',
    );
  }
  const bytes = file.buffer;
  const signatureMatches =
    (file.mimetype === 'image/jpeg' &&
      bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
    (file.mimetype === 'image/png' &&
      bytes
        .subarray(0, 8)
        .equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        )) ||
    (file.mimetype === 'image/webp' &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP') ||
    (file.mimetype === 'application/pdf' &&
      bytes.toString('ascii', 0, 5) === '%PDF-');
  if (!signatureMatches) throw new BadRequestException(INVALID_FILE_MESSAGE);
  return (
    basename(file.originalname.replace(/\\/g, '/'))
      .split('')
      .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
      .join('')
      .slice(-180) || 'attachment'
  );
}
