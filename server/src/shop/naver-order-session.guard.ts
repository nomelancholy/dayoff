import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** 공개 오픈 후 비회원도 허용하되, 검수 계정 판별은 검증된 JWT 사용자만 사용합니다. */
@Injectable()
export class NaverOrderSessionGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(error: unknown, user: TUser): TUser {
    // 토큰 없음/만료/위조는 모두 익명 취급. 검수 권한은 별도로 검사합니다.
    return (error || !user ? undefined : user) as TUser;
  }
}
