import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Membership } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuthContext } from '../../common/auth/decorators';
import { DomainError } from '../../common/errors/domain.error';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AccountDeleteRequestedEvent, MembershipChangedEvent, ORG_EVENTS } from '../organizations/organizations.events';

/**
 * Hisobni o'chirish — App Store (5.1.1) va Google Play talabi: ilovada o'zi ro'yxatdan o'tgan
 * foydalanuvchi hisobini ilovaning o'zidan o'chira olishi shart.
 *
 * Qoida (buyurtmachi qarori): mijoz (QURUVCHI/TADBIRKOR) — darhol; zavod xodimi (faol HAYDOVCHI
 * a'zoligi bor) — so'rov: ERP direktoriga webhook ketadi, u xodimni ERP'da o'chirgach (a'zolik
 * `removed`) anonimlashtirish o'zi yakunlanadi.
 *
 * "O'chirish" = anonimlashtirish: User qatori tarix (DeliveryEvent, Message, Payout...) bilan FK
 * orqali bog'langan, hard delete mumkin emas. Shaxsiy ma'lumot (telefon, ism, parol) yo'qoladi,
 * telefon `deleted:<id>` bo'ladi — shu raqam bilan qayta ro'yxatdan o'tish mumkin (yangi User).
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Ilovadan: "Hisobni o'chirish" tugmasi. */
  async deleteMe(a: AuthContext): Promise<{ status: 'deleted' | 'requested' }> {
    if (a.integration) throw DomainError.forbidden('Integratsiya kaliti bilan emas');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: a.userId }, include: { memberships: true } });
    if (user.deletedAt) return { status: 'deleted' };
    const employeeOf = user.memberships.filter((m) => m.role === 'HAYDOVCHI' && m.isActive);
    if (employeeOf.length === 0) {
      await this.anonymize(user.id, null);
      return { status: 'deleted' };
    }
    if (!user.deleteRequestedAt) {
      await this.prisma.user.update({ where: { id: user.id }, data: { deleteRequestedAt: new Date() } });
      this.events.emit(ORG_EVENTS.accountDeleteRequested, { userId: user.id, organizationIds: employeeOf.map((m) => m.organizationId) } satisfies AccountDeleteRequestedEvent);
    }
    return { status: 'requested' };
  }

  /** Ilovadan: xodim so'rovini qaytarib olish (direktor hali tasdiqlamagan bo'lsa). */
  async cancelRequest(a: AuthContext) {
    await this.prisma.user.updateMany({ where: { id: a.userId, deletedAt: null }, data: { deleteRequestedAt: null } });
    return { ok: true };
  }

  /**
   * ERP'dan (saytdagi so'rov yoki direktor tasdig'i): telefon bo'yicha o'chirish.
   * Zavod kaliti faqat o'ziga aloqador odamni o'chira oladi: shu zavod haydovchisi, yoki
   * shu zavodga buyurtma/limit bilan bog'langan mijoz tashkiloti a'zosi.
   */
  async deleteByPlant(a: AuthContext, phone: string): Promise<{ status: 'deleted' | 'not_found' }> {
    const user = await this.prisma.user.findUnique({ where: { phone }, include: { memberships: true } });
    if (!user || user.deletedAt) return { status: 'not_found' };
    const orgIds = user.memberships.map((m) => m.organizationId);
    const related =
      user.memberships.some((m) => m.organizationId === a.orgId) ||
      (await this.prisma.order.count({ where: { plantOrgId: a.orgId!, clientOrgId: { in: orgIds } } })) > 0 ||
      (await this.prisma.creditLimit.count({ where: { plantOrgId: a.orgId!, clientOrgId: { in: orgIds } } })) > 0;
    if (!related) throw DomainError.forbidden('Bu foydalanuvchi zavodga aloqador emas');
    await this.anonymize(user.id, a.userId);
    return { status: 'deleted' };
  }

  /** ERP direktori so'rovni rad etdi — belgini olib tashlaymiz (faqat shu zavod haydovchisi). */
  async cancelByPlant(a: AuthContext, userId: string) {
    const m = await this.prisma.membership.findUnique({ where: { userId_organizationId_role: { userId, organizationId: a.orgId!, role: 'HAYDOVCHI' } } });
    if (!m) throw DomainError.notFound('Haydovchi');
    await this.prisma.user.updateMany({ where: { id: userId, deletedAt: null }, data: { deleteRequestedAt: null } });
    return { ok: true };
  }

  /** Direktor ERP'da xodimni o'chirdi → a'zolik `removed` → so'rov qoldirgan bo'lsa yakunlaymiz. */
  @OnEvent(ORG_EVENTS.membershipChanged, { async: true })
  async onMembership(e: MembershipChangedEvent) {
    if (e.isActive) return;
    const user = await this.prisma.user.findUnique({ where: { id: e.userId }, select: { deleteRequestedAt: true, deletedAt: true, memberships: { where: { role: 'HAYDOVCHI', isActive: true }, select: { id: true } } } });
    if (!user?.deleteRequestedAt || user.deletedAt || user.memberships.length > 0) return;
    await this.anonymize(e.userId, e.byUserId);
  }

  /** Shaxsiy ma'lumotni o'chirish; hamma a'zolik o'chadi, sessiya va push manzillari yo'qoladi. */
  async anonymize(userId: string, byUserId: string | null) {
    const now = new Date();
    const removed: Membership[] = [];
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, include: { memberships: { where: { isActive: true } } } });
      if (u.deletedAt) return u;
      for (const m of u.memberships) removed.push(await tx.membership.update({ where: { id: m.id }, data: { isActive: false } }));
      // Faqat shu odamga tegishli tashkilot (masalan "<ism> (xususiy quruvchi)") nomida ism bor — uni ham yashiramiz
      for (const m of u.memberships) {
        const others = await tx.membership.count({ where: { organizationId: m.organizationId, isActive: true } });
        if (others === 0) await tx.organization.update({ where: { id: m.organizationId }, data: { name: "O'chirilgan foydalanuvchi", deletedAt: now } });
      }
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.device.deleteMany({ where: { userId } });
      await tx.otpCode.deleteMany({ where: { phone: u.phone } });
      await tx.driverProfile.updateMany({ where: { userId }, data: { isAvailable: false } });
      return tx.user.update({
        where: { id: userId },
        data: { phone: `deleted:${userId}:${randomBytes(3).toString('hex')}`, fullName: null, passwordHash: null, deletedAt: now, deleteRequestedAt: null },
      });
    });
    for (const m of removed) {
      this.events.emit(ORG_EVENTS.membershipChanged, { organizationId: m.organizationId, membershipId: m.id, userId, role: m.role, isActive: false, reason: 'removed', byUserId } satisfies MembershipChangedEvent);
    }
    this.logger.log(`hisob anonimlashtirildi: ${user.id} (${removed.length} a'zolik)`);
    return user;
  }
}
