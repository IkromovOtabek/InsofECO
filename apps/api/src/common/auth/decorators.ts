import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@insof/shared';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
/** Faol tashkilotdagi rol shu ro'yxatda bo'lishi shart. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export interface AuthContext {
  userId: string;
  sessionId: string;
  /** X-Org-Id header orqali tanlangan faol tashkilot va undagi rol */
  orgId: string | null;
  role: Role | null;
  /** X-Api-Key bilan kirgan tashqi tizim (Insof ERP). JWT sessiyada yo'q. */
  integration?: { id: string; name: string };
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  return ctx.switchToHttp().getRequest().auth as AuthContext;
});
