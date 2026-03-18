import {
  IsString,
  IsIn,
  IsInt,
  Min,
  IsOptional,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export const DISCOUNT_TYPES = ['percent', 'fixed'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export class CreateCouponDto {
  @IsString({ message: '쿠폰 코드를 입력해 주세요.' })
  code!: string;

  @IsIn(DISCOUNT_TYPES, { message: '할인 타입은 percent 또는 fixed 입니다.' })
  discountType!: DiscountType;

  @IsInt()
  @Min(1)
  discountValue!: number; // percent: 1–100, fixed: 원화(정수)

  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderAmount?: number;

  @IsDateString()
  validFrom!: string;

  @IsDateString()
  validUntil!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
