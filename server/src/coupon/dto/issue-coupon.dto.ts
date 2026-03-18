import { IsUUID } from 'class-validator';

export class IssueCouponDto {
  @IsUUID('4', { message: '올바른 사용자 ID를 입력해 주세요.' })
  userId!: string;
}
