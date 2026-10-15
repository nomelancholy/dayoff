import { Module } from '@nestjs/common';
import { MediaCleanupService } from './media-cleanup.service';
import { SpacesStorageService } from './spaces-storage.service';

/** 이미지 저장소(로컬/Spaces)와 정리 로직. 상품·구매평·회원 탈퇴에서 함께 사용합니다. */
@Module({
  providers: [SpacesStorageService, MediaCleanupService],
  exports: [SpacesStorageService, MediaCleanupService],
})
export class StorageModule {}
