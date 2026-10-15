import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  eq,
  and,
  desc,
  or,
  ilike,
  sql,
  inArray,
  isNull,
  isNotNull,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DRIZZLE } from '../common/database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import type { AuthProvider } from '../db/schema/users';
import { EmailService } from '../common/email/email.service';
import { MediaCleanupService } from '../shop/media-cleanup.service';
import {
  naverReviewEnabled,
  reviewCredentialVersion,
} from './naver-review.config';

export type UserRow = typeof schema.users.$inferSelect;

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  npayReview?: string;
}

export interface AuthResult {
  access_token: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly mediaCleanupService: MediaCleanupService,
  ) {}

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  private async comparePassword(
    plain: string,
    hashed: string,
  ): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  async register(
    email: string,
    password: string,
    fullName?: string,
    phone?: string,
  ): Promise<AuthResult> {
    const existing = await this.db.query.users.findFirst({
      where: and(
        eq(schema.users.email, email),
        eq(schema.users.provider, 'email'),
      ),
    });
    if (existing) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }
    let hashed: string;
    try {
      hashed = await this.hashPassword(password);
    } catch {
      throw new BadRequestException('비밀번호 암호화 중 오류가 발생했습니다.');
    }
    let user:
      | { id: string; email: string; fullName: string | null; role: string }
      | undefined;
    try {
      [user] = await this.db
        .insert(schema.users)
        .values({
          email: email.trim(),
          password: hashed,
          provider: 'email',
          fullName: fullName?.trim() ? fullName.trim() : null,
          phone: phone?.trim() ? phone.trim() : null,
        })
        .returning({
          id: schema.users.id,
          email: schema.users.email,
          fullName: schema.users.fullName,
          role: schema.users.role,
        });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : '회원가입 처리 중 오류가 발생했습니다.';
      throw new BadRequestException(msg);
    }
    if (!user) throw new UnauthorizedException('회원가입 처리에 실패했습니다.');
    await this.emailService.sendWelcomeEmail({
      to: user.email,
      name: user.fullName,
    });
    const access_token = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.configService.get<string>('JWT_SECRET') ?? 'change-me',
        expiresIn: 604800, // 7d
      },
    );
    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async validateEmailUser(
    email: string,
    password: string,
  ): Promise<UserRow | null> {
    const user = await this.db.query.users.findFirst({
      where: and(
        eq(schema.users.email, email),
        eq(schema.users.provider, 'email'),
      ),
    });
    if (!user?.password) return null;
    const ok = await this.comparePassword(password, user.password);
    return ok ? user : null;
  }

  login(user: UserRow): AuthResult {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const access_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET') ?? 'change-me',
      expiresIn: 604800, // 7d
    });
    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async loginNaverReview(
    identifier: string,
    password: string,
  ): Promise<AuthResult> {
    if (!naverReviewEnabled(this.configService))
      throw new ForbiddenException('검수 로그인이 비활성화되어 있습니다.');
    const id = this.configService.get<string>('NAVER_REVIEW_USER_ID')!.trim();
    const user = await this.findById(id);
    const alias =
      this.configService.get<string>('NAVER_REVIEW_LOGIN_ID')?.trim() ||
      'npay_test';
    const normalized = identifier.trim().toLowerCase();
    if (
      !user?.password ||
      user.provider !== 'email' ||
      user.role !== 'member' ||
      ![alias.toLowerCase(), user.email.toLowerCase()].includes(normalized) ||
      !(await this.comparePassword(password, user.password))
    )
      throw new UnauthorizedException(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
      );
    const access_token = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        npayReview: reviewCredentialVersion(user.password),
      },
      {
        secret: this.configService.get<string>('JWT_SECRET') ?? 'change-me',
        expiresIn: 4 * 60 * 60,
      },
    );
    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async findById(id: string): Promise<UserRow | undefined> {
    return this.db.query.users.findFirst({
      where: eq(schema.users.id, id),
    }) as Promise<UserRow | undefined>;
  }

  /** 프로필 수정 (fullName, phone; 이메일 로그인 시 비밀번호 변경 가능) */
  async updateProfile(
    userId: string,
    data: {
      fullName?: string;
      phone?: string;
      currentPassword?: string;
      newPassword?: string;
    },
  ): Promise<{
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
    role: string;
  }> {
    const user = await this.findById(userId);
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');

    const updates: Partial<typeof schema.users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.fullName !== undefined) {
      updates.fullName = data.fullName?.trim() || null;
    }
    if (data.phone !== undefined) {
      const digits = data.phone.replace(/\D/g, '');
      if (digits.length === 0) {
        updates.phone = null;
      } else if (!/^(?:010\d{8}|01[1-9]\d{7,8})$/.test(digits)) {
        throw new BadRequestException(
          '휴대폰 번호를 010-1234-5678 형식(또는 011 등 10자리)으로 입력해 주세요.',
        );
      } else {
        updates.phone = digits;
      }
    }

    if (data.newPassword) {
      if (user.provider !== 'email' || !user.password) {
        throw new BadRequestException(
          '이메일 로그인 회원만 비밀번호를 변경할 수 있습니다.',
        );
      }
      if (!data.currentPassword) {
        throw new BadRequestException('현재 비밀번호를 입력해 주세요.');
      }
      const match = await this.comparePassword(
        data.currentPassword,
        user.password,
      );
      if (!match)
        throw new BadRequestException('현재 비밀번호가 일치하지 않습니다.');
      updates.password = await this.hashPassword(data.newPassword);
    }

    const [updated] = await this.db
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        phone: schema.users.phone,
        role: schema.users.role,
      });
    if (!updated) throw new BadRequestException('프로필 수정에 실패했습니다.');
    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      phone: updated.phone,
      role: updated.role,
    };
  }

  /** 내 계정 탈퇴 (사용자 연관 데이터 정리 후 users 삭제) */
  async deleteMyAccount(userId: string): Promise<{ ok: true }> {
    const user = await this.findById(userId);
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');

    // 구매평은 FK(ON DELETE CASCADE)로 함께 지워지므로 첨부 사진 주소를 미리 확보합니다.
    const reviewImages = await this.db
      .select({ url: schema.productReviewImages.url })
      .from(schema.productReviewImages)
      .innerJoin(
        schema.productReviews,
        eq(schema.productReviewImages.reviewId, schema.productReviews.id),
      )
      .where(eq(schema.productReviews.userId, userId));

    await this.db.transaction(async (tx) => {
      // 결제는 끝났지만 아직 발송되지 않은 주문이 지워지면 환불도 발송도 되지 않으므로,
      // 그런 주문(또는 결제번호가 연결되어 확인이 필요한 주문)이 있으면 탈퇴를 막습니다.
      const blockingOrders = await tx
        .select({ id: schema.orders.id })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.userId, userId),
            or(
              eq(schema.orders.status, 'paid'),
              and(
                eq(schema.orders.status, 'pending'),
                isNotNull(schema.orders.naverPaymentId),
              ),
            ),
          ),
        )
        .for('update');
      if (blockingOrders.length > 0) {
        throw new BadRequestException(
          '발송을 기다리는 주문이 있어 탈퇴할 수 없습니다. 주문을 취소하시거나 상품 발송 후 다시 시도해 주세요.',
        );
      }

      const myOrders = await tx.query.orders.findMany({
        where: eq(schema.orders.userId, userId),
        columns: { id: true },
      });
      const orderIds = myOrders.map((o) => o.id);

      if (orderIds.length > 0) {
        await tx
          .delete(schema.orderItems)
          .where(inArray(schema.orderItems.orderId, orderIds));
        await tx.delete(schema.orders).where(eq(schema.orders.userId, userId));
      }

      await tx
        .delete(schema.userCoupons)
        .where(eq(schema.userCoupons.userId, userId));
      await tx
        .delete(schema.cartItems)
        .where(eq(schema.cartItems.userId, userId));
      await tx
        .delete(schema.productQa)
        .where(eq(schema.productQa.userId, userId));
      await tx
        .delete(schema.addresses)
        .where(eq(schema.addresses.userId, userId));

      const [deletedUser] = await tx
        .delete(schema.users)
        .where(eq(schema.users.id, userId))
        .returning({ id: schema.users.id });
      if (!deletedUser) {
        throw new BadRequestException('회원 탈퇴 처리에 실패했습니다.');
      }
    });

    await this.mediaCleanupService.removeUnreferenced(
      reviewImages.map((image) => image.url),
      'review',
    );

    return { ok: true };
  }

  /** 소셜 로그인: provider+providerId로 기존 유저 찾거나 새로 생성 */
  async findOrCreateSocialUser(
    provider: AuthProvider,
    providerId: string,
    email: string,
    fullName?: string,
  ): Promise<UserRow> {
    const existing = await this.db.query.users.findFirst({
      where: and(
        eq(schema.users.provider, provider),
        eq(schema.users.providerId, providerId),
      ),
    });
    if (existing) return existing as UserRow;

    // users.email 은 unique이므로, 동일 이메일이 이미 이메일 로그인 계정으로 존재하면
    // insert 대신 해당 유저의 provider/providerId만 갱신한다.
    const existingByEmail = await this.db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });
    if (existingByEmail) {
      const [updated] = await this.db
        .update(schema.users)
        .set({
          provider,
          providerId,
          fullName: fullName ?? existingByEmail.fullName ?? null,
        })
        .where(eq(schema.users.id, existingByEmail.id))
        .returning();
      if (!updated)
        throw new UnauthorizedException('소셜 계정 업데이트에 실패했습니다.');
      return updated as UserRow;
    }
    const [created] = await this.db
      .insert(schema.users)
      .values({
        email,
        provider,
        providerId,
        fullName: fullName ?? null,
      })
      .returning();
    if (!created)
      throw new UnauthorizedException('소셜 계정 생성에 실패했습니다.');
    await this.emailService.sendWelcomeEmail({
      to: created.email,
      name: created.fullName,
    });
    return created;
  }

  /** 내 주소 목록 */
  async getAddresses(userId: string) {
    return this.db.query.addresses.findMany({
      where: eq(schema.addresses.userId, userId),
      orderBy: [
        desc(schema.addresses.isDefault),
        desc(schema.addresses.createdAt),
      ],
    });
  }

  /** 주소 추가 */
  async createAddress(
    userId: string,
    data: {
      label: string;
      recipientName?: string;
      phone?: string;
      postalCode?: string;
      addressLine1: string;
      addressLine2?: string;
      isDefault?: boolean;
    },
  ) {
    const label = data.label.trim();
    const addressLine1 = data.addressLine1.trim();
    if (!label) throw new BadRequestException('주소 별칭을 입력해 주세요.');
    if (!addressLine1) throw new BadRequestException('주소를 입력해 주세요.');

    // 기본 배송지 해제와 새 주소 저장이 따로 반영되지 않도록 한 트랜잭션으로 처리합니다.
    const created = await this.db.transaction(async (tx) => {
      if (data.isDefault) {
        await tx
          .update(schema.addresses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(schema.addresses.userId, userId));
      }
      const [row] = await tx
        .insert(schema.addresses)
        .values({
          userId,
          label,
          recipientName: data.recipientName?.trim() || null,
          phone: data.phone?.trim() || null,
          postalCode: data.postalCode?.trim() || null,
          addressLine1,
          addressLine2: data.addressLine2?.trim() || null,
          isDefault: data.isDefault ?? false,
        })
        .returning();
      return row;
    });
    if (!created) throw new BadRequestException('주소 추가에 실패했습니다.');
    return created;
  }

  /** 주소 수정 */
  async updateAddress(
    userId: string,
    addressId: string,
    data: {
      label?: string;
      recipientName?: string;
      phone?: string;
      postalCode?: string;
      addressLine1?: string;
      addressLine2?: string;
      isDefault?: boolean;
    },
  ) {
    const existing = await this.db.query.addresses.findFirst({
      where: and(
        eq(schema.addresses.id, addressId),
        eq(schema.addresses.userId, userId),
      ),
    });
    if (!existing) throw new BadRequestException('주소를 찾을 수 없습니다.');

    const updates: Partial<typeof schema.addresses.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.label !== undefined) {
      const label = data.label.trim();
      if (!label) throw new BadRequestException('주소 별칭을 입력해 주세요.');
      updates.label = label;
    }
    if (data.recipientName !== undefined)
      updates.recipientName = data.recipientName?.trim() || null;
    if (data.phone !== undefined) updates.phone = data.phone?.trim() || null;
    if (data.postalCode !== undefined)
      updates.postalCode = data.postalCode?.trim() || null;
    if (data.addressLine1 !== undefined) {
      const addressLine1 = data.addressLine1.trim();
      if (!addressLine1) throw new BadRequestException('주소를 입력해 주세요.');
      updates.addressLine1 = addressLine1;
    }
    if (data.addressLine2 !== undefined)
      updates.addressLine2 = data.addressLine2?.trim() || null;
    if (data.isDefault !== undefined) updates.isDefault = data.isDefault;

    // 이미 접수된 주문의 배송지는 주문에 따로 고정되어 있어 여기서 수정해도 바뀌지 않습니다.
    return this.db.transaction(async (tx) => {
      if (data.isDefault === true) {
        await tx
          .update(schema.addresses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(schema.addresses.userId, userId));
      }

      const [updated] = await tx
        .update(schema.addresses)
        .set(updates)
        .where(
          and(
            eq(schema.addresses.id, addressId),
            eq(schema.addresses.userId, userId),
          ),
        )
        .returning();
      return updated;
    });
  }

  /** 주소 삭제 */
  async deleteAddress(userId: string, addressId: string) {
    const existing = await this.db.query.addresses.findFirst({
      where: and(
        eq(schema.addresses.id, addressId),
        eq(schema.addresses.userId, userId),
      ),
    });
    if (!existing) throw new BadRequestException('주소를 찾을 수 없습니다.');

    // 주문은 주문 시점의 배송지를 따로 보관하므로, 주문에 사용된 주소도 주소록에서 지울 수 있습니다.
    // (결제 화면을 열기만 해도 주문 초안이 만들어져, 예전에는 그 주소를 지울 수 없었습니다.)
    await this.db.transaction(async (tx) => {
      // 스냅샷 도입 전에 만들어진 주문이 남아 있다면 지우기 전에 배송지를 주문에 옮겨 둡니다.
      await tx
        .update(schema.orders)
        .set({
          shippingRecipientName: existing.recipientName,
          shippingPhone: existing.phone,
          shippingPostalCode: existing.postalCode,
          shippingAddressLine1: existing.addressLine1,
          shippingAddressLine2: existing.addressLine2,
        })
        .where(
          and(
            eq(schema.orders.shippingAddressId, addressId),
            isNull(schema.orders.shippingAddressLine1),
          ),
        );
      await tx
        .update(schema.orders)
        .set({ shippingAddressId: null })
        .where(eq(schema.orders.shippingAddressId, addressId));
      await tx
        .delete(schema.addresses)
        .where(
          and(
            eq(schema.addresses.id, addressId),
            eq(schema.addresses.userId, userId),
          ),
        );
    });
    return { ok: true };
  }

  /** 관리자: 회원 목록 (검색·역할 필터·페이지) */
  async listUsersForAdmin(params: {
    q?: string;
    role?: 'member' | 'admin';
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: Array<{
      id: string;
      email: string;
      fullName: string | null;
      phone: string | null;
      provider: AuthProvider;
      role: 'member' | 'admin';
      createdAt: Date;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const q = params.q?.trim();
    const roleFilter = params.role;

    const parts: SQL[] = [];
    if (q) {
      const pattern = `%${q}%`;
      parts.push(
        or(
          ilike(schema.users.email, pattern),
          ilike(schema.users.fullName, pattern),
        )!,
      );
    }
    if (roleFilter === 'member' || roleFilter === 'admin') {
      parts.push(eq(schema.users.role, roleFilter));
    }
    const whereClause = parts.length ? and(...parts) : undefined;

    const countBase = this.db
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(schema.users);
    const [countRow] = whereClause
      ? await countBase.where(whereClause)
      : await countBase;

    const items = await this.db.query.users.findMany({
      columns: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        provider: true,
        role: true,
        createdAt: true,
      },
      where: whereClause,
      orderBy: [desc(schema.users.createdAt)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return {
      items,
      total: Number(countRow?.total ?? 0),
      page,
      pageSize,
    };
  }

  /** 관리자: 특정 회원 주소 목록 */
  async listUserAddressesForAdmin(userId: string) {
    const target = await this.findById(userId);
    if (!target) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    return this.db.query.addresses.findMany({
      where: eq(schema.addresses.userId, userId),
      orderBy: [
        desc(schema.addresses.isDefault),
        desc(schema.addresses.createdAt),
      ],
    });
  }

  /** 관리자: 회원 역할 변경 (본인 관리자 해제 불가) */
  async updateUserRoleByAdmin(
    actorId: string,
    targetUserId: string,
    role: 'member' | 'admin',
  ): Promise<{
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  }> {
    if (actorId === targetUserId && role === 'member') {
      throw new ForbiddenException(
        '본인 계정의 관리자 권한을 해제할 수 없습니다.',
      );
    }
    const target = await this.findById(targetUserId);
    if (!target) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    const [updated] = await this.db
      .update(schema.users)
      .set({ role, updatedAt: new Date() })
      .where(eq(schema.users.id, targetUserId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        role: schema.users.role,
      });
    if (!updated) throw new BadRequestException('역할 변경에 실패했습니다.');
    return updated;
  }
}
