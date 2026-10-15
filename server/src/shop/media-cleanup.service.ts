import { Inject, Injectable, Logger } from '@nestjs/common';
import { like } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../common/database/database.module';
import * as schema from '../db/schema';
import { SpacesStorageService } from './spaces-storage.service';
import type { MediaDirectory } from './upload.config';

@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly spacesStorageService: SpacesStorageService,
  ) {}

  /**
   * DB 변경이 끝난 뒤, 더 이상 어디에서도 쓰지 않는 업로드 이미지만 저장소에서 지웁니다.
   * - 다른 상품·구매평이 같은 파일을 쓰고 있으면 지우지 않습니다.
   * - 지정한 폴더(product/review) 밖의 주소나 외부 주소는 건드리지 않습니다.
   * 정리는 부가 작업이므로 실패해도 요청을 실패시키지 않습니다.
   */
  async removeUnreferenced(
    urls: Array<string | null | undefined>,
    directory: MediaDirectory,
  ): Promise<void> {
    try {
      const referencedByKey = new Map<string, boolean>();
      const deletable: string[] = [];

      for (const url of new Set(urls)) {
        if (!url) continue;
        const key = this.spacesStorageService.storageKeyFromUrl(url, directory);
        if (!key) continue;
        if (!referencedByKey.has(key)) {
          referencedByKey.set(key, await this.isReferenced(key));
        }
        if (!referencedByKey.get(key)) deletable.push(url);
      }

      if (deletable.length > 0) {
        await this.spacesStorageService.deleteStoredUrls(deletable, {
          directory,
        });
      }
    } catch (error) {
      this.logger.error(
        `이미지 정리 실패: directory=${directory}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** 같은 저장소 키로 끝나는 주소를 가진 이미지 행이 남아 있는지 확인합니다. */
  private async isReferenced(key: string): Promise<boolean> {
    const pattern = `%/${key.replace(/[\\%_]/g, '\\$&')}`;
    const [productImage, detailImage, reviewImage] = await Promise.all([
      this.db
        .select({ id: schema.productImages.id })
        .from(schema.productImages)
        .where(like(schema.productImages.url, pattern))
        .limit(1),
      this.db
        .select({ id: schema.productDetailImages.id })
        .from(schema.productDetailImages)
        .where(like(schema.productDetailImages.url, pattern))
        .limit(1),
      this.db
        .select({ id: schema.productReviewImages.id })
        .from(schema.productReviewImages)
        .where(like(schema.productReviewImages.url, pattern))
        .limit(1),
    ]);
    return (
      productImage.length > 0 ||
      detailImage.length > 0 ||
      reviewImage.length > 0
    );
  }
}
