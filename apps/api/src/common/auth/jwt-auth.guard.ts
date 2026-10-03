import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { createHash } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../errors/domain.error';
import { AuthContext, IS_PUBLIC } from './decorators';
import { checkUserGate } from './user-gate';

/** API kalit → bazadagi xesh. Kalitning o'zi hech qayerda saqlanmaydi. */
export const hashApiKey = (key: string) => createHash('sha256').update(key).digest('hex');

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  iat?: number;
}

/** Kesh va bekor qilish — `user-gate.ts` (HTTP va WS /tracking uchun umumiy). */
export { invalidateUserGate } from './user-gate';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();

    // Tashqi tizim (Insof ERP): X-Api-Key. Tashkilot va rol kalitning o'ziga bog'langan — X-Org-Id shart emas.
    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey === 'string' && apiKey) {
      const client = await this.prisma.integrationClient.findUnique({ where: { keyHash: hashApiKey(apiKey) } });
      if (!client || !client.isActive) throw new DomainError('AUTH_TOKEN_INVALID', 'API kalit yaroqsiz');
      void this.prisma.integrationClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
      req.auth = { userId: client.userId, sessionId: `integration:${client.id}`, orgId: client.organizationId, role: null, integration: { id: client.id, name: client.name } };
      return true;
    }

    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new DomainError('AUTH_TOKEN_INVALID', 'Token yo\'q');
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new DomainError('AUTH_TOKEN_INVALID', 'Token yaroqsiz');
    }
    await this.assertUserActive(payload);
    const orgId = (req.headers['x-org-id'] as string | undefined) ?? null;
    req.auth = { userId: payload.sub, sessionId: payload.sid, orgId, role: null };
    return true;
  }

  /** Bloklangan/o'chirilgan foydalanuvchi va "barcha seanslarni yopish"dan oldingi tokenlar rad etiladi. */
  private async assertUserActive(p: AccessTokenPayload) {
    const v = await checkUserGate(this.prisma, p.sub, p.iat);
    if (v === 'INACTIVE') throw new DomainError('AUTH_TOKEN_INVALID', 'Hisob faol emas');
    if (v === 'REVOKED') throw new DomainError('AUTH_TOKEN_INVALID', 'Seans yopilgan');
  }
}
