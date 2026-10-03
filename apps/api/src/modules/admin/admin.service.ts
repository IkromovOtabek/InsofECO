import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeliveryStatus, Prisma } from '@prisma/client';
import { ACTIVE_DELIVERY_STATUSES } from '@insof/shared';
import { DomainError } from '../../common/errors/domain.error';
import { startOfTashkentDay } from '../../common/time';
import { UserRevocationService } from '../../common/auth/user-gate';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PushService } from '../../infra/push/push.service';
import { MembershipChangedEvent, ORG_EVENTS } from '../organizations/organizations.events';
import { BlockInput, BroadcastInput, ConfigSetInput, MembershipSetInput, OrgListQuery, UserListQuery } from './admin.schemas';

const digits = (q: string) => q.replace(/\D/g, '');

/**
 * Superadmin amallari. Bu servis faqat SuperAdminGuard ortidagi AdminController'dan chaqiriladi.
 * Muhim qoidalar:
 *  - superadmin o'zini yoki boshqa superadminni bloklay olmaydi (qulflanib qolmaslik uchun —
 *    superadmin huquqi faqat `scripts/grant-superadmin.ts` bilan olinadi/beriladi);
 *  - bloklash = barcha seanslar yopiladi + access tokenlar darhol rad etiladi (JwtAuthGuard);
 *  - a'zolik o'zgarishi ERP'ga ham boradi (ORG_EVENTS.membershipChanged).
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly events: EventEmitter2,
    private readonly revocation: UserRevocationService,
  ) {}

  // ───────────────────────── Umumiy ko'rinish ─────────────────────────

  async overview() {
    const today = startOfTashkentDay();
    const active = ACTIVE_DELIVERY_STATUSES as unknown as DeliveryStatus[];
    const [users, usersToday, blockedUsers, orgs, blockedOrgs, ordersToday, ordersByStatus, deliveriesToday, deliveriesByStatus, activeDeliveries, slaToday, devices24h] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null, isSuperAdmin: false } }),
      this.prisma.user.count({ where: { deletedAt: null, isSuperAdmin: false, createdAt: { gte: today } } }),
      this.prisma.user.count({ where: { blockedAt: { not: null } } }),
      this.prisma.organization.groupBy({ by: ['type'], where: { deletedAt: null }, _count: { _all: true } }),
      this.prisma.organization.count({ where: { blockedAt: { not: null } } }),
      this.prisma.order.count({ where: { createdAt: { gte: today } } }),
      this.prisma.order.groupBy({ by: ['status'], where: { createdAt: { gte: today } }, _count: { _all: true } }),
      this.prisma.delivery.count({ where: { plannedAt: { gte: today, lt: new Date(today.getTime() + 86_400_000) } } }),
      this.prisma.delivery.groupBy({ by: ['status'], where: { plannedAt: { gte: today, lt: new Date(today.getTime() + 86_400_000) } }, _count: { _all: true } }),
      this.prisma.delivery.count({ where: { status: { in: active } } }),
      this.prisma.delivery.count({ where: { slaBreached: true, plannedAt: { gte: today } } }),
      this.prisma.device.count({ where: { lastSeenAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    ]);
    const orgBy = Object.fromEntries(orgs.map((o) => [o.type, o._count._all])) as Record<string, number>;
    return {
      since: today.toISOString(),
      users: { total: users, today: usersToday, blocked: blockedUsers },
      organizations: { plants: orgBy.PLANT ?? 0, contractors: orgBy.CONTRACTOR ?? 0, blocked: blockedOrgs },
      orders: { today: ordersToday, byStatus: Object.fromEntries(ordersByStatus.map((x) => [x.status, x._count._all])) },
      deliveries: { today: deliveriesToday, active: activeDeliveries, slaBreachedToday: slaToday, byStatus: Object.fromEntries(deliveriesByStatus.map((x) => [x.status, x._count._all])) },
      devices: { active24h: devices24h },
    };
  }

  // ───────────────────────── Tashkilotlar ─────────────────────────

  async organizations(q: OrgListQuery) {
    const text = q.q?.trim();
    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(q.type ? { type: q.type } : {}),
      ...(q.blocked === undefined ? {} : q.blocked ? { blockedAt: { not: null } } : { blockedAt: null }),
      ...(text ? { OR: [{ name: { contains: text, mode: 'insensitive' } }, { inn: { contains: text } }, { id: text }] } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where, orderBy: { createdAt: 'desc' }, take: q.limit, skip: q.offset,
        select: {
          id: true, name: true, type: true, inn: true, address: true, externalRef: true, blockedAt: true, blockedReason: true, createdAt: true,
          _count: { select: { memberships: { where: { isActive: true } }, ordersAsPlant: true, ordersAsClient: true } },
        },
      }),
    ]);
    return { total, rows: rows.map(({ _count, ...o }) => ({ ...o, members: _count.memberships, orders: _count.ordersAsPlant + _count.ordersAsClient })) };
  }

  async organization(id: string) {
    const o = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        memberships: { orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }], take: 200, include: { user: { select: { id: true, phone: true, fullName: true, blockedAt: true, isSuperAdmin: true } } } },
        integrations: { select: { id: true, name: true, keyPrefix: true, isActive: true, lastUsedAt: true, webhookUrl: true } },
        _count: { select: { ordersAsPlant: true, ordersAsClient: true, vehicles: true, sites: true } },
      },
    });
    if (!o) throw DomainError.notFound('Tashkilot');
    const today = startOfTashkentDay();
    const ordersToday = await this.prisma.order.count({ where: { createdAt: { gte: today }, OR: [{ plantOrgId: id }, { clientOrgId: id }] } });
    return {
      id: o.id, name: o.name, type: o.type, inn: o.inn, address: o.address, externalRef: o.externalRef,
      blockedAt: o.blockedAt, blockedReason: o.blockedReason, createdAt: o.createdAt, deletedAt: o.deletedAt,
      counts: { ordersAsPlant: o._count.ordersAsPlant, ordersAsClient: o._count.ordersAsClient, vehicles: o._count.vehicles, sites: o._count.sites, ordersToday },
      members: o.memberships.map((m) => ({ id: m.id, role: m.role, isActive: m.isActive, createdAt: m.createdAt, user: m.user })),
      // Kalit xeshi hech qachon qaytmaydi; webhook — faqat origin
      integrations: o.integrations.map((i) => ({ ...i, webhookUrl: i.webhookUrl ? safeOrigin(i.webhookUrl) : null })),
    };
  }

  async blockOrganization(id: string, input: BlockInput) {
    const o = await this.prisma.organization.findUnique({ where: { id }, select: { id: true } });
    if (!o) throw DomainError.notFound('Tashkilot');
    await this.prisma.organization.update({ where: { id }, data: { blockedAt: new Date(), blockedReason: input.reason } });
    return { ok: true };
  }

  async unblockOrganization(id: string) {
    await this.prisma.organization.updateMany({ where: { id }, data: { blockedAt: null, blockedReason: null } });
    return { ok: true };
  }

  // ───────────────────────── Foydalanuvchilar ─────────────────────────

  async users(q: UserListQuery) {
    const text = q.q?.trim();
    const d = text ? digits(text) : '';
    const or: Prisma.UserWhereInput[] = [];
    if (text) {
      or.push({ fullName: { contains: text, mode: 'insensitive' } }, { id: text });
      if (d.length >= 3) or.push({ phone: { contains: d } });
    }
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(q.blocked === undefined ? {} : q.blocked ? { blockedAt: { not: null } } : { blockedAt: null }),
      ...(q.role || q.organizationId ? { memberships: { some: { ...(q.role ? { role: q.role } : {}), ...(q.organizationId ? { organizationId: q.organizationId } : {}) } } } : {}),
      ...(or.length ? { OR: or } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where, orderBy: { createdAt: 'desc' }, take: q.limit, skip: q.offset,
        select: {
          id: true, phone: true, fullName: true, isSuperAdmin: true, blockedAt: true, createdAt: true,
          memberships: { select: { role: true, isActive: true, organization: { select: { id: true, name: true } } }, take: 5 },
          devices: { select: { lastSeenAt: true }, orderBy: { lastSeenAt: 'desc' }, take: 1 },
        },
      }),
    ]);
    return { total, rows: rows.map(({ devices, ...u }) => ({ ...u, lastSeenAt: devices[0]?.lastSeenAt ?? null })) };
  }

  async user(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, phone: true, fullName: true, locale: true, isSuperAdmin: true, blockedAt: true, blockedReason: true, tokensValidAfter: true,
        deleteRequestedAt: true, deletedAt: true, createdAt: true, passwordHash: true,
        memberships: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, isActive: true, createdAt: true, organization: { select: { id: true, name: true, type: true, blockedAt: true } } } },
        devices: { orderBy: { lastSeenAt: 'desc' }, take: 10, select: { id: true, platform: true, model: true, appVersion: true, lastSeenAt: true, expoPushToken: true } },
      },
    });
    if (!u) throw DomainError.notFound('Foydalanuvchi');
    const activeSessions = await this.prisma.session.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } });
    const { passwordHash, devices, ...rest } = u;
    return {
      ...rest,
      hasPassword: !!passwordHash,
      activeSessions,
      // Push token o'zi qaytmaydi — faqat bor/yo'qligi
      devices: devices.map(({ expoPushToken, ...dv }) => ({ ...dv, push: !!expoPushToken })),
    };
  }

  private async target(actorId: string, id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true, isSuperAdmin: true, deletedAt: true } });
    if (!u || u.deletedAt) throw DomainError.notFound('Foydalanuvchi');
    if (u.id === actorId) throw DomainError.forbidden('O\'zingizga bu amalni qo\'llab bo\'lmaydi');
    return u;
  }

  async blockUser(actorId: string, id: string, input: BlockInput) {
    const u = await this.target(actorId, id);
    if (u.isSuperAdmin) throw DomainError.forbidden('Superadminni bloklab bo\'lmaydi — avval huquqini skript bilan oling');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { blockedAt: now, blockedReason: input.reason, tokensValidAfter: now } }),
      this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    await this.revocation.revoke(id);
    return { ok: true };
  }

  async unblockUser(actorId: string, id: string) {
    await this.target(actorId, id);
    await this.prisma.user.update({ where: { id }, data: { blockedAt: null, blockedReason: null } });
    await this.revocation.revoke(id);
    return { ok: true };
  }

  /** Barcha qurilmalardan chiqarish: refresh tokenlar bekor, access tokenlar darhol yaroqsiz. */
  async revokeSessions(actorId: string, id: string) {
    await this.target(actorId, id);
    const now = new Date();
    // Avval User qatori (refresh shu qatorni FOR UPDATE bilan qulflaydi — poyga yopiladi), keyin sessiyalar
    const [, r] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { tokensValidAfter: now } }),
      this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    await this.revocation.revoke(id);
    return { ok: true, revoked: r.count };
  }

  /** A'zolik qo'shish yoki holatini o'rnatish (tashkilot + rol bo'yicha bitta). */
  async setMembership(actorId: string, userId: string, input: MembershipSetInput) {
    const u = await this.target(actorId, userId);
    // Superadmin tashkilotga bog'lanmaydi — aks holda direktorning xodimlar ro'yxatida paydo bo'lardi
    if (u.isSuperAdmin) throw DomainError.forbidden('Superadminga tashkilot roli berilmaydi');
    const org = await this.prisma.organization.findFirst({ where: { id: input.organizationId, deletedAt: null }, select: { id: true, type: true } });
    if (!org) throw DomainError.notFound('Tashkilot');
    if (input.role === 'HAYDOVCHI' && org.type !== 'PLANT') throw new DomainError('VALIDATION', 'Haydovchi faqat zavodga biriktiriladi');
    const before = await this.prisma.membership.findUnique({ where: { userId_organizationId_role: { userId, organizationId: org.id, role: input.role } } });
    const m = await this.prisma.membership.upsert({
      where: { userId_organizationId_role: { userId, organizationId: org.id, role: input.role } },
      create: { userId, organizationId: org.id, role: input.role, isActive: input.isActive },
      update: { isActive: input.isActive },
    });
    if (input.role === 'HAYDOVCHI') await this.prisma.driverProfile.upsert({ where: { userId }, create: { userId }, update: {} });
    if (!before || before.isActive !== m.isActive) this.emitMembership(m, !before ? 'invited' : m.isActive ? 'approved' : 'removed', actorId);
    return m;
  }

  async patchMembership(actorId: string, userId: string, membershipId: string, isActive: boolean) {
    const u = await this.target(actorId, userId);
    // setMembership bilan bir xil qoida: superadminning a'zoligini faollashtirib bo'lmaydi (o'chirish mumkin)
    if (u.isSuperAdmin && isActive) throw DomainError.forbidden('Superadminga tashkilot roli berilmaydi');
    const m = await this.prisma.membership.findFirst({ where: { id: membershipId, userId } });
    if (!m) throw DomainError.notFound('A\'zolik');
    if (m.isActive === isActive) return m;
    const upd = await this.prisma.membership.update({ where: { id: m.id }, data: { isActive } });
    this.emitMembership(upd, isActive ? 'approved' : 'removed', actorId);
    return upd;
  }

  private emitMembership(m: { id: string; organizationId: string; userId: string; role: MembershipChangedEvent['role']; isActive: boolean }, reason: MembershipChangedEvent['reason'], byUserId: string) {
    this.events.emit(ORG_EVENTS.membershipChanged, { organizationId: m.organizationId, membershipId: m.id, userId: m.userId, role: m.role, isActive: m.isActive, reason, byUserId } satisfies MembershipChangedEvent);
  }

  // ───────────────────────── Ommaviy bildirishnoma ─────────────────────────

  async broadcast(actorId: string, input: BroadcastInput) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null, blockedAt: null, isSuperAdmin: false,
      ...(input.role || input.organizationId
        ? { memberships: { some: { isActive: true, ...(input.role ? { role: input.role } : {}), ...(input.organizationId ? { organizationId: input.organizationId } : {}) } } }
        : {}),
    };
    // Sanoq — relation filtr bilan (50k id'ni IN ga qo'yish Postgres'ning 32767 parametr chegarasidan oshardi)
    const [recipients, devices] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.device.count({ where: { expoPushToken: { not: null }, user: where } }),
    ]);
    if (input.dryRun || recipients === 0) return { recipients, devices, sent: false };

    const data = { kind: 'broadcast' } as Prisma.InputJsonObject;
    // Kursor bilan 1000 tadan: xotira cheklangan, hech kim "take" chegarasidan tushib qolmaydi
    const pages = async (fn: (ids: string[]) => Promise<void>) => {
      let cursor: string | undefined;
      for (;;) {
        const page = await this.prisma.user.findMany({ where, select: { id: true }, orderBy: { id: 'asc' }, take: 1000, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) });
        if (!page.length) return;
        await fn(page.map((u) => u.id));
        cursor = page[page.length - 1]!.id;
      }
    };
    let sent = 0;
    await pages(async (ids) => {
      const r = await this.prisma.notification.createMany({ data: ids.map((userId) => ({ userId, type: 'ADMIN_BROADCAST', title: input.title, body: input.body, data })) });
      sent += r.count;
    });
    // Push fon rejimida, 100 tadan (Expo cheklovi) — javob kutib qolmaydi
    void pages(async (ids) => {
      const tokens = await this.prisma.device.findMany({ where: { userId: { in: ids }, expoPushToken: { not: null } }, select: { expoPushToken: true } });
      const to = tokens.map((t) => t.expoPushToken!);
      for (let j = 0; j < to.length; j += 100) await this.push.send({ to: to.slice(j, j + 100), title: input.title, body: input.body, data: { kind: 'broadcast' }, channel: 'oddiy' });
    }).catch((e: unknown) => this.logger.error(`broadcast push: ${String(e)}`));
    this.logger.log(`broadcast by ${actorId}: ${sent} foydalanuvchi`);
    return { recipients: sent, devices, sent: true };
  }

  // ───────────────────────── Sozlamalar (feature flag) ─────────────────────────

  configList() {
    return this.prisma.appConfig.findMany({ orderBy: { key: 'asc' } });
  }

  configSet(actorId: string, key: string, input: ConfigSetInput) {
    const value = (input.value ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull;
    return this.prisma.appConfig.upsert({
      where: { key },
      create: { key, value, isPublic: input.isPublic, description: input.description, updatedById: actorId },
      update: { value, isPublic: input.isPublic, description: input.description, updatedById: actorId },
    });
  }

  async configDelete(key: string) {
    await this.prisma.appConfig.deleteMany({ where: { key } });
    return { ok: true };
  }

  /** Ilovaga ochiq sozlamalar (`isPublic`) — kalit → qiymat. */
  async publicConfig() {
    const rows = await this.prisma.appConfig.findMany({ where: { isPublic: true }, select: { key: true, value: true } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  // ───────────────────────── Jurnal ─────────────────────────

  audit(limit: number, offset: number) {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' }, take: limit, skip: offset,
      select: { id: true, action: true, targetType: true, targetId: true, status: true, createdAt: true, actor: { select: { id: true, fullName: true, phone: true } } },
    });
  }
}

const safeOrigin = (u: string) => { try { return new URL(u).origin; } catch { return null; } };
