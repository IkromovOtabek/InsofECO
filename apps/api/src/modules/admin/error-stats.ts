import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, catchError, throwError } from 'rxjs';
import { DomainError } from '../../common/errors/domain.error';

export interface RecentError { at: string; method: string; path: string; status: number; message: string }

/**
 * Server xatolari hisoblagichi (jarayon xotirasida) — /admin/health dagi "oxirgi xatolar".
 * Faqat 5xx (kutilmagan xato) sanaladi; 4xx — foydalanuvchi xatosi, holatga ta'sir qilmaydi.
 * Matn qisqartiriladi va so'rov tanasi/sarlavhalari saqlanmaydi (shaxsiy ma'lumot sizmasin).
 */
class ErrorStats {
  total = 0;
  private stamps: number[] = [];
  private recent: RecentError[] = [];

  record(e: RecentError) {
    this.total++;
    const now = Date.now();
    this.stamps.push(now);
    if (this.stamps.length > 5000) this.stamps = this.stamps.slice(-5000);
    this.recent.unshift(e);
    if (this.recent.length > 20) this.recent.length = 20;
  }

  snapshot() {
    const now = Date.now();
    this.stamps = this.stamps.filter((t) => now - t < 24 * 3600_000);
    return {
      total: this.total,
      lastHour: this.stamps.filter((t) => now - t < 3600_000).length,
      last24h: this.stamps.length,
      recent: this.recent.slice(0, 10),
    };
  }
}

export const errorStats = new ErrorStats();

const statusOf = (e: unknown) => (e instanceof DomainError ? e.status : e instanceof HttpException ? e.getStatus() : 500);

/** Global (APP_INTERCEPTOR) — barcha HTTP so'rovlar xatolarini kuzatadi va o'zgartirmasdan qaytaradi. */
@Injectable()
export class ErrorStatsInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    return next.handle().pipe(
      catchError((err: unknown) => {
        const status = statusOf(err);
        if (status >= 500) {
          const req = ctx.switchToHttp().getRequest<Request>();
          errorStats.record({
            at: new Date().toISOString(),
            method: req.method,
            // Query (token, telefon bo'lishi mumkin) yozilmaydi
            path: (req.route?.path as string | undefined) ?? req.path,
            status,
            message: (err instanceof Error ? err.message : String(err)).slice(0, 200),
          });
        }
        return throwError(() => err);
      }),
    );
  }
}
