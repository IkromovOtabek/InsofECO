import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, catchError, from, of, switchMap, tap, throwError } from 'rxjs';
import { RedisService } from '../../infra/redis/redis.service';
import { DomainError } from '../errors/domain.error';
import { AuthContext } from '../auth/decorators';

const TTL_SECONDS = 24 * 3600;
/** Birinchi so'rov shuncha vaqt ichida tugamasa qulf o'zi tushadi (osilib qolgan so'rov keyingisini abadiy to'smasin). */
const LOCK_SECONDS = 30;

/**
 * Idempotency-Key header bo'lgan POST/PUT/PATCH so'rovlar: (userId + method + yo'l + key) → javob 24 soat keshda.
 * Mobil offline outbox shu orqali xavfsiz qayta yuboradi (ADR-0006).
 *
 *  - Faqat autentifikatsiyadan o'tgan so'rovlar: ilgari @Public yo'llar (login/OTP/refresh) ham `idem:anon:<key>`
 *    ostida keshlanardi — token bor javob mijoz tanlagan kalit bilan 24 soat qaytarilardi.
 *  - Kalit yo'lga bog'langan: bir xil kalit bilan boshqa endpoint'ga yuborilsa eski javob qaytmaydi.
 *  - `SET NX` qulf: bir xil kalit bilan PARALLEL ikki so'rov — ikkinchisi 409 oladi (ilgari ikkalasi ham bajarilardi).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const key = req.headers['idempotency-key'];
    if (!key || typeof key !== 'string' || !['POST', 'PUT', 'PATCH'].includes(req.method)) return next.handle();
    const userId = req.auth?.userId;
    if (!userId) return next.handle();

    const cacheKey = `idem:${userId}:${req.method}:${req.path}:${key}`;
    const lockKey = `${cacheKey}:lock`;
    const redis = this.redis.client;

    return from(
      (async () => {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as { status: number; body: unknown };
        const locked = await redis.set(lockKey, '1', 'EX', LOCK_SECONDS, 'NX');
        if (!locked) throw new DomainError('IDEMPOTENCY_CONFLICT', "Bu so'rov hozir bajarilmoqda — biroz kutib qayta urining");
        return null;
      })(),
    ).pipe(
      switchMap((replay) => {
        if (replay) {
          res.status(replay.status);
          res.setHeader('Idempotent-Replayed', 'true');
          return of(replay.body);
        }
        return next.handle().pipe(
          tap((body) => {
            void redis
              .multi()
              .set(cacheKey, JSON.stringify({ status: res.statusCode, body }), 'EX', TTL_SECONDS)
              .del(lockKey)
              .exec()
              .catch(() => undefined);
          }),
          // Xato keshlanmaydi — qulf tushadi, mijoz qayta urinishi mumkin
          catchError((e: unknown) => from(redis.del(lockKey).catch(() => 0)).pipe(switchMap(() => throwError(() => e)))),
        );
      }),
    );
  }
}
