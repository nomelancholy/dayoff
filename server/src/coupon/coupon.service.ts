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
import { EmailService } from '../common/email/email.service';
import * as schema from '../db/schema';
import {
  assertValidCouponPeriod,
  parseCouponDate,
  toKstIsoString,
} from './coupon-period';

type CouponRow = typeof schema.coupons.$inferSelect;

/**
 * 관리자 수정 폼은 응답 문자열의 앞 10자리를 날짜 입력값으로 사용합니다.
 * UTC 문자열로 내려주면 시작일이 하루 앞당겨 보이고 저장할 때마다 밀리므로,
 * 유효 기간은 한국 시간 기준 문자열로 내려줍니다.
 */
function serializeCoupon<T extends Pick<CouponRow, 'validFrom' | 'validUntil'>>(
  coupon: T,
) {
  return {
    ...coupon,
    validFrom: toKstIsoString(coupon.validFrom),
    validUntil: toKstIsoString(coupon.validUntil),
  };
}

function assertValidDiscount(
  discountType: 'percent' | 'fixed',
  discountValue: number,
) {
  if (!Number.isInteger(discountValue) || discountValue < 1) {
    throw new BadRequestException('할인 값은 1 이상의 정수여야 합니다.');
  }
  if (discountType === 'percent' && discountValue > 100) {
    throw new BadRequestException('퍼센트 할인은 100 이하여야 합니다.');
  }
}

