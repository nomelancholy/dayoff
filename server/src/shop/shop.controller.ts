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
import { unlink } from 'fs/promises';
import type { Request } from 'express';
import type { Multer } from 'multer';
import { ShopService } from './shop.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserRow } from '../auth/auth.service';
import { UuidParam } from '../common/http/uuid-param.pipe';
import { SpacesStorageService } from './spaces-storage.service';
import { imageUploadOptions, type MediaDirectory } from './upload.config';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';
import {
  ConfirmNaverPaymentDto,
  CreateNaverCheckoutDto,
} from './dto/checkout.dto';
import { UpdateAdminOrderShipmentDto } from './dto/order.dto';

const getBaseUrl = (req: Request): string => {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost:4000';
  return `${protocol}://${host}`;
};

@Controller('shop')
export class ShopController {
  constructor(
    private readonly shopService: ShopService,
    private readonly spacesStorageService: SpacesStorageService,
  ) {}

  @Get('categories')
  async getCategories() {
    return this.shopService.getCategories();
  }

  /** [Admin] 카테고리 생성 */
  @Post('admin/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.shopService.createCategory(dto);
  }

  /** [Admin] 카테고리 수정 */
  @Patch('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateCategory(
    @Param('id', UuidParam) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.shopService.updateCategory(id, dto);
  }

  /** [Admin] 카테고리 삭제 */
  @Delete('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteCategory(@Param('id', UuidParam) id: string) {
    return this.shopService.deleteCategory(id);
  }

  /** [Admin] 네이버페이 운영 설정 점검 (인증값 자체는 반환하지 않음) */
  @Get('admin/naver-pay/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getNaverPayStatus() {
    return this.shopService.getNaverPayStatus();
  }

  /** [Admin] 이미지 저장소 설정 점검 (인증값 자체는 반환하지 않음) */
  @Get('admin/storage/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getStorageStatus() {
    return this.spacesStorageService.getConfigurationStatus();
  }

  @Get('products')
  async getProducts(@Query('categoryId') categoryId?: string) {
    return this.shopService.getProducts(categoryId);
  }

  @Get('products/:slugOrId')
  async getProduct(@Param('slugOrId') slugOrId: string) {
    return this.shopService.getProduct(slugOrId);
  }

