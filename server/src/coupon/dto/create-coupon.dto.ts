import {
  IsString,
  IsIn,
  IsInt,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Trim } from '../../common/http/trim.decorator';

export const DISCOUNT_TYPES = ['percent', 'fixed'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

// Postgres integer 컬럼 범위를 넘는 값이 저장 오류(500)로 이어지지 않도록 하는 상한
export const COUPON_MAX_AMOUNT = 2_000_000_000;

export class CreateCouponDto {
  @Trim()
  @IsString({ message: '쿠폰 코드를 입력해 주세요.' })
  @IsNotEmpty({ message: '쿠폰 코드를 입력해 주세요.' })
  @MaxLength(50, { message: '쿠폰 코드는 50자 이하로 입력해 주세요.' })
  code!: string;

  @IsIn(DISCOUNT_TYPES, { message: '할인 타입은 percent 또는 fixed 입니다.' })
  discountType!: DiscountType;

  @IsInt({ message: '할인 값은 1 이상의 정수여야 합니다.' })
  @Min(1, { message: '할인 값은 1 이상의 정수여야 합니다.' })
  @Max(COUPON_MAX_AMOUNT)
  discountValue!: number; // percent: 1–100, fixed: 원화(정수)

  @IsOptional()
  @IsInt({ message: '최소 주문 금액은 0 이상의 정수여야 합니다.' })
  @Min(0, { message: '최소 주문 금액은 0 이상의 정수여야 합니다.' })
  @Max(COUPON_MAX_AMOUNT)
  minOrderAmount?: number | null;

  @IsDateString({}, { message: '유효 시작일을 입력해 주세요.' })
  validFrom!: string;

  @IsDateString({}, { message: '유효 종료일을 입력해 주세요.' })
  validUntil!: string;

  @IsOptional()
  @IsInt({ message: '사용 한도는 1 이상의 정수여야 합니다.' })
  @Min(1, { message: '사용 한도는 1 이상의 정수여야 합니다.' })
  @Max(COUPON_MAX_AMOUNT)
  usageLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
