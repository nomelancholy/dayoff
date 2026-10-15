import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/http/trim.decorator';

export class UpdateAdminOrderShipmentDto {
  @Trim()
  @IsString({ message: '송장번호를 입력해 주세요.' })
  @IsNotEmpty({ message: '송장번호를 입력해 주세요.' })
  @MaxLength(100, { message: '송장번호가 너무 깁니다.' })
  trackingNumber!: string;
}
