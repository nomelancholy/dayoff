import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRow } from '../auth.service';

export const CurrentUser = createParamDecorator(
  (data: keyof UserRow | undefined, ctx: ExecutionContext): UserRow | unknown => {
    const request = ctx.switchToHttp().getRequest<{ user: UserRow }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
