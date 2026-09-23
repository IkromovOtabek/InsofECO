import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import { RedisService } from '../../infra/redis/redis.service';
import { AuthContext } from '../auth/decorators';

const TTL_SECONDS = 24 * 3600;

/**
 * Idempotency-Key header bo'lgan POST/PUT/PATCH so'rovlar: (userId + key) → javob 24 soat keshda.
 * Mobil offline outbox shu orqali xavfsiz qayta yuboradi (ADR-0006).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const key = req.headers['idempotency-key'];
    if (!key || typeof key !== 'string' || !['POST', 'PUT', 'PATCH'].includes(req.method)) return next.handle();

    const cacheKey = `idem:${req.auth?.userId ?? 'anon'}:${key}`;
    return from(this.redis.client.get(cacheKey)).pipe(
      switchMap((cached) => {
        if (cached) {
          const { status, body } = JSON.parse(cached) as { status: number; body: unknown };
          res.status(status);
          res.setHeader('Idempotent-Replayed', 'true');
          return of(body);
        }
        return next.handle().pipe(
          tap((body) => {
            void this.redis.client.set(cacheKey, JSON.stringify({ status: res.statusCode, body }), 'EX', TTL_SECONDS);
          }),
        );
      }),
    );
  }
}
