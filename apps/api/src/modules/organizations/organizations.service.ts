import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrganizationType, Role } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { SmsPort } from '../../infra/sms/sms.port';
import { MembershipChangedEvent, ORG_EVENTS, VehicleChangedEvent } from './organizations.events';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly sms: SmsPort,
  ) {}

  /**
   * Taklif qilingan odamga ilova haqida xabar. Bu YAGONA kanal: taklif paytida
   * odamda ilova ham, push tokeni ham yo'q — SMS bo'lmasa u taklifdan bexabar qoladi.
   * Taklifning o'zi SMS'ga bog'liq emas: xato faqat jurnalga yoziladi.
   */
  private async notifyInvited(orgId: string, phone: string, role: Role) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    const who = role === 'HAYDOVCHI' ? 'haydovchi' : role === 'QURUVCHI' ? 'quruvchi' : 'xodim';
    const link = process.env.ECO_APP_URL?.trim();
    const text = `Insof ECO: ${org?.name ?? 'Zavod'} sizni ${who} sifatida qo'shdi.${link ? ` Ilova: ${link}` : ''} Telefon raqamingiz bilan kiring.`;
    try {
      await this.sms.send(phone, text);
    } catch (e) {
      this.logger.error(`Taklif SMS'i yuborilmadi (${phone.slice(0, 7)}***): ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private emitMembership(m: { id: string; organizationId: string; userId: string; role: Role; isActive: boolean }, reason: MembershipChangedEvent['reason'], byUserId: string | null) {
    const e: MembershipChangedEvent = { organizationId: m.organizationId, membershipId: m.id, userId: m.userId, role: m.role, isActive: m.isActive, reason, byUserId };
    this.events.emit(ORG_EVENTS.membershipChanged, e);
  }

  /** Yangi tashkilot; yaratuvchi avtomatik TADBIRKOR. */
  async create(userId: string, input: { type: OrganizationType; name: string; inn?: string; address?: string }) {
    return this.prisma.organization.create({
      data: { ...input, memberships: { create: { userId, role: 'TADBIRKOR' } } },
    });
  }

  /**
   * Telefon raqam bo'yicha taklif: foydalanuvchi hali ro'yxatdan o'tmagan bo'lsa ham
   * User yaratiladi va a'zolik biriktiriladi — birinchi kirishda rol tayyor (ADR-0004).
   */
  async invite(orgId: string, phone: string, role: Role, fullName?: string, byUserId: string | null = null) {
    const user = await this.prisma.user.upsert({ where: { phone }, create: { phone, fullName }, update: {} });
    const before = await this.prisma.membership.findUnique({ where: { userId_organizationId_role: { userId: user.id, organizationId: orgId, role } } });
    const membership = await this.prisma.membership.upsert({
      where: { userId_organizationId_role: { userId: user.id, organizationId: orgId, role } },
      create: { userId: user.id, organizationId: orgId, role, invitedByPhone: true },
      update: { isActive: true },
    });
    if (role === 'HAYDOVCHI') {
      await this.prisma.driverProfile.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    }
    if (!before) {
      this.emitMembership(membership, 'invited', byUserId);
      await this.notifyInvited(orgId, phone, role);
    } else if (!before.isActive) {
      this.emitMembership(membership, 'approved', byUserId);
    }
    return membership;
  }

  members(orgId: string) {
    return this.prisma.membership.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isActive: 'asc' }, { createdAt: 'desc' }],
      include: { user: { select: { id: true, phone: true, fullName: true, driverProfile: true } } },
    });
  }

  /** Ro'yxatdan o'tgan haydovchini tasdiqlash (isActive=true). */
  async approve(orgId: string, membershipId: string, byUserId: string | null = null) {
    const m = await this.prisma.membership.findFirst({ where: { id: membershipId, organizationId: orgId } });
    if (!m) throw new DomainError('NOT_FOUND', 'A\'zolik topilmadi');
    const upd = await this.prisma.membership.update({ where: { id: m.id }, data: { isActive: true } });
    if (!m.isActive) this.emitMembership(upd, 'approved', byUserId);
    return { ok: true };
  }

  async remove(orgId: string, membershipId: string, byUserId: string | null = null) {
    const m = await this.prisma.membership.findFirst({ where: { id: membershipId, organizationId: orgId } });
    if (!m) return { ok: true };
    const upd = await this.prisma.membership.update({ where: { id: m.id }, data: { isActive: false } });
    if (m.isActive) this.emitMembership(upd, 'removed', byUserId);
    return { ok: true };
  }

  /** ERP uchun: foydalanuvchi id bo'yicha HAYDOVCHI a'zoligini tasdiqlash/bloklash. */
  async setDriverActive(orgId: string, userId: string, isActive: boolean, byUserId: string | null) {
    const m = await this.prisma.membership.findUnique({ where: { userId_organizationId_role: { userId, organizationId: orgId, role: 'HAYDOVCHI' } } });
    if (!m) throw new DomainError('NOT_FOUND', 'Bu foydalanuvchi zavod haydovchisi emas');
    if (m.isActive === isActive) return m;
    const upd = await this.prisma.membership.update({ where: { id: m.id }, data: { isActive } });
    this.emitMembership(upd, isActive ? 'approved' : 'removed', byUserId);
    return upd;
  }

  /** Zavodlar ro'yxati — Quruvchi buyurtma berishda tanlaydi. */
  plants() {
    return this.prisma.organization.findMany({ where: { type: 'PLANT', deletedAt: null }, select: { id: true, name: true, address: true } });
  }

  vehicles(orgId: string) {
    return this.prisma.vehicle.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: { plateNumber: 'asc' } });
  }

  async addVehicle(orgId: string, input: { plateNumber: string; capacityM3: number; type?: 'MIXER' | 'PUMP' | 'DUMP' }, byUserId: string | null = null) {
    const v = await this.prisma.vehicle.create({ data: { organizationId: orgId, ...input } });
    this.vehicleChanged(v.organizationId, v.id, byUserId);
    return v;
  }

  vehicleChanged(organizationId: string, vehicleId: string, byUserId: string | null) {
    const e: VehicleChangedEvent = { organizationId, vehicleId, byUserId };
    this.events.emit(ORG_EVENTS.vehicleChanged, e);
  }
}
