import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuthContext } from '../../common/auth/decorators';
import { DomainError } from '../../common/errors/domain.error';
import { PrismaService } from '../../infra/prisma/prisma.service';

/** Jurnalga yozilmaydigan maydonlar (ehtiyot uchun — admin API bularni qabul qilmaydi ham). */
const SECRET_KEYS = /pass|token|secret|code|key/i;

function scrub(v: unknown, depth = 0): unknown {
  if (depth > 4 || v === null || v === undefined) return v ?? null;
  if (typeof v === 'string') return v.length > 500 ? `${v.slice(0, 500)}…` : v;
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => scrub(x, depth + 1));
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = SECRET_KEYS.test(k) && k !== 'key' ? '[yashirin]' : scrub(x, depth + 1);
    return out;
  }
  return v;
}

/**
 * Har bir /admin/* so'rovi AdminAuditLog'ga yoziladi: kim, qaysi amal, qaysi obyekt, natija.
 * Yozuv javobni kutdirmaydi; yozib bo'lmasa — log, lekin amal bekor qilinmaydi.
 * O'qish (GET) ham yoziladi — kim qaysi foydalanuvchi ma'lumotini ko'rgani ham iz qoldiradi (holat telemetriyasidan tashqari).
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AdminAudit');
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const actorId = req.auth?.userId;
    const route = (req.route?.path as string | undefined) ?? req.path;
    const action = `${req.method} ${route.replace(/^\/v\d+/, '')}`;
    const params = (req.params ?? {}) as Record<string, string>;
    const targetId = params.id ?? params.key ?? null;
    const targetType = /\/organizations/.test(route) ? 'organization' : /\/users/.test(route) ? 'user' : /\/config/.test(route) ? 'config' : null;
    // Holat paneli har 15 s so'raydi — telemetriya jurnalni to'ldirib yubormasin (xato bo'lsa baribir yoziladi)
    const telemetry = req.method === 'GET' && /\/admin\/(health|overview)$/.test(route);
    const write = (status: number, extra?: Record<string, unknown>) => {
      if (!actorId || (telemetry && status < 400)) return;
      const payload = scrub({ params, query: req.query, body: req.method === 'GET' ? undefined : req.body, ...extra }) as Prisma.InputJsonValue;
      void this.prisma.adminAuditLog
        .create({ data: { actorId, action, targetType, targetId, payload, status, ip: req.ip ?? null } })
        .catch((e: unknown) => this.logger.error(`audit yozilmadi: ${String(e)}`));
    };
    return next.handle().pipe(
      tap(() => write(res.statusCode)),
      catchError((err: unknown) => {
        const status = err instanceof DomainError ? err.status : err instanceof HttpException ? err.getStatus() : 500;
        write(status, { error: err instanceof Error ? err.message.slice(0, 200) : 'xato' });
        return throwError(() => err);
      }),
    );
  }
}
