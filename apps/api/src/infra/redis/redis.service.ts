import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: 3 });

  /** Sliding-window rate limit: true = ruxsat. */
  async allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    // INCR va TTL bitta safarda. Avval `n === 1` dagina EXPIRE qo'yilardi: shu ikki buyruq orasida
    // ulanish uzilsa kalit muddatsiz qolib, raqam (masalan OTP) abadiy bloklanardi.
    const res = await this.client.multi().incr(key).ttl(key).exec();
    const n = Number(res?.[0]?.[1] ?? 0);
    const ttl = Number(res?.[1]?.[1] ?? -1);
    if (ttl < 0) await this.client.expire(key, windowSeconds);
    return n <= limit;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
