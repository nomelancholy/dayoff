import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CART_MAX_QUANTITY } from './cart.dto';

export class CreateNaverCheckoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  couponCode?: string | null;

  // 프론트의 오류 안내가 이 검증 메시지(`shippingAddressId must be a string`)를 기준으로
  // "배송지를 다시 선택" 안내를 띄우므로 IsString 기본 메시지를 유지합니다.
  @IsString()
  @IsUUID(undefined, { message: '배송지를 선택해 주세요.' })
  shippingAddressId!: string;

  @IsArray()
  @ArrayNotEmpty({ message: '선택한 상품이 없습니다.' })
  @ArrayMaxSize(100)
  @ArrayUnique({ message: '같은 장바구니 상품이 중복 선택되었습니다.' })
  @IsUUID(undefined, {
    each: true,
    message: '장바구니 상품 정보가 올바르지 않습니다.',
  })
  cartItemIds!: string[];

  // 상품 상세 "구매하기"처럼 장바구니에 이미 같은 상품이 merge 되어 있을 때
  // 실제 결제/주문에 사용할 수량을 지정하기 위해 사용합니다.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true, message: '구매 수량은 1 이상의 정수여야 합니다.' })
  @Min(1, { each: true, message: '구매 수량은 1 이상의 정수여야 합니다.' })
  @Max(CART_MAX_QUANTITY, { each: true })
  cartItemQuantities?: number[];
}

export class ConfirmNaverPaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  paymentId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  merchantPayKey!: string;
}
