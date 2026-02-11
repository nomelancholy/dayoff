import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  /** 비밀번호 변경 시 현재 비밀번호 (이메일 로그인만) */
  @IsOptional()
  @IsString()
  currentPassword?: string;

  /** 새 비밀번호 (8자 이상, currentPassword와 함께 전달) */
  @IsOptional()
  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  newPassword?: string;
}
