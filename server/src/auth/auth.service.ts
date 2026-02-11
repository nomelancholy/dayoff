import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../common/database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import type { AuthProvider } from '../db/schema/users';

export type UserRow = typeof schema.users.$inferSelect;

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
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
    let user: { id: string; email: string; fullName: string | null; role: string } | undefined;
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
      const msg = err instanceof Error ? err.message : '회원가입 처리 중 오류가 발생했습니다.';
      throw new BadRequestException(msg);
    }
    if (!user) throw new UnauthorizedException('회원가입 처리에 실패했습니다.');
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

  async login(user: UserRow): Promise<AuthResult> {
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
  ): Promise<{ id: string; email: string; fullName: string | null; phone: string | null; role: string }> {
    const user = await this.findById(userId);
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');

    const updates: Partial<typeof schema.users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.fullName !== undefined) {
      updates.fullName = data.fullName?.trim() || null;
    }
    if (data.phone !== undefined) {
      updates.phone = data.phone?.trim() || null;
    }

    if (data.newPassword) {
      if (user.provider !== 'email' || !user.password) {
        throw new BadRequestException('이메일 로그인 회원만 비밀번호를 변경할 수 있습니다.');
      }
      if (!data.currentPassword) {
        throw new BadRequestException('현재 비밀번호를 입력해 주세요.');
      }
      const match = await this.comparePassword(data.currentPassword, user.password);
      if (!match) throw new BadRequestException('현재 비밀번호가 일치하지 않습니다.');
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
    const [created] = await this.db
      .insert(schema.users)
      .values({
        email,
        provider,
        providerId,
        fullName: fullName ?? null,
      })
      .returning();
    if (!created) throw new UnauthorizedException('소셜 계정 생성에 실패했습니다.');
    return created as UserRow;
  }

  /** 내 주소 목록 */
  async getAddresses(userId: string) {
    return this.db.query.addresses.findMany({
      where: eq(schema.addresses.userId, userId),
      orderBy: [desc(schema.addresses.isDefault), desc(schema.addresses.createdAt)],
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
    if (data.isDefault) {
      await this.db
        .update(schema.addresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(schema.addresses.userId, userId));
    }
    const [created] = await this.db
      .insert(schema.addresses)
      .values({
        userId,
        label: data.label.trim(),
        recipientName: data.recipientName?.trim() || null,
        phone: data.phone?.trim() || null,
        postalCode: data.postalCode?.trim() || null,
        addressLine1: data.addressLine1.trim(),
        addressLine2: data.addressLine2?.trim() || null,
        isDefault: data.isDefault ?? false,
      })
      .returning();
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

    if (data.isDefault === true) {
      await this.db
        .update(schema.addresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(schema.addresses.userId, userId));
    }

    const updates: Partial<typeof schema.addresses.$inferInsert> = { updatedAt: new Date() };
    if (data.label !== undefined) updates.label = data.label.trim();
    if (data.recipientName !== undefined) updates.recipientName = data.recipientName?.trim() || null;
    if (data.phone !== undefined) updates.phone = data.phone?.trim() || null;
    if (data.postalCode !== undefined) updates.postalCode = data.postalCode?.trim() || null;
    if (data.addressLine1 !== undefined) updates.addressLine1 = data.addressLine1.trim();
    if (data.addressLine2 !== undefined) updates.addressLine2 = data.addressLine2?.trim() || null;
    if (data.isDefault !== undefined) updates.isDefault = data.isDefault;

    const [updated] = await this.db
      .update(schema.addresses)
      .set(updates)
      .where(eq(schema.addresses.id, addressId))
      .returning();
    return updated;
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
    await this.db.delete(schema.addresses).where(eq(schema.addresses.id, addressId));
    return { ok: true };
  }
}
