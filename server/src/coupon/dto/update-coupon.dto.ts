import {
  IsString,
  IsIn,
  IsInt,
  Min,
  IsOptional,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { DISCOUNT_TYPES, type DiscountType } from './create-coupon.dto';

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsIn(DISCOUNT_TYPES)
  discountType?: DiscountType;

  @IsOptional()
  @IsInt()
  @Min(1)
  discountValue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderAmount?: number | null;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
