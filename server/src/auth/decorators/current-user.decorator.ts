import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRow } from '../auth.service';

export const CurrentUser = createParamDecorator(
  (
    data: keyof UserRow | undefined,
    ctx: ExecutionContext,
  ): UserRow[keyof UserRow] | UserRow => {
    const request = ctx.switchToHttp().getRequest<{ user: UserRow }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
