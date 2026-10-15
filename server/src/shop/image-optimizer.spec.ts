import { BadRequestException } from '@nestjs/common';
import { mkdtemp, readdir, rm, writeFile } from 'fs/promises';
import type { Multer } from 'multer';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { optimizeUploadedImage } from './image-optimizer';

describe('optimizeUploadedImage', () => {
  let directory: string;

  const upload = async (
    filename: string,
    content: Buffer,
    mimetype: string,
  ) => {
    const path = join(directory, filename);
    await writeFile(path, content);
    return { path, filename, mimetype } as Multer.File;
  };
  const image = (format: 'png' | 'gif') =>
    sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: 10, g: 120, b: 200 },
      },
    })
      [format]()
      .toBuffer();

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'dayoff-upload-'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });

  it('이미지가 아닌 파일은 MIME을 속여도 거부하고 파일을 지운다', async () => {
    const file = await upload(
      '1-abc.png',
      Buffer.from('<script>alert(1)</script>'),
      'image/png',
    );

    await expect(
      optimizeUploadedImage(file, {
        publicDirectory: 'review',
        maxWidth: 1600,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await readdir(directory)).toEqual([]);
  });

  it('SVG처럼 허용하지 않는 이미지 형식도 거부한다', async () => {
    const file = await upload(
      '1-abc.png',
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><script>alert(1)</script></svg>',
      ),
      'image/png',
    );

    await expect(
      optimizeUploadedImage(file, {
        publicDirectory: 'review',
        maxWidth: 1600,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await readdir(directory)).toEqual([]);
  });

  it('정상 이미지는 WebP로 변환하고 원본을 남기지 않는다', async () => {
    const file = await upload('1-abc.png', await image('png'), 'image/png');

    const prepared = await optimizeUploadedImage(file, {
      publicDirectory: 'product',
      maxWidth: 1800,
    });

    expect(prepared).toMatchObject({
      filename: '1-abc-optimized.webp',
      contentType: 'image/webp',
      localUrl: '/uploads/product/1-abc-optimized.webp',
    });
    expect(await readdir(directory)).toEqual(['1-abc-optimized.webp']);
    expect((await sharp(prepared.filePath).metadata()).format).toBe('webp');
  });

  it('GIF는 원본을 유지하되 확장자는 실제 형식에 맞춘다', async () => {
    const file = await upload('1-abc.html', await image('gif'), 'image/png');

    const prepared = await optimizeUploadedImage(file, {
      publicDirectory: 'review',
      maxWidth: 1600,
    });

    expect(prepared).toMatchObject({
      filename: '1-abc.gif',
      contentType: 'image/gif',
      localUrl: '/uploads/review/1-abc.gif',
    });
    expect(await readdir(directory)).toEqual(['1-abc.gif']);
  });
});
