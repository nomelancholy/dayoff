import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, sql, asc, desc, ne } from 'drizzle-orm';
import { DRIZZLE } from '../common/database/database.module';
import * as schema from '../db/schema';

@Injectable()
export class CouponService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /** 관리자: 쿠폰 목록 */
  async findAll() {
    return this.db.query.coupons.findMany({
      orderBy: [desc(schema.coupons.createdAt)],
    });
  }

  /** 관리자: 쿠폰 생성 */
  async create(dto: {
    code: string;
    discountType: 'percent' | 'fixed';
    discountValue: number;
    minOrderAmount?: number | null;
    validFrom: string;
    validUntil: string;
    usageLimit?: number | null;
    isActive?: boolean;
  }) {
    const normalizedCode = dto.code.trim();
    if (dto.discountType === 'percent' && dto.discountValue > 100) {
      throw new BadRequestException('퍼센트 할인은 100 이하여야 합니다.');
    }
    const existing = await this.db.query.coupons.findFirst({
      where: sql`lower(${schema.coupons.code}) = lower(${normalizedCode})`,
    });
    if (existing) {
      throw new ConflictException('이미 존재하는 쿠폰 코드입니다.');
    }
    const [row] = await this.db
      .insert(schema.coupons)
      .values({
        code: normalizedCode,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minOrderAmount: dto.minOrderAmount ?? null,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        usageLimit: dto.usageLimit ?? null,
        isActive: dto.isActive ?? true,
      })
      .returning();
    return row;
  }

  /** 관리자: 쿠폰 수정 */
  async update(
    id: string,
    dto: Partial<{
      code: string;
      discountType: 'percent' | 'fixed';
      discountValue: number;
      minOrderAmount: number | null;
      validFrom: string;
      validUntil: string;
      usageLimit: number | null;
      isActive: boolean;
    }>,
  ) {
    const coupon = await this.db.query.coupons.findFirst({
      where: eq(schema.coupons.id, id),
    });
    if (!coupon) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    if (dto.code !== undefined) {
      const existing = await this.db.query.coupons.findFirst({
        where: and(
          sql`lower(${schema.coupons.code}) = lower(${dto.code.trim()})`,
          ne(schema.coupons.id, id),
        ),
      });
      if (existing)
        throw new ConflictException('이미 존재하는 쿠폰 코드입니다.');
    }
    if (
      dto.discountType === 'percent' &&
      (dto.discountValue ?? coupon.discountValue) > 100
    ) {
      throw new BadRequestException('퍼센트 할인은 100 이하여야 합니다.');
    }
    const [updated] = await this.db
      .update(schema.coupons)
      .set({
        ...(dto.code !== undefined && { code: dto.code.trim() }),
        ...(dto.discountType !== undefined && {
          discountType: dto.discountType,
        }),
        ...(dto.discountValue !== undefined && {
          discountValue: dto.discountValue,
        }),
        ...(dto.minOrderAmount !== undefined && {
          minOrderAmount: dto.minOrderAmount,
        }),
        ...(dto.validFrom !== undefined && {
          validFrom: new Date(dto.validFrom),
        }),
        ...(dto.validUntil !== undefined && {
          validUntil: new Date(dto.validUntil),
        }),
        ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(schema.coupons.id, id))
      .returning();
    return updated;
  }

  /** 관리자: 쿠폰 삭제 */
  async remove(id: string) {
    const coupon = await this.db.query.coupons.findFirst({
      where: eq(schema.coupons.id, id),
    });
    if (!coupon) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    await this.db.delete(schema.coupons).where(eq(schema.coupons.id, id));
    return { ok: true };
  }

  /** 관리자: 회원에게 쿠폰 지급 (user_coupons 행 생성) */
  async issueToUser(couponId: string, userId: string) {
    const coupon = await this.db.query.coupons.findFirst({
      where: eq(schema.coupons.id, couponId),
    });
    if (!coupon) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    if (!coupon.isActive)
      throw new BadRequestException('비활성화된 쿠폰입니다.');
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      throw new BadRequestException('유효 기간이 아닌 쿠폰입니다.');
    }
    const existing = await this.db.query.userCoupons.findFirst({
      where: and(
        eq(schema.userCoupons.couponId, couponId),
        eq(schema.userCoupons.userId, userId),
        isNull(schema.userCoupons.usedAt),
      ),
    });
    if (existing) throw new ConflictException('이미 지급된 쿠폰입니다.');
    const [row] = await this.db
      .insert(schema.userCoupons)
      .values({ couponId, userId })
      .returning();
    return row;
  }

  /** 회원: 내가 보유한 미사용 쿠폰 목록 (user_coupons + coupon 정보) */
  async getMyCoupons(userId: string) {
    return this.db.query.userCoupons.findMany({
      where: and(
        eq(schema.userCoupons.userId, userId),
        isNull(schema.userCoupons.usedAt),
      ),
      with: {
        coupon: true,
      },
      orderBy: [asc(schema.userCoupons.createdAt)],
    });
  }

  /** 회원: 쿠폰 코드 검증 (주문 금액 기준 할인액 계산). 코드만 검증하며, 지급 쿠폰이 아니어도 공용 코드면 사용 가능 */
  async validateCode(userId: string, code: string, orderAmount: number) {
    const trimmed = code.trim();
    const coupon = await this.db.query.coupons.findFirst({
      where: sql`lower(${schema.coupons.code}) = lower(${trimmed})`,
    });
    if (!coupon) {
      throw new BadRequestException('유효하지 않은 쿠폰 코드입니다.');
    }
    if (!coupon.isActive) {
      throw new BadRequestException('사용할 수 없는 쿠폰입니다.');
    }
    const now = new Date();
    if (now < coupon.validFrom) {
      throw new BadRequestException('아직 사용 기간이 아닙니다.');
    }
    if (now > coupon.validUntil) {
      throw new BadRequestException('사용 기간이 만료된 쿠폰입니다.');
    }
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('쿠폰 사용 한도를 초과했습니다.');
    }
    if (coupon.minOrderAmount != null && orderAmount < coupon.minOrderAmount) {
      throw new BadRequestException(
        `최소 주문 금액 ₩${coupon.minOrderAmount.toLocaleString()} 이상일 때 사용 가능합니다.`,
      );
    }
    let discountAmount: number;
    if (coupon.discountType === 'percent') {
      discountAmount = Math.floor((orderAmount * coupon.discountValue) / 100);
    } else {
      discountAmount = Math.min(coupon.discountValue, orderAmount);
    }
    return {
      valid: true,
      couponId: coupon.id,
      discountAmount,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderAmount: coupon.minOrderAmount,
      },
    };
  }
}
