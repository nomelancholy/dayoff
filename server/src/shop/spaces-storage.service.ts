import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { stat, unlink } from 'fs/promises';
import { resolve, sep } from 'path';
import type { Multer } from 'multer';
import {
  optimizeUploadedImage,
  type PreparedUploadedImage,
} from './image-optimizer';

type MediaDirectory = 'product' | 'review';

type SpacesConfig = {
  region: string;
  bucket: string;
  endpoint: string;
  publicBaseUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
};

@Injectable()
export class SpacesStorageService {
  private readonly logger = new Logger(SpacesStorageService.name);
  private client: S3Client | null = null;

  constructor(private readonly configService: ConfigService) {}

  private env(key: string): string | undefined {
    const value = this.configService.get<string>(key)?.trim();
    return value || undefined;
  }

  isEnabled(): boolean {
    if (this.env('SPACES_ENABLED') === 'false') return false;
    return Boolean(
      this.env('SPACES_ENABLED') === 'true' ||
      this.env('SPACES_ACCESS_KEY_ID') ||
      this.env('SPACES_SECRET_ACCESS_KEY'),
    );
  }

  getConfigurationStatus() {
    const requiredKeys = [
      'SPACES_REGION',
      'SPACES_BUCKET',
      'SPACES_ACCESS_KEY_ID',
      'SPACES_SECRET_ACCESS_KEY',
    ];
    const missingKeys = requiredKeys.filter((key) => !this.env(key));
    const region = this.env('SPACES_REGION') ?? null;
    const bucket = this.env('SPACES_BUCKET') ?? null;

    return {
      driver: this.isEnabled() ? 'spaces' : 'local',
      configured: this.isEnabled() && missingKeys.length === 0,
      region,
      bucket,
      publicBaseUrl:
        this.env('SPACES_CDN_URL')?.replace(/\/+$/, '') ??
        (region && bucket
          ? `https://${bucket}.${region}.digitaloceanspaces.com`
          : null),
      missingKeys: this.isEnabled() ? missingKeys : [],
    };
  }

  private getConfig(): SpacesConfig {
    const region = this.env('SPACES_REGION');
    const bucket = this.env('SPACES_BUCKET');
    const accessKeyId = this.env('SPACES_ACCESS_KEY_ID');
    const secretAccessKey = this.env('SPACES_SECRET_ACCESS_KEY');
    const missingKeys = [
      ['SPACES_REGION', region],
      ['SPACES_BUCKET', bucket],
      ['SPACES_ACCESS_KEY_ID', accessKeyId],
      ['SPACES_SECRET_ACCESS_KEY', secretAccessKey],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (!region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new BadRequestException(
        `Spaces 환경설정이 부족합니다: ${missingKeys.join(', ')}`,
      );
    }

    return {
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      endpoint:
        this.env('SPACES_ENDPOINT') ??
        `https://${region}.digitaloceanspaces.com`,
      publicBaseUrl: (
        this.env('SPACES_CDN_URL') ??
        `https://${bucket}.${region}.digitaloceanspaces.com`
      ).replace(/\/+$/, ''),
    };
  }

  private getClient(config: SpacesConfig): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        forcePathStyle: false,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
    }
    return this.client;
  }

  async storeUploadedImage(
    file: Multer.File,
    options: { publicDirectory: MediaDirectory; maxWidth: number },
  ): Promise<string> {
    const prepared = await optimizeUploadedImage(file, options);
    if (!this.isEnabled()) return prepared.localUrl;

    try {
      return await this.uploadPreparedImage(prepared, options.publicDirectory);
    } finally {
      await unlink(prepared.filePath).catch(() => undefined);
    }
  }

  private async uploadPreparedImage(
    prepared: PreparedUploadedImage,
    directory: MediaDirectory,
  ): Promise<string> {
    const config = this.getConfig();
    const key = `${directory}/${prepared.filename}`;

    try {
      const fileStat = await stat(prepared.filePath);
      await this.getClient(config).send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: createReadStream(prepared.filePath),
          ContentLength: fileStat.size,
          ContentType: prepared.contentType,
          CacheControl: 'public, max-age=31536000, immutable',
          ACL: 'public-read',
        }),
      );
    } catch (error) {
      this.logger.error(
        `Spaces 이미지 업로드 실패: key=${key}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadGatewayException(
        '이미지 저장소 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }

    const encodedKey = key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${config.publicBaseUrl}/${encodedKey}`;
  }

  async deleteStoredUrls(urls: Array<string | null | undefined>) {
    const uniqueUrls = [...new Set(urls.filter((url): url is string => !!url))];
    if (uniqueUrls.length === 0) return;

    await this.deleteLocalUrls(uniqueUrls);
    if (!this.isEnabled()) return;

    let config: SpacesConfig;
    try {
      config = this.getConfig();
    } catch (error) {
      this.logger.warn(
        `Spaces 이미지 정리 생략: ${error instanceof Error ? error.message : '환경설정 오류'}`,
      );
      return;
    }

    const keys = uniqueUrls
      .map((url) => this.spacesKeyFromUrl(url, config))
      .filter((key): key is string => !!key);
    if (keys.length === 0) return;

    const uniqueKeys = [...new Set(keys)];
    try {
      // S3 DeleteObjects는 한 요청에 최대 1,000개까지 허용합니다.
      for (let index = 0; index < uniqueKeys.length; index += 1000) {
        await this.getClient(config).send(
          new DeleteObjectsCommand({
            Bucket: config.bucket,
            Delete: {
              Quiet: true,
              Objects: uniqueKeys
                .slice(index, index + 1000)
                .map((Key) => ({ Key })),
            },
          }),
        );
      }
    } catch (error) {
      // DB 변경은 이미 완료되었으므로 사용자 요청을 실패시키지 않고 운영 로그로 남깁니다.
      this.logger.error(
        `Spaces 이미지 정리 실패: keys=${uniqueKeys.length}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private spacesKeyFromUrl(url: string, config: SpacesConfig): string | null {
    try {
      const parsed = new URL(url);
      const allowedHosts = new Set([
        new URL(config.publicBaseUrl).host,
        `${config.bucket}.${config.region}.digitaloceanspaces.com`,
      ]);
      if (!allowedHosts.has(parsed.host)) return null;
      const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
      return key || null;
    } catch {
      return null;
    }
  }

  private async deleteLocalUrls(urls: string[]) {
    const uploadsRoot = resolve(process.cwd(), 'uploads');

    for (const url of urls) {
      try {
        const pathname = new URL(url, 'http://local').pathname;
        if (!pathname.startsWith('/uploads/')) continue;
        const relativePath = decodeURIComponent(
          pathname.slice('/uploads/'.length),
        );
        const targetPath = resolve(uploadsRoot, relativePath);
        if (
          targetPath !== uploadsRoot &&
          !targetPath.startsWith(`${uploadsRoot}${sep}`)
        ) {
          continue;
        }
        await unlink(targetPath).catch(() => undefined);
      } catch {
        // 잘못된 외부 URL은 이 저장소가 소유하지 않으므로 무시합니다.
      }
    }
  }
}
