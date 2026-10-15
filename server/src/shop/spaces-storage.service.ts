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
import type { MediaDirectory } from './upload.config';

// 업로드 시 서버가 만드는 파일명 형태(타임스탬프-난수.확장자)만 저장소 키로 인정합니다.
const STORED_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_URL_LENGTH = 2048;

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

  /**
   * 이미지 URL에서 저장소 키(`product/파일명`, `review/파일명`)를 얻습니다.
   * 호스트는 보지 않으므로 "같은 파일을 가리키는 다른 행이 있는지" 확인하는 용도로 씁니다.
   */
  storageKeyFromUrl(url: string, directory: MediaDirectory): string | null {
    if (typeof url !== 'string' || !url || url.length > MAX_URL_LENGTH) {
      return null;
    }
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(url, 'http://local').pathname);
    } catch {
      return null;
    }
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] === 'uploads') segments.shift();
    if (segments.length !== 2 || segments[0] !== directory) return null;
    if (!STORED_FILENAME_PATTERN.test(segments[1])) return null;
    return `${directory}/${segments[1]}`;
  }

  /**
   * 사용자가 보낸 이미지 주소가 이 서버가 해당 폴더에 저장한 파일인지 확인하고,
   * 맞으면 저장에 사용할 정규화된 주소를 돌려줍니다. 아니면 null.
   * (임의의 외부 주소나 다른 폴더의 파일을 구매평에 붙이는 것을 막습니다.)
   */
  async resolveUploadedUrl(
    url: string,
    directory: MediaDirectory,
    baseUrl: string,
  ): Promise<string | null> {
    if (typeof url !== 'string' || !url || url.length > MAX_URL_LENGTH) {
      return null;
    }

    if (this.isEnabled()) {
      let config: SpacesConfig | null = null;
      try {
        config = this.getConfig();
      } catch {
        config = null;
      }
      const spacesKey = config ? this.spacesKeyFromUrl(url, config) : null;
      if (config && spacesKey) {
        return this.isKeyInDirectory(spacesKey, directory)
          ? `${config.publicBaseUrl}/${this.encodeKey(spacesKey)}`
          : null;
      }
    }

    const localKey = this.localKeyFromUrl(url, directory);
    if (!localKey) return null;
    const fileStat = await stat(resolve(this.uploadsRoot(), localKey)).catch(
      () => null,
    );
    if (!fileStat?.isFile()) return null;
    return `${baseUrl.replace(/\/+$/, '')}/uploads/${this.encodeKey(localKey)}`;
  }

  /**
   * 저장소에서 이미지를 삭제합니다. 지정한 폴더(product/review)의 파일만 지우므로
   * 다른 폴더를 가리키는 주소가 섞여 있어도 삭제되지 않습니다.
   */
  async deleteStoredUrls(
    urls: Array<string | null | undefined>,
    options: { directory: MediaDirectory },
  ) {
    const { directory } = options;
    const uniqueUrls = [...new Set(urls.filter((url): url is string => !!url))];
    if (uniqueUrls.length === 0) return;

    await this.deleteLocalUrls(uniqueUrls, directory);
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
      .filter(
        (key): key is string => !!key && this.isKeyInDirectory(key, directory),
      );
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

  private uploadsRoot(): string {
    return resolve(process.cwd(), 'uploads');
  }

  private encodeKey(key: string): string {
    return key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  private isKeyInDirectory(key: string, directory: MediaDirectory): boolean {
    const segments = key.split('/');
    return (
      segments.length === 2 &&
      segments[0] === directory &&
      STORED_FILENAME_PATTERN.test(segments[1])
    );
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

  /** 로컬 업로드 주소(`/uploads/<폴더>/<파일명>`)에서 저장소 키를 얻습니다. */
  private localKeyFromUrl(
    url: string,
    directory: MediaDirectory,
  ): string | null {
    try {
      const pathname = decodeURIComponent(
        new URL(url, 'http://local').pathname,
      );
      if (!pathname.startsWith('/uploads/')) return null;
      const key = pathname.slice('/uploads/'.length);
      return this.isKeyInDirectory(key, directory) ? key : null;
    } catch {
      // 잘못된 외부 URL은 이 저장소가 소유하지 않으므로 무시합니다.
      return null;
    }
  }

  private async deleteLocalUrls(urls: string[], directory: MediaDirectory) {
    const uploadsRoot = this.uploadsRoot();

    for (const url of urls) {
      const key = this.localKeyFromUrl(url, directory);
      if (!key) continue;
      const targetPath = resolve(uploadsRoot, key);
      if (!targetPath.startsWith(`${uploadsRoot}${sep}`)) continue;
      await unlink(targetPath).catch(() => undefined);
    }
  }
}
