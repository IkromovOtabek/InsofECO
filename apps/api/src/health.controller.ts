import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/auth/decorators';
import { PrismaService } from './infra/prisma/prisma.service';
import { RedisService } from './infra/redis/redis.service';

/** Tekshiruv osilib qolsa health ham osilmasin — balanser/docker vaqtida javob olsin. */
const within = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Jonlilik (liveness): jarayon va baza. Docker healthcheck shu manzilni ishlatadi. */
  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', at: new Date().toISOString() };
  }

  /**
   * Tayyorlik (readiness): baza VA Redis (navbatlar, OTP cheklovlari). Redis yo'q bo'lsa API
   * ishlayotgandek ko'rinadi-yu, OTP va SLA ishlamaydi — balanser trafikni yubormasligi kerak.
   */
  @Public()
  @Get('ready')
  async ready() {
    const [db, redis] = await Promise.allSettled([
      within(this.prisma.$queryRaw`SELECT 1`, 3000),
      within(this.redis.client.ping(), 3000),
    ]);
    const body = { db: db.status === 'fulfilled' ? 'ok' : 'down', redis: redis.status === 'fulfilled' ? 'ok' : 'down', at: new Date().toISOString() };
    if (body.db !== 'ok' || body.redis !== 'ok') throw new ServiceUnavailableException(body);
    return { status: 'ok', ...body };
  }
}
