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

const getBaseUrl = (req: Request): string => {
  const protocol = req.protocol || 'http'
  const host = req.get('host') || 'localhost:4000'
  return `${protocol}://${host}`
}

@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('categories')
  async getCategories() {
    return this.shopService.getCategories();
  }

  @Get('products')
  async getProducts(@Query('categoryId') categoryId?: string) {
    return this.shopService.getProducts(categoryId);
  }

  @Get('products/:id')
  async getProduct(@Param('id') id: string) {
    return this.shopService.getProduct(id);
  }

  /** 구매평용 이미지 업로드 (로그인 사용자, multipart/form-data, field name: files) */
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadReviewImages(
    @Req() req: Request,
    @UploadedFiles() files: Multer.File[],
  ) {
    if (!files?.length) return { urls: [] }
    const base = getBaseUrl(req)
    const urls = files.map((f) => `${base}/uploads/review/${f.filename}`)
    return { urls }
  }

  @Post('products/:id/reviews')
  @UseGuards(JwtAuthGuard)
  async createReview(
    @CurrentUser() user: UserRow,
    @Param('id') productId: string,
    @Body() body: { body: string; rating?: number; imageUrls?: string[] },
  ) {
    return this.shopService.createReview(user.id, productId, body);
  }

  /** 내가 작성한 구매평 목록 (Order History에서 리뷰 표시/작성용) */
  @Get('my-reviews')
  @UseGuards(JwtAuthGuard)
  async getMyReviews(@CurrentUser() user: UserRow) {
    return this.shopService.getMyReviews(user.id);
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

  /** [Admin] 상품 이미지 업로드 (multipart/form-data, field: files) → uploads/product */
  @Post('admin/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: diskStorage({
        destination: './uploads/product',
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname) || '.jpg'
          cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`)
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = /^image\/(jpeg|png|gif|webp)$/
        if (allowed.test(file.mimetype)) cb(null, true)
        else cb(new Error('이미지 파일만 업로드 가능합니다 (jpg, png, gif, webp).'), false)
      },
    }),
  )
  async uploadProductImages(
    @Req() req: Request,
    @UploadedFiles() files: Multer.File[],
  ) {
    if (!files?.length) return { urls: [] }
    const base = getBaseUrl(req)
    const urls = files.map((f) => `${base}/uploads/product/${f.filename}`)
    return { urls }
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
}
