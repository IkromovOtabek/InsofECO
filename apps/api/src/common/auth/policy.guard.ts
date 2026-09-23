import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../errors/domain.error';
import { AuthContext, IS_PUBLIC, ROLES } from './decorators';

/**
 * 1) X-Org-Id bo'yicha a'zolikni tekshiradi va req.auth.role ni to'ldiradi.
 * 2) @Roles(...) bo'lsa rolni tekshiradi.
 * Resurs egaligi (organizationId mosligi) — servis darajasida (repository so'rovlarida orgId filtr).
 */
@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<{ auth: AuthContext }>();
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);

    if (req.auth.orgId) {
      const memberships = await this.prisma.membership.findMany({
        where: { userId: req.auth.userId, organizationId: req.auth.orgId, isActive: true },
        select: { role: true },
      });
      if (memberships.length === 0) throw new DomainError('NOT_MEMBER', 'Siz bu tashkilot a\'zosi emassiz');
      // Bir tashkilotda bir nechta rol bo'lsa — eng yuqori imtiyozli (TADBIRKOR) tanlanadi
      const roles = memberships.map((m) => m.role as Role);
      req.auth.role = roles.includes('TADBIRKOR') ? 'TADBIRKOR' : roles[0] ?? null;
      if (required?.length) {
        const ok = roles.some((r) => required.includes(r));
        if (!ok) throw DomainError.forbidden(`Kerakli rol: ${required.join(' | ')}`);
        if (!required.includes(req.auth.role!)) req.auth.role = roles.find((r) => required.includes(r))!;
      }
    } else if (required?.length) {
      throw new DomainError('NOT_MEMBER', 'X-Org-Id header kerak');
    }
    return true;
  }
}
