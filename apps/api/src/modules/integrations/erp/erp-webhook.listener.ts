import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createHmac } from 'crypto';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { DeliveryStatusChangedEvent } from '../../deliveries/deliveries.events';
import { AccountDeleteRequestedEvent, MembershipChangedEvent, ORG_EVENTS, UserUpdatedEvent, VehicleChangedEvent } from '../../organizations/organizations.events';
import { customerRefFor, parseCustomerRef } from './erp-refs';

/**
 * ECO → ERP webhook. Haydovchi ilovada tugma bosganda (qabul, yuklash, yo'lda, keldi, imzo)
 * ERP nakladnoy holati ham o'zgarishi kerak. Faqat externalRef'li (ERP'dan kelgan) reyslar.
 *
 * Imzo: `X-Eco-Signature: sha256=HMAC(secret, "<timestamp>.<body>")`, `X-Eco-Timestamp` — replay himoyasi.
 * 3 urinish (1s, 5s, 15s). Yetib bormasa log — ERP o'z tomonidan GET /v1/erp/trips/:ref bilan sinxronlaydi.
 */
@Injectable()
export class ErpWebhookListener {
  private readonly logger = new Logger(ErpWebhookListener.name);
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('delivery.status_changed', { async: true })
  async onDelivery(e: DeliveryStatusChangedEvent) {
    const d = await this.prisma.delivery.findUnique({
      where: { id: e.deliveryId },
      include: {
        order: { select: { number: true, externalRef: true, plantOrgId: true } },
        driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        vehicle: { select: { plateNumber: true } },
        events: { orderBy: { receivedAt: 'desc' }, take: 1, select: { note: true, lat: true, lng: true, photoKey: true } },
      },
    });
    if (!d?.externalRef) return;
    const clients = await this.prisma.integrationClient.findMany({ where: { organizationId: d.order.plantOrgId, isActive: true, webhookUrl: { not: null } } });
    if (clients.length === 0) return;

    const last = d.events[0];
    const payload = {
      event: 'delivery.status_changed',
      externalRef: d.externalRef,
      orderRef: d.order.externalRef,
      deliveryId: d.id,
      ecoOrderNumber: d.order.number,
      from: e.from,
      to: e.to,
      at: e.at.toISOString(),
      driver: d.driver ? { userId: d.driver.user.id, fullName: d.driver.user.fullName, phone: d.driver.user.phone } : null,
      vehiclePlate: d.vehicle?.plateNumber ?? null,
      loadedM3: d.loadedM3 ? Number(d.loadedM3) : null,
      acceptedM3: d.acceptedM3 ? Number(d.acceptedM3) : null,
      note: last?.note ?? null,
      location: last?.lat != null && last?.lng != null ? { lat: last.lat, lng: last.lng } : null,
      photoKey: last?.photoKey ?? d.waybillPhotoKey ?? null,
      signed: !!d.signatureKey,
      slaBreached: d.slaBreached,
    };
    for (const c of clients) {
      // ERP o'zi yuborgan o'zgarishni ham qaytaramiz (byIntegration=true) — ERP uni idempotent qabul qiladi
      void this.send(c.webhookUrl!, c.webhookSecret ?? '', { ...payload, byIntegration: e.byUserId === c.userId });
    }
  }

  /** Haydovchi ro'yxatdan o'tdi / tasdiqlandi / bloklandi → ERP xodimlar ro'yxati o'zi yangilanadi. */
  @OnEvent(ORG_EVENTS.membershipChanged, { async: true })
  async onMembership(e: MembershipChangedEvent) {
    if (e.role === 'QURUVCHI') return this.onCustomerRegistered(e);
    if (e.role !== 'HAYDOVCHI') return;
    // Superadmin ERP xodimlar ro'yxatiga ham tushmaydi
    const user = await this.prisma.user.findFirst({ where: { id: e.userId, isSuperAdmin: false }, select: { id: true, fullName: true, phone: true } });
    if (!user) return;
    await this.broadcast(e.organizationId, e.byUserId, {
      event: 'driver.changed',
      reason: e.reason,
      userId: user.id,
      membershipId: e.membershipId,
      fullName: user.fullName,
      phone: user.phone,
      isActive: e.isActive,
    });
  }

