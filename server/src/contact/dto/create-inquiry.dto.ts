import {
  Equals,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';
import { Trim } from '../../common/http/trim.decorator';

export const CONTACT_CATEGORIES = [
  '상품 문의',
  '주문·배송 문의',
  '클래스 문의',
  '협업·제휴 문의',
  '기타',
] as const;

export class CreateInquiryDto {
  @Trim()
  @IsString()
  @Length(1, 80, { message: '성함은 1~80자로 입력해 주세요.' })
  @Matches(/^[^\r\n]+$/, { message: '성함에 줄바꿈을 사용할 수 없습니다.' })
  name: string;

  @Trim()
  @IsEmail({}, { message: '올바른 이메일 주소를 입력해 주세요.' })
  @MaxLength(254)
  email: string;

  @IsIn(CONTACT_CATEGORIES, { message: '문의 카테고리를 선택해 주세요.' })
  category: string;

  @Trim()
  @IsString()
  @Length(1, 150, { message: '제목은 1~150자로 입력해 주세요.' })
  @Matches(/^[^\r\n]+$/, { message: '제목에 줄바꿈을 사용할 수 없습니다.' })
  subject: string;

  @Trim()
  @IsString()
  @Length(1, 5000, { message: '내용은 1~5,000자로 입력해 주세요.' })
  message: string;

  @Equals('true', {
    message: '문의 처리를 위한 개인정보 수집·이용에 동의해 주세요.',
  })
  privacyConsent: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
