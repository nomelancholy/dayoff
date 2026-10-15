import { IsString, IsInt, Max, MaxLength, Min } from 'class-validator';
import { COUPON_MAX_AMOUNT } from './create-coupon.dto';

export class ValidateCouponDto {
  @IsString({ message: '쿠폰 코드를 입력해 주세요.' })
  @MaxLength(100)
  code!: string;

  @IsInt({ message: '주문 금액은 0 이상이어야 합니다.' })
  @Min(0, { message: '주문 금액은 0 이상이어야 합니다.' })
  @Max(COUPON_MAX_AMOUNT)
  orderAmount!: number;
}
