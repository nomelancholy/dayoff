import { IsString, MaxLength, MinLength } from 'class-validator';

export class NaverReviewLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  identifier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
