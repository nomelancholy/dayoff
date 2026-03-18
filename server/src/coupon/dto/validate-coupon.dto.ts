import { IsString, IsInt, Min } from 'class-validator';

export class ValidateCouponDto {
  @IsString({ message: '쿠폰 코드를 입력해 주세요.' })
  code!: string;

  @IsInt()
  @Min(0, { message: '주문 금액은 0 이상이어야 합니다.' })
  orderAmount!: number;
}
