import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Trim } from '../../common/http/trim.decorator';

/** 구매평 한 건에 첨부할 수 있는 최대 이미지 수 (업로드 API 한도와 동일) */
export const REVIEW_MAX_IMAGES = 10;

const BODY_MESSAGE = '구매평은 10자 이상 5000자 이하로 작성해 주세요.';
const RATING_MESSAGE = '별점은 1~5 사이로 선택해 주세요.';
const IMAGES_MESSAGE = `사진은 최대 ${REVIEW_MAX_IMAGES}장까지 첨부할 수 있습니다.`;

export class UpdateReviewDto {
  @Trim()
  @IsString({ message: BODY_MESSAGE })
  @IsNotEmpty({ message: BODY_MESSAGE })
  @MinLength(10, { message: BODY_MESSAGE })
  @MaxLength(5000, { message: BODY_MESSAGE })
  body!: string;

  @IsOptional()
  @IsInt({ message: RATING_MESSAGE })
  @Min(1, { message: RATING_MESSAGE })
  @Max(5, { message: RATING_MESSAGE })
  rating?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(REVIEW_MAX_IMAGES, { message: IMAGES_MESSAGE })
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  imageUrls?: string[];
}

export class CreateReviewDto extends UpdateReviewDto {
  @IsUUID(undefined, { message: '주문 상품 정보가 올바르지 않습니다.' })
  orderItemId!: string;
}
