import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Req,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import type { Multer } from 'multer';
import { ShopService } from './shop.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserRow } from '../auth/auth.service';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

class CreateTossCheckoutDto {
  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsString()
  shippingAddressId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  cartItemIds!: string[];

  // 상품 상세 "구매하기"처럼 장바구니에 이미 같은 상품이 merge 되어 있을 때
  // 실제 결제/주문에 사용할 수량을 지정하기 위해 사용합니다.
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  cartItemQuantities?: number[];
}

class ConfirmTossPaymentDto {
  @IsString()
  paymentKey!: string;

  // Toss 요청 시 전달했던 orderId (우리는 orders.order_number 사용)
  @IsString()
  orderId!: string;

  @IsInt()
  @Min(0)
  amount!: number;
}

class UpdateAdminOrderShipmentDto {
  @IsString()
  @IsNotEmpty()
  trackingNumber!: string;
}

class UpdateReviewDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}

const getBaseUrl = (req: Request): string => {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost:4000';
  return `${protocol}://${host}`;
};

@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('categories')
  async getCategories() {
    return this.shopService.getCategories();
  }

  /** [Admin] 카테고리 생성 */
  @Post('admin/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createCategory(
    @Body() body: { slug: string; name: string; sortOrder?: number },
  ) {
    return this.shopService.createCategory(body);
  }

  /** [Admin] 카테고리 수정 */
  @Patch('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateCategory(
    @Param('id') id: string,
    @Body() body: { slug?: string; name?: string; sortOrder?: number },
  ) {
    return this.shopService.updateCategory(id, body);
  }

  /** [Admin] 카테고리 삭제 */
  @Delete('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteCategory(@Param('id') id: string) {
    return this.shopService.deleteCategory(id);
  }

  @Get('products')
  async getProducts(@Query('categoryId') categoryId?: string) {
    return this.shopService.getProducts(categoryId);
  }

  @Get('products/:slugOrId')
  async getProduct(@Param('slugOrId') slugOrId: string) {
    return this.shopService.getProduct(slugOrId);
  }

  /** 구매평용 이미지 업로드 (로그인 사용자, multipart/form-data, field name: files) */
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadReviewImages(
    @Req() req: Request,
    @UploadedFiles() files: Multer.File[],
  ) {
    if (!files?.length) return { urls: [] };
    const base = getBaseUrl(req);
    const urls = files.map((f) => `${base}/uploads/review/${f.filename}`);
    return { urls };
  }

  @Post('products/:id/reviews')
  @UseGuards(JwtAuthGuard)
  async createReview(
    @CurrentUser() user: UserRow,
    @Param('id') productId: string,
    @Body() body: { body: string; rating?: number; imageUrls?: string[]; orderItemId: string },
  ) {
    return this.shopService.createReview(user.id, productId, body);
  }

  /** 내가 작성한 구매평 목록 (Order History에서 리뷰 표시/작성용) */
  @Get('my-reviews')
  @UseGuards(JwtAuthGuard)
  async getMyReviews(@CurrentUser() user: UserRow) {
    return this.shopService.getMyReviews(user.id);
  }

  /** 내 구매평 수정 */
  @Patch('my-reviews/:id')
  @UseGuards(JwtAuthGuard)
  async updateMyReview(
    @CurrentUser() user: UserRow,
    @Param('id') id: string,
    @Body() body: UpdateReviewDto,
  ) {
    return this.shopService.updateMyReview(user.id, id, body);
  }

  /** 내 구매평 삭제 */
  @Delete('my-reviews/:id')
  @UseGuards(JwtAuthGuard)
  async deleteMyReview(@CurrentUser() user: UserRow, @Param('id') id: string) {
    return this.shopService.deleteMyReview(user.id, id);
  }

  /** [Admin] 구매평 목록 */
  @Get('admin/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getAdminReviews() {
    return this.shopService.getAdminReviews();
  }

  /** [Admin] 구매평 수정 */
  @Patch('admin/reviews/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateAdminReview(
    @Param('id') id: string,
    @Body() body: UpdateReviewDto,
  ) {
    return this.shopService.updateAdminReview(id, body);
  }

  /** [Admin] 구매평 삭제 */
  @Delete('admin/reviews/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteAdminReview(@Param('id') id: string) {
    return this.shopService.deleteAdminReview(id);
  }

  /** 내 주문 목록 (Order History) */
  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async getMyOrders(@CurrentUser() user: UserRow) {
    return this.shopService.getMyOrders(user.id);
  }

  @Get('cart')
  @UseGuards(JwtAuthGuard)
  async getCartItems(@CurrentUser() user: UserRow) {
    return this.shopService.getCartItems(user.id);
  }

  @Post('cart')
  @UseGuards(JwtAuthGuard)
  async addToCart(
    @CurrentUser() user: UserRow,
    @Body() body: { productId: string; quantity: number; optionId?: string },
  ) {
    return this.shopService.addToCart(
      user.id,
      body.productId,
      body.quantity,
      body.optionId,
    );
  }

  @Patch('cart/:id')
  @UseGuards(JwtAuthGuard)
  async updateCartItem(
    @CurrentUser() user: UserRow,
    @Param('id') id: string,
    @Body('quantity') quantity: number,
  ) {
    return this.shopService.updateCartItemQuantity(user.id, id, quantity);
  }

  @Delete('cart/:id')
  @UseGuards(JwtAuthGuard)
  async removeFromCart(@CurrentUser() user: UserRow, @Param('id') id: string) {
    return this.shopService.removeFromCart(user.id, id);
  }

  /** Toss Payments: 체크아웃 주문 생성 (결제 요청 직전 pending 상태 생성) */
  @Post('checkout/toss')
  @UseGuards(JwtAuthGuard)
  async createTossCheckout(
    @CurrentUser() user: UserRow,
    @Body() dto: CreateTossCheckoutDto,
  ) {
    return this.shopService.createTossCheckoutOrder(
      user.id,
      dto.couponCode ?? null,
      dto.cartItemIds,
      dto.cartItemQuantities,
      dto.shippingAddressId,
    );
  }

  /** Toss Payments: 결제 승인 검증 + 주문 paid 처리 */
  @Post('checkout/toss/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmTossPayment(
    @CurrentUser() user: UserRow,
    @Body() dto: ConfirmTossPaymentDto,
  ) {
    return this.shopService.confirmTossPaymentAndFinalizeOrder(user.id, {
      paymentKey: dto.paymentKey,
      orderId: dto.orderId,
      amount: dto.amount,
    });
  }

  /** [Admin] 상품 이미지 업로드 (multipart/form-data, field: files) → uploads/product */
  @Post('admin/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: diskStorage({
        destination: './uploads/product',
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname) || '.jpg';
          cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`);
        },
      }),
      // 상세 이미지가 긴 원본일 수 있어 관리자 업로드 한도를 30MB로 상향
      limits: { fileSize: 30 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = /^image\/(jpeg|png|gif|webp)$/;
        if (allowed.test(file.mimetype)) cb(null, true);
        else
          cb(
            new Error('이미지 파일만 업로드 가능합니다 (jpg, png, gif, webp).'),
            false,
          );
      },
    }),
  )
  async uploadProductImages(
    @Req() req: Request,
    @UploadedFiles() files: Multer.File[],
  ) {
    if (!files?.length) return { urls: [] };
    const base = getBaseUrl(req);
    const urls = files.map((f) => `${base}/uploads/product/${f.filename}`);
    return { urls };
  }

  /** [Admin] 상품 생성 */
  @Post('admin/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createProduct(@Body() body: any) {
    return this.shopService.createProduct(body);
  }

  /** [Admin] 상품 수정 */
  @Patch('admin/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateProduct(@Param('id') id: string, @Body() body: any) {
    return this.shopService.updateProduct(id, body);
  }

  /** [Admin] 상품 삭제 */
  @Delete('admin/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteProduct(@Param('id') id: string) {
    return this.shopService.deleteProduct(id);
  }

  /** [Admin] 주문 목록 조회 */
  @Get('admin/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getAdminOrders(@Query('status') status?: string) {
    return this.shopService.getAdminOrders({ status });
  }

  /** [Admin] 송장번호 입력 후 발송 완료(shipped) 처리 */
  @Patch('admin/orders/:id/shipment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateAdminOrderShipment(
    @Param('id') id: string,
    @Body() dto: UpdateAdminOrderShipmentDto,
  ) {
    return this.shopService.updateAdminOrderShipment(id, dto.trackingNumber);
  }

  /** [Admin] pending 주문(초안) 일괄 삭제 */
  @Delete('admin/orders/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteAdminPendingOrders() {
    return this.shopService.deleteAdminPendingOrders();
  }
}
