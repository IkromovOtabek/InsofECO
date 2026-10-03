import { Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type Redis from 'ioredis';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

/**
 * Foydalanuvchi "darvozasi": bloklangan / o'chirilgan / "barcha seanslarni yopish"dan oldingi token.
 * HTTP (JwtAuthGuard) ham, WS /tracking ham shu bitta tekshiruvdan o'tadi.
 *
 * Kesh 30 s (har so'rovda bazaga bormaslik uchun). Bekor qilish (block/revoke/o'chirish):
 *  - shu jarayonda keshni darhol tozalaydi;
 *  - Redis pub/sub orqali BOSHQA instanslarga ham yetkaziladi (ular ham keshni tozalaydi va
 *    o'sha foydalanuvchining socketlarini uzadi) — Redis ishlamasa eng ko'pi bilan 30 s kechikadi.
 *
 * Poyga (race): keshga yozish so'rov BOSHLANGAN vaqt bilan solishtiriladi — bekor qilishdan oldin
 * boshlangan (eski holatni o'qigan) so'rov natijasi keshga yozilmaydi, aks holda bloklangan
 * foydalanuvchi yana 30 s "faol" bo'lib turardi.
 */
interface Gate { blocked: boolean; validAfterSec: number; exp: number }
const TTL = 30_000;
const gates = new Map<string, Gate>();
const invalidatedAt = new Map<string, number>();

export function invalidateUserGate(userId: string) {
  gates.delete(userId);
  invalidatedAt.set(userId, Date.now());
  if (invalidatedAt.size > 10_000) {
    const cutoff = Date.now() - TTL * 2;
    for (const [k, t] of invalidatedAt) if (t < cutoff) invalidatedAt.delete(k);
  }
}

export type GateVerdict = null | 'INACTIVE' | 'REVOKED';

/** null — ruxsat; aks holda sabab. `iat` — token berilgan vaqt (soniya). */
export async function checkUserGate(prisma: PrismaService, userId: string, iat: number | undefined): Promise<GateVerdict> {
  const now = Date.now();
  let g = gates.get(userId);
  if (!g || g.exp < now) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { blockedAt: true, deletedAt: true, tokensValidAfter: true } });
    g = {
      blocked: !u || !!u.blockedAt || !!u.deletedAt,
      // Yuqoriga yaxlitlanadi: bekor qilish bilan BIR soniyada berilgan eski token ham rad etiladi
      validAfterSec: u?.tokensValidAfter ? Math.ceil(u.tokensValidAfter.getTime() / 1000) : 0,
      exp: now + TTL,
    };
    if ((invalidatedAt.get(userId) ?? 0) < now) {
      if (gates.size > 20_000) gates.clear();
      gates.set(userId, g);
    }
  }
  if (g.blocked) return 'INACTIVE';
  if (g.validAfterSec && (iat ?? 0) < g.validAfterSec) return 'REVOKED';
  return null;
}

export const USER_REVOKED_EVENT = 'auth.userRevoked';
export interface UserRevokedEvent { userId: string }
const CHANNEL = 'insof:auth:user-revoked';

/**
 * Bekor qilishni barcha instanslarga tarqatadi. Tinglovchilar (masalan TrackingGateway)
 * `@OnEvent(USER_REVOKED_EVENT)` bilan o'z ulanishlarini uzadi.
 */
@Injectable()
export class UserRevocationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('UserRevocation');
  private sub: Redis | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() {
    try {
      this.sub = this.redis.client.duplicate();
      this.sub.on('error', (e: Error) => this.logger.warn(`redis sub: ${e.message}`));
      void this.sub.subscribe(CHANNEL).catch((e: unknown) => this.logger.warn(`subscribe: ${String(e)}`));
      this.sub.on('message', (_ch: string, userId: string) => this.local(userId));
    } catch (e) {
      this.logger.warn(`pub/sub o'chiq: ${String(e)}`);
    }
  }

  async onModuleDestroy() {
    await this.sub?.quit().catch(() => undefined);
  }

  /** Bazadagi o'zgarish (blockedAt/tokensValidAfter/deletedAt) yozilgandan KEYIN chaqiriladi. */
  async revoke(userId: string) {
    this.local(userId);
    await this.redis.client.publish(CHANNEL, userId).catch((e: unknown) => this.logger.warn(`publish: ${String(e)}`));
  }

  private local(userId: string) {
    invalidateUserGate(userId);
    this.events.emit(USER_REVOKED_EVENT, { userId } satisfies UserRevokedEvent);
  }
}

@Global()
@Module({ providers: [UserRevocationService], exports: [UserRevocationService] })
export class UserGateModule {}
