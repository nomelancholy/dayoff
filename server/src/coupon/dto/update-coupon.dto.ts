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
import {
  COUPON_MAX_AMOUNT,
  DISCOUNT_TYPES,
  type DiscountType,
} from './create-coupon.dto';

export class UpdateCouponDto {
  @IsOptional()
  @Trim()
  @IsString({ message: '쿠폰 코드를 입력해 주세요.' })
  @IsNotEmpty({ message: '쿠폰 코드를 입력해 주세요.' })
  @MaxLength(50, { message: '쿠폰 코드는 50자 이하로 입력해 주세요.' })
  code?: string;

  @IsOptional()
  @IsIn(DISCOUNT_TYPES, { message: '할인 타입은 percent 또는 fixed 입니다.' })
  discountType?: DiscountType;

  @IsOptional()
  @IsInt({ message: '할인 값은 1 이상의 정수여야 합니다.' })
  @Min(1, { message: '할인 값은 1 이상의 정수여야 합니다.' })
  @Max(COUPON_MAX_AMOUNT)
  discountValue?: number;

  // null을 보내면 제한을 해제합니다.
  @IsOptional()
  @IsInt({ message: '최소 주문 금액은 0 이상의 정수여야 합니다.' })
  @Min(0, { message: '최소 주문 금액은 0 이상의 정수여야 합니다.' })
  @Max(COUPON_MAX_AMOUNT)
  minOrderAmount?: number | null;

  @IsOptional()
  @IsDateString({}, { message: '유효 시작일을 입력해 주세요.' })
  validFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: '유효 종료일을 입력해 주세요.' })
  validUntil?: string;

  // null을 보내면 제한을 해제합니다.
  @IsOptional()
  @IsInt({ message: '사용 한도는 1 이상의 정수여야 합니다.' })
  @Min(1, { message: '사용 한도는 1 이상의 정수여야 합니다.' })
  @Max(COUPON_MAX_AMOUNT)
  usageLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
