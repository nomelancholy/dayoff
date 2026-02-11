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
import { eq, and } from 'drizzle-orm';
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
}
