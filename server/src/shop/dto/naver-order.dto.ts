import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AddToCartDto } from './cart.dto';

export class RegisterNaverOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AddToCartDto)
  items!: AddToCartDto[];

  // URL 자체를 받지 않고 출발 화면만 받아 서버의 상품 slug로 복귀 주소를 구성합니다.
  @IsOptional()
  @IsIn(['product', 'cart'])
  source?: 'product' | 'cart';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  naverInflowCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cpaInflowCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  saClickId?: string;
}
