import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../common/http/trim.decorator';

export class CreateCategoryDto {
  @Trim()
  @IsString({ message: '카테고리 slug를 입력해 주세요.' })
  @IsNotEmpty({ message: '카테고리 slug를 입력해 주세요.' })
  @MaxLength(100)
  slug!: string;

  @Trim()
  @IsString({ message: '카테고리 이름을 입력해 주세요.' })
  @IsNotEmpty({ message: '카테고리 이름을 입력해 주세요.' })
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsInt({ message: '정렬 순서는 정수로 입력해 주세요.' })
  @Min(-100000)
  @Max(100000)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @Trim()
  @IsString({ message: '카테고리 slug를 입력해 주세요.' })
  @IsNotEmpty({ message: '카테고리 slug를 입력해 주세요.' })
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @Trim()
  @IsString({ message: '카테고리 이름을 입력해 주세요.' })
  @IsNotEmpty({ message: '카테고리 이름을 입력해 주세요.' })
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt({ message: '정렬 순서는 정수로 입력해 주세요.' })
  @Min(-100000)
  @Max(100000)
  sortOrder?: number;
}
