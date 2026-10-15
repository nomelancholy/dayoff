import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