  /**
   * ERP'dan kelgan mijoz ilovada ro'yxatdan o'tdi (parol qo'ydi) → ERP sotuvchisiga bildirishnoma.
   * Mijoz tashkiloti CONTRACTOR — integratsiya kaliti esa zavodda. Qaysi zavodlarga tegishli: kredit limiti
   * yoki buyurtmasi bor zavodlar (ERP `PUT customers` har doim kredit limiti yozadi).
   */
  private async onCustomerRegistered(e: MembershipChangedEvent) {
    if (e.reason !== 'registered') return;
    const [org, user] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: e.organizationId }, select: { id: true, name: true, externalRef: true } }),
      this.prisma.user.findFirst({ where: { id: e.userId, isSuperAdmin: false }, select: { id: true, fullName: true, phone: true } }),
    ]);
    if (!org?.externalRef || !user) return;
    const [limits, orders] = await Promise.all([
      this.prisma.creditLimit.findMany({ where: { clientOrgId: org.id }, select: { plantOrgId: true } }),
      this.prisma.order.findMany({ where: { clientOrgId: org.id }, select: { plantOrgId: true }, distinct: ['plantOrgId'] }),
    ]);
    // Prefiksli (`erp:<zavod>:<ref>`) karta — faqat o'sha zavodniki; eski prefikssiz — bog'langan zavodlarga
    const owner = parseCustomerRef(org.externalRef).plantOrgId;
    const plants = owner ? new Set([owner]) : new Set([...limits, ...orders].map((x) => x.plantOrgId));
    for (const plantOrgId of plants) {
      await this.broadcast(plantOrgId, null, {
        event: 'customer.registered',
        externalRef: customerRefFor(plantOrgId, org.externalRef),
        orgId: org.id,
        orgName: org.name,
        userId: user.id,
        fullName: user.fullName,
        phone: user.phone,
        at: new Date().toISOString(),
      });
    }
  }

  /** Haydovchi ilovada ismini o'zgartirdi → ERP xodim kartasi. */
  @OnEvent(ORG_EVENTS.userUpdated, { async: true })
  async onUser(e: UserUpdatedEvent) {
    const user = await this.prisma.user.findFirst({ where: { id: e.userId, isSuperAdmin: false }, select: { id: true, fullName: true, phone: true, memberships: { where: { role: 'HAYDOVCHI' } } } });
    if (!user) return;
    for (const m of user.memberships) {
      await this.broadcast(m.organizationId, e.byUserId, { event: 'driver.changed', reason: 'profile', userId: user.id, membershipId: m.id, fullName: user.fullName, phone: user.phone, isActive: m.isActive });
    }
  }

  /** Haydovchi ilovada hisobini o'chirishni so'radi → ERP direktoriga so'rov (u xodimni o'chirgach ECO anonimlashtiradi). */
  @OnEvent(ORG_EVENTS.accountDeleteRequested, { async: true })
  async onAccountDelete(e: AccountDeleteRequestedEvent) {
    const user = await this.prisma.user.findUnique({ where: { id: e.userId }, select: { id: true, fullName: true, phone: true } });
    if (!user) return;
    for (const organizationId of e.organizationIds) {
      await this.broadcast(organizationId, null, { event: 'driver.delete_requested', userId: user.id, fullName: user.fullName, phone: user.phone, at: new Date().toISOString() });
    }
  }

  /** Tadbirkor ilovada mashina qo'shdi → ERP texnika ro'yxati. */
  @OnEvent(ORG_EVENTS.vehicleChanged, { async: true })
  async onVehicle(e: VehicleChangedEvent) {
    const v = await this.prisma.vehicle.findUnique({ where: { id: e.vehicleId } });
    if (!v) return;
    await this.broadcast(e.organizationId, e.byUserId, { event: 'vehicle.changed', vehicleId: v.id, plateNumber: v.plateNumber, capacityM3: Number(v.capacityM3), type: v.type, isActive: v.isActive });
  }

  /** Tashkilotning barcha faol integratsiya mijozlariga yuborish; byIntegration — o'zgarishni shu mijoz o'zi qilgan. */
  private async broadcast(organizationId: string, byUserId: string | null, payload: Record<string, unknown>) {
    const clients = await this.prisma.integrationClient.findMany({ where: { organizationId, isActive: true, webhookUrl: { not: null } } });
    for (const c of clients) void this.send(c.webhookUrl!, c.webhookSecret ?? '', { ...payload, byIntegration: !!byUserId && byUserId === c.userId });
  }

  private async send(url: string, secret: string, payload: Record<string, unknown>) {
    const body = JSON.stringify(payload);
    const delays = [0, 1000, 5000, 15000];
    for (let i = 0; i < delays.length; i++) {
      if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
      const ts = String(Date.now());
      const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-eco-event': String(payload.event), 'x-eco-timestamp': ts, 'x-eco-signature': `sha256=${sig}` },
          body,
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) return;
        this.logger.warn(`webhook ${url} → ${res.status} (urinish ${i + 1})`);
        // 404 — ERP qayta yig'ilayotgan bo'lishi mumkin (dev rejimda yo'nalish bir lahza yo'qoladi), 408/429 — vaqtinchalik.
        // Qolgan 4xx (imzo/format) — qayta urinish foydasiz.
        if (res.status >= 400 && res.status < 500 && ![404, 408, 429].includes(res.status)) return;
      } catch (err) {
        this.logger.warn(`webhook ${url} xato: ${(err as Error).message} (urinish ${i + 1})`);
      }
    }
    this.logger.error(`webhook ${url} yetib bormadi: ${payload.event} ${payload.externalRef ?? payload.userId ?? payload.vehicleId ?? ''}`);
  }
}
