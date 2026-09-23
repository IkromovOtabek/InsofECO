import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { z } from 'zod';
import {
  DELIVERY_TRANSITIONS,
  DeliveryStatus,
  DeliveryTransitionInput,
  DisputeDeliverySchema,
  Role,
  SignDeliverySchema,
  canTransition,
} from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SmsPort } from '../../infra/sms/sms.port';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';
import { OrdersService } from '../orders/orders.service';
import { DELIVERY_EVENTS, DeliveryStatusChangedEvent } from './deliveries.events';

const SLA_QUEUE = 'sla';
type SignInput = z.infer<typeof SignDeliverySchema>;
type DisputeInput = z.infer<typeof DisputeDeliverySchema>;

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly orders: OrdersService,
    private readonly sms: SmsPort,
    @InjectQueue(SLA_QUEUE) private readonly slaQueue: Queue,
  ) {}

  private readonly include = {
    order: { select: { id: true, number: true, address: true, lat: true, lng: true, plantOrgId: true, clientOrgId: true, needsPump: true, client: { select: { name: true } }, items: { select: { gradeSnapshot: true, nameSnapshot: true } } } },
    driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
    vehicle: true,
    events: { orderBy: { receivedAt: 'asc' as const } },
  } satisfies Prisma.DeliveryInclude;

  /** Haydovchi: o'z reyslari (kun bo'yicha). */
  async mine(a: AuthContext, date: Date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return this.prisma.delivery.findMany({
      where: { driver: { userId: a.userId }, OR: [{ plannedAt: { gte: start, lt: end } }, { status: { in: ['ACCEPTED', 'LOADING', 'EN_ROUTE', 'ARRIVED', 'UNLOADING'] } }] },
      include: this.include,
      orderBy: [{ plannedAt: 'asc' }],
    });
  }

  async get(a: AuthContext, id: string) {
    const d = await this.prisma.delivery.findFirst({
      where: {
        id,
        OR: [{ order: { plantOrgId: a.orgId ?? '' } }, { order: { clientOrgId: a.orgId ?? '' } }, { driver: { userId: a.userId } }],
      },
      include: this.include,
    });
    if (!d) throw DomainError.notFound('Reys');
    return d;
  }

  /**
   * Yagona holat o'tish nuqtasi. Haydovchi, Tadbirkor (override), tizim (geofence) shu orqali.
   * Idempotency: clientEventId (Idempotency-Key) unique → takror so'rov yozuv yaratmaydi.
   */
  async transition(a: AuthContext, id: string, input: DeliveryTransitionInput, clientEventId?: string) {
    const d = await this.get(a, id);
    const role = this.effectiveRole(a, d);
    const from = d.status as DeliveryStatus;

    if (clientEventId) {
      const dup = await this.prisma.deliveryEvent.findUnique({ where: { clientEventId } });
      if (dup) return this.get(a, id); // allaqachon qo'llangan
    }
    if (from === input.to) return d; // idempotent
    if (!canTransition(DELIVERY_TRANSITIONS, from, input.to, role)) {
      throw new DomainError('DELIVERY_INVALID_TRANSITION', `${from} → ${input.to} (${role}) mumkin emas`, { from, to: input.to, current: from });
    }
    if (input.to === 'COMPLETED' && role === 'HAYDOVCHI') {
      throw new DomainError('DELIVERY_SIGNATURE_REQUIRED', 'Yakunlash uchun quruvchi imzosi yoki SMS-kod kerak (POST /sign)');
    }

    const now = input.at > new Date() ? new Date() : input.at; // kelajak vaqt qabul qilinmaydi
    const data: Prisma.DeliveryUpdateInput = { status: input.to };
    if (input.to === 'EN_ROUTE') { data.departedAt = now; if (input.loadedM3) data.loadedM3 = new Prisma.Decimal(input.loadedM3); }
    if (input.to === 'ARRIVED') data.arrivedAt = now;
    if (input.to === 'COMPLETED') data.completedAt = now;
    if (input.photoKey && ['EN_ROUTE', 'COMPLETED'].includes(input.to)) data.waybillPhotoKey = input.photoKey;
    if (input.to === 'ACCEPTED') {
      const busy = await this.prisma.delivery.count({ where: { driverId: d.driverId, status: { in: ['ACCEPTED', 'LOADING', 'EN_ROUTE', 'ARRIVED', 'UNLOADING'] }, NOT: { id } } });
      if (busy > 0) throw new DomainError('DELIVERY_DRIVER_BUSY', 'Avval joriy reysni yakunlang');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.delivery.update({ where: { id }, data, include: this.include });
      await tx.deliveryEvent.create({
        data: { deliveryId: id, from, to: input.to, byUserId: a.userId, byRole: role, at: now, lat: input.location?.lat, lng: input.location?.lng, photoKey: input.photoKey, note: input.note, clientEventId },
      });
      return u;
    });

    await this.afterTransition(updated, from, input.to, a.userId, now);
    return updated;
  }

  /** Quruvchi imzosi yoki (haydovchi kiritgan) SMS-kod bilan yakunlash. */
  async sign(a: AuthContext, id: string, input: SignInput, clientEventId?: string) {
    const d = await this.get(a, id);
    if (d.status !== 'UNLOADING') throw new DomainError('DELIVERY_INVALID_TRANSITION', 'Faqat tushirilayotgan reys imzolanadi');
    const role = this.effectiveRole(a, d);

    if (role === 'HAYDOVCHI') {
      // Haydovchi telefonidan: faqat SMS-kod bilan (quruvchi ilovasiz holat)
      if (!input.otpCode || !d.acceptOtpHash || !(await argon2.verify(d.acceptOtpHash, input.otpCode))) {
        throw new DomainError('DELIVERY_SIGNATURE_REQUIRED', 'SMS-kod noto\'g\'ri');
      }
    } else if (!input.signatureKey) {
      throw new DomainError('DELIVERY_SIGNATURE_REQUIRED', 'Imzo kerak');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.delivery.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: now, acceptedM3: new Prisma.Decimal(input.acceptedM3), signatureKey: input.signatureKey, acceptOtpHash: null },
        include: this.include,
      });
      await tx.deliveryEvent.create({ data: { deliveryId: id, from: 'UNLOADING', to: 'COMPLETED', byUserId: a.userId, byRole: role, at: now, note: input.note, clientEventId } });
      return u;
    });
    await this.afterTransition(updated, 'UNLOADING', 'COMPLETED', a.userId, now);
    return updated;
  }

  /** Quruvchi ilovasiz bo'lsa: haydovchi so'raydi → mijoz telefoniga 4 xonali kod. */
  async requestAcceptOtp(a: AuthContext, id: string) {
    const d = await this.get(a, id);
    if (d.status !== 'UNLOADING') throw new DomainError('DELIVERY_INVALID_TRANSITION', 'Faqat tushirish bosqichida');
    const client = await this.prisma.membership.findFirst({ where: { organizationId: d.order.clientOrgId, isActive: true }, include: { user: true }, orderBy: { createdAt: 'asc' } });
    if (!client) throw DomainError.notFound('Mijoz');
    const code = (process.env.SMS_PROVIDER ?? 'FAKE') === 'FAKE' ? '0000' : String(randomInt(0, 10_000)).padStart(4, '0');
    await this.prisma.delivery.update({ where: { id }, data: { acceptOtpHash: await argon2.hash(code) } });
    try {
      await this.sms.send(client.user.phone, `Insof ECO: №${d.order.number} reys ${d.sequence} qabul kodi ${code}`);
    } catch (e) {
      // Haydovchi kelmaydigan kodni kutib turmasin — darhol aytamiz
      throw new DomainError('AUTH_OTP_SEND_FAILED', 'Mijozga SMS yuborilmadi. Qayta urinib ko\'ring yoki logistga ayting', { cause: String(e) });
    }
    return { sentTo: client.user.phone.replace(/(\+998\d{2})\d{5}(\d{2})/, '$1*****$2') };
  }

  async dispute(a: AuthContext, id: string, input: DisputeInput) {
    const d = await this.get(a, id);
    if (this.effectiveRole(a, d) !== 'QURUVCHI' && d.order.clientOrgId !== a.orgId) throw DomainError.forbidden();
    if (d.status !== 'UNLOADING') throw new DomainError('DELIVERY_INVALID_TRANSITION', 'Faqat tushirish bosqichida e\'tiroz bildiriladi');
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.delivery.update({ where: { id }, data: { status: 'DISPUTED', disputeReason: input.reason, disputeComment: input.comment }, include: this.include });
      await tx.deliveryEvent.create({ data: { deliveryId: id, from: 'UNLOADING', to: 'DISPUTED', byUserId: a.userId, byRole: 'QURUVCHI', at: now, note: `${input.reason}: ${input.comment ?? ''}`, photoKey: input.photoKeys[0] } });
      return u;
    });
    this.events.emit(DELIVERY_EVENTS.disputed, { deliveryId: id, orderId: d.orderId, reason: input.reason });
    await this.afterTransition(updated, 'UNLOADING', 'DISPUTED', a.userId, now);
    return updated;
  }

  /** Tizim: geofence (tracking moduli) — EN_ROUTE → ARRIVED. */
  async systemArrive(deliveryId: string, at: Date, lat: number, lng: number) {
    const d = await this.prisma.delivery.findUnique({ where: { id: deliveryId }, include: { driver: true } });
    if (!d || d.status !== 'EN_ROUTE' || !d.driver) return;
    const a: AuthContext = { userId: d.driver.userId, sessionId: 'system', orgId: null, role: 'HAYDOVCHI' };
    await this.transition(a, deliveryId, { to: 'ARRIVED', at, location: { lat, lng }, note: 'geofence' }, `geofence:${deliveryId}`);
  }

  /** SLA worker: EN_ROUTE dan 90 daqiqa o'tdi, hali UNLOADING/COMPLETED emas. */
  async markSlaBreach(deliveryId: string) {
    const d = await this.prisma.delivery.findUnique({ where: { id: deliveryId }, include: { order: true, driver: true } });
    if (!d || d.slaBreached || !['EN_ROUTE', 'ARRIVED'].includes(d.status)) return;
    await this.prisma.delivery.update({ where: { id: deliveryId }, data: { slaBreached: true } });
    this.events.emit(DELIVERY_EVENTS.slaBreached, { deliveryId, orderId: d.orderId, plantOrgId: d.order.plantOrgId, clientOrgId: d.order.clientOrgId, driverUserId: d.driver?.userId ?? null });
  }

  // ───────── ichki ─────────

  private effectiveRole(a: AuthContext, d: { driver: { userId: string } | null; order: { plantOrgId: string; clientOrgId: string } }): Role {
    if (d.driver?.userId === a.userId && (a.role === 'HAYDOVCHI' || !a.orgId)) return 'HAYDOVCHI';
    if (a.role === 'TADBIRKOR' && d.order.plantOrgId === a.orgId) return 'TADBIRKOR';
    if (a.orgId === d.order.clientOrgId) return 'QURUVCHI';
    throw DomainError.forbidden();
  }

  private async afterTransition(
    d: { id: string; orderId: string; order: { plantOrgId: string; clientOrgId: string }; driver: { user: { id: string } } | null },
    from: DeliveryStatus,
    to: DeliveryStatus,
    byUserId: string,
    at: Date,
  ) {
    const ev: DeliveryStatusChangedEvent = { deliveryId: d.id, orderId: d.orderId, plantOrgId: d.order.plantOrgId, clientOrgId: d.order.clientOrgId, driverUserId: d.driver?.user.id ?? null, from, to, byUserId, at };
    this.events.emit(DELIVERY_EVENTS.statusChanged, ev);

    if (to === 'EN_ROUTE') {
      // SLA (90 daq) tekshiruvini rejalashtirish. Infra xatosi haydovchi holat o'tishini bloklamasligi kerak → timeout + log.
      try {
        const rules = await this.orders.rules(d.order.plantOrgId);
        this.logger.debug(`sla schedule ${d.id} in ${rules.concreteMaxTransitMinutes}m`);
        await Promise.race([
          this.slaQueue.add('check', { deliveryId: d.id }, { delay: rules.concreteMaxTransitMinutes * 60_000, jobId: `sla-${d.id}`, removeOnComplete: true }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('sla queue timeout')), 3000)),
        ]);
        this.logger.debug(`sla scheduled ${d.id}`);
      } catch (e) {
        this.logger.error(`SLA job not scheduled for ${d.id}: ${(e as Error).message}`);
      }
    }
    if (to === 'LOADING') await this.orders.systemTransition(d.orderId, 'IN_PROGRESS', byUserId);
    if (to === 'COMPLETED') {
      this.events.emit(DELIVERY_EVENTS.completed, { deliveryId: d.id, orderId: d.orderId });
      const open = await this.prisma.delivery.count({ where: { orderId: d.orderId, status: { notIn: ['COMPLETED', 'CANCELLED', 'FAILED'] } } });
      if (open === 0) await this.orders.systemTransition(d.orderId, 'DELIVERED', byUserId);
    }
  }
}
