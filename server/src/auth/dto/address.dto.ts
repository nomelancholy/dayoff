import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/http/trim.decorator';

export class CreateAddressDto {
  @Trim()
  @IsString({ message: '주소 별칭을 입력해 주세요.' })
  @IsNotEmpty({ message: '주소 별칭을 입력해 주세요.' })
  @MaxLength(50)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @Trim()
  @IsString({ message: '주소를 입력해 주세요.' })
  @IsNotEmpty({ message: '주소를 입력해 주세요.' })
  @MaxLength(200)
  addressLine1: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional()
  @Trim()
  @IsString({ message: '주소 별칭을 입력해 주세요.' })
  @IsNotEmpty({ message: '주소 별칭을 입력해 주세요.' })
  @MaxLength(50)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @Trim()
  @IsString({ message: '주소를 입력해 주세요.' })
  @IsNotEmpty({ message: '주소를 입력해 주세요.' })
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