  @Get('products/:id/restock-notifications/me')
  @UseGuards(JwtAuthGuard)
  async getMyRestockNotificationStatus(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) productId: string,
  ) {
    return this.shopService.hasMyRestockSubscription(user.id, productId);
  }

  @Post('products/:id/restock-notifications')
  @UseGuards(JwtAuthGuard)
  async subscribeRestockNotification(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) productId: string,
  ) {
    return this.shopService.subscribeRestockNotification(user.id, productId);
  }

  /** 구매평용 이미지 업로드 (로그인 사용자, multipart/form-data, field name: files) */
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 10, imageUploadOptions('review')))
  async uploadReviewImages(
    @Req() req: Request,
    @UploadedFiles() files: Multer.File[],
  ) {
    return this.storeUploadedImages(req, files, 'review', 1600);
  }

  @Post('products/:id/reviews')
  @UseGuards(JwtAuthGuard)
  async createReview(
    @Req() req: Request,
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) productId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.shopService.createReview(
      user.id,
      productId,
      dto,
      getBaseUrl(req),
    );
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
    @Req() req: Request,
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.shopService.updateMyReview(user.id, id, dto, getBaseUrl(req));
  }

  /** 내 구매평 삭제 */
  @Delete('my-reviews/:id')
  @UseGuards(JwtAuthGuard)
  async deleteMyReview(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string,
  ) {
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
    @Req() req: Request,
    @Param('id', UuidParam) id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.shopService.updateAdminReview(id, dto, getBaseUrl(req));
  }

  /** [Admin] 구매평 삭제 */
  @Delete('admin/reviews/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteAdminReview(@Param('id', UuidParam) id: string) {
    return this.shopService.deleteAdminReview(id);
  }

  /** 내 주문 목록 (Order History) */
  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async getMyOrders(@CurrentUser() user: UserRow) {
    return this.shopService.getMyOrders(user.id);
  }

  /** 내 주문 취소 (발송 전 paid 주문만 가능) */
  @Post('orders/:id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelMyOrder(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string,
  ) {
    return this.shopService.cancelMyPaidOrder(user.id, id);
  }

  @Get('cart')
  @UseGuards(JwtAuthGuard)
  async getCartItems(@CurrentUser() user: UserRow) {
    return this.shopService.getCartItems(user.id);
  }

  @Post('cart')
  @UseGuards(JwtAuthGuard)
  async addToCart(@CurrentUser() user: UserRow, @Body() dto: AddToCartDto) {
    return this.shopService.addToCart(
      user.id,
      dto.productId,
      dto.quantity,
      dto.optionId ?? undefined,
    );
  }

  @Patch('cart/:id')
  @UseGuards(JwtAuthGuard)
  async updateCartItem(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.shopService.updateCartItemQuantity(user.id, id, dto.quantity);
  }

  @Delete('cart/:id')
  @UseGuards(JwtAuthGuard)
  async removeFromCart(
    @CurrentUser() user: UserRow,
    @Param('id', UuidParam) id: string,
  ) {
    return this.shopService.removeFromCart(user.id, id);
  }

  /** Naver Pay: 체크아웃 주문 생성 (결제 요청 직전 pending 상태 생성) */
  @Post('checkout/naver')
  @UseGuards(JwtAuthGuard)
  async createNaverCheckout(
    @CurrentUser() user: UserRow,
    @Body() dto: CreateNaverCheckoutDto,
  ) {
    return this.shopService.createNaverCheckoutOrder(
      user.id,
      dto.couponCode ?? null,
      dto.cartItemIds,
      dto.cartItemQuantities,
      dto.shippingAddressId,
    );
  }

  /** Naver Pay: 결제 승인 검증 + 주문 paid 처리 */
  @Post('checkout/naver/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmNaverPayment(
    @CurrentUser() user: UserRow,
    @Body() dto: ConfirmNaverPaymentDto,
  ) {
    return this.shopService.confirmNaverPaymentAndFinalizeOrder(user.id, {
      paymentId: dto.paymentId,
      merchantPayKey: dto.merchantPayKey,
    });
  }

  /** [Admin] 상품 이미지 업로드 (multipart/form-data, field: files) */
  @Post('admin/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FilesInterceptor('files', 20, imageUploadOptions('product')))
  async uploadProductImages(
    @Req() req: Request,
    @UploadedFiles() files: Multer.File[],
  ) {
    return this.storeUploadedImages(req, files, 'product', 1800);
  }

  /** [Admin] 상품 생성 */
  @Post('admin/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createProduct(@Body() body: unknown) {
    return this.shopService.createProduct(body);
  }

  /** [Admin] 상품 수정 */
  @Patch('admin/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateProduct(
    @Param('id', UuidParam) id: string,
    @Body() body: unknown,
  ) {
    return this.shopService.updateProduct(id, body);
  }

  /** [Admin] 상품 삭제 */
  @Delete('admin/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteProduct(@Param('id', UuidParam) id: string) {
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
    @Param('id', UuidParam) id: string,
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

  private async storeUploadedImages(
    req: Request,
    files: Multer.File[] | undefined,
    directory: MediaDirectory,
    maxWidth: number,
  ) {
    if (!files?.length) return { urls: [] };
    const urls: string[] = [];
    try {
      // 고해상도 원본을 동시에 디코딩하면 서버 메모리가 급증하므로 순차 처리합니다.
      for (const file of files) {
        urls.push(
          await this.spacesStorageService.storeUploadedImage(file, {
            publicDirectory: directory,
            maxWidth,
          }),
        );
      }
    } catch (error) {
      await this.spacesStorageService.deleteStoredUrls(urls, { directory });
      await Promise.all(
        files.map((file) => unlink(file.path).catch(() => undefined)),
      );
      throw error;
    }
    const baseUrl = getBaseUrl(req);
    return {
      urls: urls.map((url) =>
        /^https?:\/\//i.test(url) ? url : `${baseUrl}${url}`,
      ),
    };
  }
}
