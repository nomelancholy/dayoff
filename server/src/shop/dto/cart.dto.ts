import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** 장바구니 한 줄에 담을 수 있는 최대 수량 */
export const CART_MAX_QUANTITY = 999;

const QUANTITY_MESSAGE = '수량은 1 이상의 정수로 입력해 주세요.';
const QUANTITY_MAX_MESSAGE = `수량은 ${CART_MAX_QUANTITY}개까지 담을 수 있습니다.`;

export class AddToCartDto {
  @IsUUID(undefined, { message: '상품 정보가 올바르지 않습니다.' })
  productId!: string;

  @IsInt({ message: QUANTITY_MESSAGE })
  @Min(1, { message: QUANTITY_MESSAGE })
  @Max(CART_MAX_QUANTITY, { message: QUANTITY_MAX_MESSAGE })
  quantity!: number;

  @IsOptional()
  @IsUUID(undefined, { message: '옵션 정보가 올바르지 않습니다.' })
  optionId?: string | null;
}

export class UpdateCartItemDto {
  @IsInt({ message: QUANTITY_MESSAGE })
  @Min(1, { message: QUANTITY_MESSAGE })
  @Max(CART_MAX_QUANTITY, { message: QUANTITY_MAX_MESSAGE })
  quantity!: number;
}
