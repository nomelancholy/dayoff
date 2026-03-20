import { IsIn } from 'class-validator';

const USER_ROLES = ['member', 'admin'] as const;

export class UpdateUserRoleDto {
  @IsIn(USER_ROLES, { message: '역할은 member 또는 admin 이어야 합니다.' })
  role!: (typeof USER_ROLES)[number];
}
