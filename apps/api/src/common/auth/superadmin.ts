import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../errors/domain.error';
import { AuthContext } from './decorators';

/**
 * Superadmin — platforma darajasidagi huquq (dasturchi), a'zolik roli EMAS.
 *
 * Ko'rinmaslik qoidasi: superadmin hech qaysi tashkilot ro'yxatida (xodimlar, kontaktlar,
 * haydovchilar, sanoqlar, ERP qidiruvi) chiqmasligi kerak. Foydalanuvchilarni sanaydigan yoki
 * ro'yxatlaydigan har bir Prisma so'roviga shu bo'laklardan biri qo'shiladi.
 */
export const VISIBLE_USER = { isSuperAdmin: false } as const;
/** `membership.findMany({ where: { ..., ...VISIBLE_MEMBER } })` */
export const VISIBLE_MEMBER = { user: VISIBLE_USER } as const;

/**
 * Ixtiyoriy ikkinchi qulf: `SUPERADMIN_PHONES` (vergul bilan) berilgan bo'lsa, bazadagi bayroqdan
 * tashqari raqam ham shu ro'yxatda bo'lishi shart — faqat bazaga yozish huquqi bilan superadmin
 * bo'lib bo'lmaydi. Bo'sh bo'lsa faqat bayroq tekshiriladi.
 */
export function superAdminPhones(): Set<string> | null {
  const raw = (process.env.SUPERADMIN_PHONES ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  return raw.length ? new Set(raw) : null;
}

/**
 * /admin/* himoyasi. Global JwtAuthGuard (token) va PolicyGuard'dan KEYIN ishlaydi va har so'rovda
 * bazadan tekshiradi (kesh yo'q — huquq olib tashlansa darhol kuchga kiradi).
 * Superadmin bo'lmaganga 404 qaytariladi: bo'lim borligi ham oshkor qilinmaydi.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  private readonly logger = new Logger('SuperAdminGuard');
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const auth = req.auth;
    const hidden = () => {
      // Urinish logga tushadi (kim, qaysi yo'l) — kimdir admin API'ni paypaslayotganini ko'rish uchun
      this.logger.warn(`rad etildi: user=${auth?.userId ?? '-'} ${req.method} ${req.path}`);
      return new DomainError('NOT_FOUND', 'Sahifa topilmadi');
    };
    // API kalit (ERP integratsiyasi) bilan hech qachon
    if (!auth?.userId || auth.integration) throw hidden();
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      select: { phone: true, isSuperAdmin: true, blockedAt: true, deletedAt: true },
    });
    if (!user?.isSuperAdmin || user.blockedAt || user.deletedAt) throw hidden();
    const allow = superAdminPhones();
    if (allow && !allow.has(user.phone)) throw hidden();
    return true;
  }
}
