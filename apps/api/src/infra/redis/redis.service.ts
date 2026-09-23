import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: 3 });

  /** Sliding-window rate limit: true = ruxsat. */
  async allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const n = await this.client.incr(key);
    if (n === 1) await this.client.expire(key, windowSeconds);
    return n <= limit;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
