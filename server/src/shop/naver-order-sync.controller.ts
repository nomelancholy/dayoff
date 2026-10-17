import {
  Controller,
  Get,
  Post,
  UseGuards,
  Header,
  HttpCode,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { NaverOrderSyncService } from './naver-order-sync.service';
import { NaverApiError } from './naver-order-api.client';

@Controller('shop/admin/naver-order/sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class NaverOrderSyncController {
  constructor(private readonly sync: NaverOrderSyncService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  status() {
    return this.sync.status();
  }
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async run() {
    try {
      return await this.sync.run();
    } catch (e) {
      throw new ServiceUnavailableException(
        e instanceof NaverApiError ? e.code : 'SYNC_FAILED',
      );
    }
  }
}