@Injectable()
export class CouponService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly emailService: EmailService,
  ) {}

  /** 관리자: 쿠폰 목록 */
  async findAll() {
    const coupons = await this.db.query.coupons.findMany({
      orderBy: [desc(schema.coupons.createdAt)],
    });
    return coupons.map((coupon) => serializeCoupon(coupon));
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
    if (!normalizedCode) {
      throw new BadRequestException('쿠폰 코드를 입력해 주세요.');
    }
    assertValidDiscount(dto.discountType, dto.discountValue);
    const validFrom = parseCouponDate(dto.validFrom, 'start');
    const validUntil = parseCouponDate(dto.validUntil, 'end');
    assertValidCouponPeriod(validFrom, validUntil);

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
        validFrom,
        validUntil,
        usageLimit: dto.usageLimit ?? null,
        isActive: dto.isActive ?? true,
      })
      .returning();
    return serializeCoupon(row);
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

    const normalizedCode = dto.code?.trim();
    if (dto.code !== undefined) {
      if (!normalizedCode) {
        throw new BadRequestException('쿠폰 코드를 입력해 주세요.');
      }
      const existing = await this.db.query.coupons.findFirst({
        where: and(
          sql`lower(${schema.coupons.code}) = lower(${normalizedCode})`,
          ne(schema.coupons.id, id),
        ),
      });
      if (existing)
        throw new ConflictException('이미 존재하는 쿠폰 코드입니다.');
    }

    // 타입·값 중 하나만 바뀌어도 저장될 최종 조합으로 검증합니다.
    if (dto.discountType !== undefined || dto.discountValue !== undefined) {
      assertValidDiscount(
        dto.discountType ?? coupon.discountType,
        dto.discountValue ?? coupon.discountValue,
      );
    }

    const validFrom =
      dto.validFrom !== undefined
        ? parseCouponDate(dto.validFrom, 'start')
        : undefined;
    const validUntil =
      dto.validUntil !== undefined
        ? parseCouponDate(dto.validUntil, 'end')
        : undefined;
    if (validFrom !== undefined || validUntil !== undefined) {
      assertValidCouponPeriod(
        validFrom ?? coupon.validFrom,
        validUntil ?? coupon.validUntil,
      );
    }

    const [updated] = await this.db
      .update(schema.coupons)
      .set({
        ...(normalizedCode !== undefined && { code: normalizedCode }),
        ...(dto.discountType !== undefined && {
          discountType: dto.discountType,
        }),
        ...(dto.discountValue !== undefined && {
          discountValue: dto.discountValue,
        }),
        ...(dto.minOrderAmount !== undefined && {
          minOrderAmount: dto.minOrderAmount,
        }),
        ...(validFrom !== undefined && { validFrom }),
        ...(validUntil !== undefined && { validUntil }),
        ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(schema.coupons.id, id))
      .returning();
    if (!updated) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    return serializeCoupon(updated);
  }

  /**
   * 관리자: 쿠폰 삭제.
   * 회원에게 지급된 쿠폰은 함께 회수하고, 이 쿠폰을 사용한 주문은 할인 금액을 그대로 둔 채
   * 쿠폰 연결만 해제합니다. (연결이 남아 있으면 FK 제약으로 삭제가 실패합니다.)
   */
  async remove(id: string) {
    const coupon = await this.db.query.coupons.findFirst({
      where: eq(schema.coupons.id, id),
    });
    if (!coupon) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');

    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.userCoupons)
        .where(eq(schema.userCoupons.couponId, id));
      await tx
        .update(schema.orders)
        .set({ couponId: null })
        .where(eq(schema.orders.couponId, id));
      await tx.delete(schema.coupons).where(eq(schema.coupons.id, id));
    });
    return { ok: true };
  }

  /** 관리자: 회원에게 쿠폰 지급 (user_coupons 행 생성 + 안내 메일 발송) */
  async issueToUser(couponId: string, userId: string) {
    const coupon = await this.db.query.coupons.findFirst({
      where: eq(schema.coupons.id, couponId),
    });
    if (!coupon) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    if (!coupon.isActive)
      throw new BadRequestException('비활성화된 쿠폰입니다.');
    // 시작 전인 쿠폰은 미리 지급할 수 있고, 이미 끝난 쿠폰만 막습니다.
    if (new Date() > coupon.validUntil) {
      throw new BadRequestException('유효 기간이 지난 쿠폰입니다.');
    }
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('사용 한도가 모두 소진된 쿠폰입니다.');
    }

    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { id: true, email: true, fullName: true },
    });
    if (!user) throw new NotFoundException('회원을 찾을 수 없습니다.');

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

    // 쿠폰함 화면이 없어도 회원이 쿠폰 코드를 알 수 있도록 메일로 안내합니다.
    // 메일 지연·실패가 지급 처리를 막지 않도록 기다리지 않습니다.
    void this.emailService.sendCouponIssuedEmail({
      to: user.email,
      name: user.fullName,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
    });

    return row;
  }

  /** 회원: 내가 보유한 미사용 쿠폰 목록 (user_coupons + coupon 정보) */
  async getMyCoupons(userId: string) {
    const rows = await this.db.query.userCoupons.findMany({
      where: and(
        eq(schema.userCoupons.userId, userId),
        isNull(schema.userCoupons.usedAt),
      ),
      with: {
        coupon: true,
      },
      orderBy: [asc(schema.userCoupons.createdAt)],
    });
    return rows.map((row) => ({
      ...row,
      coupon: serializeCoupon(row.coupon),
    }));
  }

  /**
   * 회원: 쿠폰 코드 검증 (주문 금액 기준 할인액 계산).
   * 지급받지 않은 공용 코드도 사용할 수 있지만, 같은 쿠폰은 회원당 한 번만 쓸 수 있습니다.
   * (다시 지급받으면 지급된 만큼 다시 사용할 수 있습니다.)
   */
  async validateCode(userId: string, code: string, orderAmount: number) {
    const trimmed = code.trim();
    const coupon = trimmed
      ? await this.db.query.coupons.findFirst({
          where: sql`lower(${schema.coupons.code}) = lower(${trimmed})`,
        })
      : undefined;
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

    const myCoupons = await this.db.query.userCoupons.findMany({
      where: and(
        eq(schema.userCoupons.userId, userId),
        eq(schema.userCoupons.couponId, coupon.id),
      ),
      columns: { usedAt: true },
    });
    if (
      myCoupons.length > 0 &&
      myCoupons.every((item) => item.usedAt != null)
    ) {
      throw new BadRequestException('이미 사용한 쿠폰입니다.');
    }

    if (coupon.minOrderAmount != null && orderAmount < coupon.minOrderAmount) {
      throw new BadRequestException(
        `최소 주문 금액 ₩${coupon.minOrderAmount.toLocaleString('ko-KR')} 이상일 때 사용 가능합니다.`,
      );
    }
    let discountAmount: number;
    if (coupon.discountType === 'percent') {
      discountAmount = Math.min(
        Math.floor((orderAmount * coupon.discountValue) / 100),
        orderAmount,
      );
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
