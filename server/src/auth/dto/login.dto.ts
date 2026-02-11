import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1, { message: '비밀번호를 입력해 주세요.' })
  password: string;
}
