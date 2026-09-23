import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthContext } from '../../../common/auth/decorators';
import { DomainError } from '../../../common/errors/domain.error';

/** Faqat X-Api-Key bilan kirgan tashqi tizim uchun (mobil JWT sessiyasi bu yerga kira olmaydi). */
@Injectable()
export class IntegrationGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const { auth } = ctx.switchToHttp().getRequest<{ auth?: AuthContext }>();
    if (!auth?.integration) throw DomainError.forbidden('Bu endpoint faqat integratsiya kaliti (X-Api-Key) bilan ochiladi');
    return true;
  }
}
