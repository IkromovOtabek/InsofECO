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
import { TelegramGatewayService, devCodeAllowed, maskPhone } from '../../infra/telegram-gateway/telegram-gateway.service';
import { DEV_OTP_CODE } from '../auth/otp.service';
import { StorageService } from '../../infra/storage/storage.service';
import { DomainError } from '../../common/errors/domain.error';
import { tashkentDayRange } from '../../common/time';
import { VISIBLE_MEMBER } from '../../common/auth/superadmin';
import { AuthContext } from '../../common/auth/decorators';
import { OrdersService } from '../orders/orders.service';
import { DELIVERY_EVENTS, DeliveryStatusChangedEvent } from './deliveries.events';
import { assertAtSite, knownPoint } from './geofence';


const SLA_QUEUE = 'sla';
/** ERP (nakladnoy ERP'da imzolangan) tushirilayotgan reysni /sign'siz yakunlay oladi — boshqa hech kim. */
export interface TransitionOpts { erp?: boolean }
type SignInput = z.infer<typeof SignDeliverySchema>;
type DisputeInput = z.infer<typeof DisputeDeliverySchema>;

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly orders: OrdersService,
    private readonly telegram: TelegramGatewayService,
    @InjectQueue(SLA_QUEUE) private readonly slaQueue: Queue,
    private readonly storage: StorageService,
  ) {}

  private readonly include = {
    order: { select: { id: true, number: true, address: true, lat: true, lng: true, plantOrgId: true, clientOrgId: true, needsPump: true, client: { select: { name: true } }, items: { select: { gradeSnapshot: true, nameSnapshot: true } } } },
    driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
    vehicle: true,
    events: { orderBy: { receivedAt: 'asc' as const } },
  } satisfies Prisma.DeliveryInclude;

  /** Haydovchi: o'z reyslari (kun bo'yicha). */
  async mine(a: AuthContext, date: Date) {
    const { start, end } = tashkentDayRange(date);
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
  async transition(a: AuthContext, id: string, input: DeliveryTransitionInput, clientEventId?: string, opts: TransitionOpts = {}) {
    const d = await this.get(a, id);
    const role = await this.effectiveRole(a, d);
    const from = d.status as DeliveryStatus;

    if (clientEventId) {
      const dup = await this.prisma.deliveryEvent.findUnique({ where: { clientEventId } });
      if (dup) return this.get(a, id); // allaqachon qo'llangan
    }
    if (from === input.to) return d; // idempotent
    if (!canTransition(DELIVERY_TRANSITIONS, from, input.to, role)) {
      throw new DomainError('DELIVERY_INVALID_TRANSITION', `${from} → ${input.to} (${role}) mumkin emas`, { from, to: input.to, current: from });
    }
    // Tushirilayotgan reysni HECH KIM /transition bilan yakunlay olmaydi — faqat imzo yoki qabul kodi (POST /sign).
    // Ilgari faqat haydovchi to'silgan edi: quruvchi/dispetcher imzosiz va qabul hajmisiz yopib, faktura
    // haydovchi kiritgan loadedM3 bo'yicha chiqib ketardi.
    if (input.to === 'COMPLETED' && from === 'UNLOADING' && !opts.erp) {
      throw new DomainError('DELIVERY_SIGNATURE_REQUIRED', 'Yakunlash uchun quruvchi imzosi yoki qabul kodi kerak (POST /sign)');
    }
    // E'tiroz hal qilinganda dispetcher qabul qilingan hajmni aniq aytadi — faktura shu bo'yicha
    let acceptedM3: Prisma.Decimal | undefined;
    if (input.to === 'COMPLETED' && opts.erp && input.acceptedM3) acceptedM3 = this.assertAcceptedM3(d, input.acceptedM3);
    if (input.to === 'COMPLETED' && from === 'DISPUTED') {
      if (!input.acceptedM3) throw new DomainError('VALIDATION', "E'tirozni yopishda qabul qilingan hajm (acceptedM3) majburiy", { field: 'acceptedM3' });
      acceptedM3 = this.assertAcceptedM3(d, input.acceptedM3);
    }
    // Yuklangan hajm mashina sig'imidan oshmasin (sig'im noma'lum bo'lsa — eng katta mikser 20 m³)
    if (input.to === 'EN_ROUTE' && input.loadedM3) {
      const cap = d.vehicle?.capacityM3 ?? new Prisma.Decimal(20);
      if (new Prisma.Decimal(input.loadedM3).gt(cap)) {
        throw new DomainError('VALIDATION', `Yuklangan hajm mashina sig'imidan (${cap.toString()} m³) oshmasin`, { loadedM3: input.loadedM3, capacityM3: cap.toNumber() });
      }
    }
    // "Yetib keldim" / "Tushirishni boshladim" — faqat obyekt yonida. Dispetcher (TADBIRKOR)
    // override qila oladi: u telefonda emas, ofisda turib holatni to'g'rilaydi.
    if (role === 'HAYDOVCHI' && (input.to === 'ARRIVED' || input.to === 'UNLOADING')) {
      assertAtSite(input.location, knownPoint(d.order.lat, d.order.lng), input.to === 'ARRIVED' ? 'Yetib keldim' : 'Tushirishni boshladim');
    }

    // Foto kaliti: faqat chaqiruvchining o'z prefiksidagi, omborda haqiqatan bor fayl
    const photoKey = await this.storage.verifyKey(a.userId, input.photoKey, ['waybill', 'report']);
    const now = clampClientTime(input.at);
    const data: Prisma.DeliveryUpdateInput = { status: input.to };
    if (input.to === 'EN_ROUTE') { data.departedAt = now; if (input.loadedM3) data.loadedM3 = new Prisma.Decimal(input.loadedM3); }
    if (input.to === 'ARRIVED') data.arrivedAt = now;
    if (input.to === 'COMPLETED') { data.completedAt = now; if (acceptedM3) data.acceptedM3 = acceptedM3; }
    if (photoKey && ['EN_ROUTE', 'COMPLETED'].includes(input.to)) data.waybillPhotoKey = photoKey;
    if (input.to === 'ACCEPTED') {
      const busy = await this.prisma.delivery.count({ where: { driverId: d.driverId, status: { in: ['ACCEPTED', 'LOADING', 'EN_ROUTE', 'ARRIVED', 'UNLOADING'] }, NOT: { id } } });
      if (busy > 0) throw new DomainError('DELIVERY_DRIVER_BUSY', 'Avval joriy reysni yakunlang');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Atomar: shu orada boshqa so'rov (ikkinchi telefon, oflayn navbat, ERP) holatni o'zgartirgan bo'lsa —
      // rad etiladi. Ilgari ikkala so'rov ham o'tib, ikkita hodisa, ikki marta bildirishnoma va ERP webhook ketardi.
      const r = await tx.delivery.updateMany({ where: { id, status: from }, data: { status: input.to } });
      if (r.count !== 1) throw new DomainError('DELIVERY_INVALID_TRANSITION', "Reys holati allaqachon o'zgargan — sahifani yangilang", { from, to: input.to });
      const u = await tx.delivery.update({ where: { id }, data, include: this.include });
      await tx.deliveryEvent.create({
        data: { deliveryId: id, from, to: input.to, byUserId: a.userId, byRole: role, at: now, lat: input.location?.lat, lng: input.location?.lng, photoKey, note: input.note, clientEventId },
      });
      return u;
    })
      .catch(async (e) => {
        // Bir xil Idempotency-Key bilan parallel takror: birinchisi o'tgan — ikkinchisiga o'sha natija
        if (clientEventId && (await this.prisma.deliveryEvent.findUnique({ where: { clientEventId } }))) return null;
        throw e;
      });
    if (!updated) return this.get(a, id);

    await this.afterTransition(updated, from, input.to, a.userId, now);
    return updated;
  }

  /** Quruvchi imzosi yoki (haydovchi kiritgan) qabul kodi bilan yakunlash. */
  async sign(a: AuthContext, id: string, input: SignInput, clientEventId?: string) {
    const d = await this.get(a, id);
    if (d.status !== 'UNLOADING') throw new DomainError('DELIVERY_INVALID_TRANSITION', 'Faqat tushirilayotgan reys imzolanadi');
    const role = await this.effectiveRole(a, d);
    // Imzo fayli: o'zi yuklagan (u/<userId>/signature/...) va omborda mavjud bo'lishi shart
    const signatureKey = await this.storage.verifyKey(a.userId, input.signatureKey, ['signature']);

    if (role === 'HAYDOVCHI') {
      // Haydovchi telefonidan: faqat qabul kodi bilan (quruvchi ilovasiz holat; kod mijozning Telegram'iga boradi)
      await this.verifyAcceptOtp(d, input.otpCode);
    } else if (!signatureKey) {
      throw new DomainError('DELIVERY_SIGNATURE_REQUIRED', 'Imzo kerak');
    }

    const acceptedM3 = this.assertAcceptedM3(d, input.acceptedM3);

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      // Imzo ikki marta yuborilsa (quruvchi + haydovchi OTP bir vaqtda) — faqat bittasi yakunlaydi
      const r = await tx.delivery.updateMany({ where: { id, status: 'UNLOADING' }, data: { status: 'COMPLETED' } });
      if (r.count !== 1) throw new DomainError('DELIVERY_INVALID_TRANSITION', 'Reys allaqachon yakunlangan');
      const u = await tx.delivery.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: now, acceptedM3, signatureKey: signatureKey ?? null, acceptOtpHash: null, acceptOtpExpiresAt: null },
        include: this.include,
      });
      await tx.deliveryEvent.create({ data: { deliveryId: id, from: 'UNLOADING', to: 'COMPLETED', byUserId: a.userId, byRole: role, at: now, note: input.note, clientEventId } });
      return u;
    });
    await this.afterTransition(updated, 'UNLOADING', 'COMPLETED', a.userId, now);
    return updated;
  }

  /**
   * Quruvchi ilovasiz bo'lsa: haydovchi so'raydi → mijoz raqamining Telegram'iga (Telegram Gateway)
   * 6 xonali kod, 30 daqiqa, 5 urinish. SMS yo'q. Dev (Gateway yo'q, prod emas) — kod `000000`, hech narsa yuborilmaydi.
   * Bu yerda xato ochiq aytiladi: chaqiruvchi — tizimga kirgan haydovchi, u kelmaydigan kodni kutmasin.
   */
  async requestAcceptOtp(a: AuthContext, id: string) {
    const d = await this.get(a, id);
    if (d.status !== 'UNLOADING') throw new DomainError('DELIVERY_INVALID_TRANSITION', 'Faqat tushirish bosqichida');
    // Qayta so'rash — kamida 60 s dan keyin (Gateway pullik, mijozga ketma-ket kod ketmasin)
    if (d.acceptOtpExpiresAt && d.acceptOtpExpiresAt.getTime() - ACCEPT_OTP_TTL_MS + 60_000 > Date.now()) {
      throw new DomainError('AUTH_OTP_RATE_LIMIT', "Kod yaqinda yuborilgan — bir daqiqadan so'ng qayta so'rang");
    }
    const client = await this.prisma.membership.findFirst({ where: { organizationId: d.order.clientOrgId, isActive: true, ...VISIBLE_MEMBER }, include: { user: true }, orderBy: { createdAt: 'asc' } });
    if (!client) throw DomainError.notFound('Mijoz');
    const dev = devCodeAllowed(this.telegram.enabled);
    if (!this.telegram.enabled && !dev) {
      this.logger.warn(`Qabul kodi yuborilmadi ${maskPhone(client.user.phone)}: TELEGRAM_GATEWAY_TOKEN sozlanmagan`);
      throw new DomainError('AUTH_OTP_SEND_FAILED', 'Qabul kodini Telegram orqali yuborish sozlanmagan. Quruvchi ilovada imzolasin yoki logistga ayting');
    }
    const code = dev ? DEV_OTP_CODE : String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.delivery.update({
      where: { id },
      data: { acceptOtpHash: await argon2.hash(code), acceptOtpExpiresAt: new Date(Date.now() + ACCEPT_OTP_TTL_MS), acceptOtpAttempts: 0 },
    });
    if (!dev) {
      try {
        await this.telegram.sendCode(client.user.phone, code, ACCEPT_OTP_TTL_MS / 1000);
      } catch (e) {
        // Haydovchi kelmaydigan kodni kutib turmasin — darhol aytamiz
        this.logger.warn(`Qabul kodi yuborilmadi ${maskPhone(client.user.phone)}: ${e instanceof Error ? e.message : String(e)}`);
        throw new DomainError('AUTH_OTP_SEND_FAILED', 'Mijozga kod Telegram orqali yuborilmadi (raqamda Telegram yo\'q bo\'lishi mumkin). Quruvchi ilovada imzolasin yoki logistga ayting');
      }
    }
    return { sentTo: client.user.phone.replace(/(\+998\d{2})\d{5}(\d{2})/, '$1*****$2') };
  }

  async dispute(a: AuthContext, id: string, input: DisputeInput) {
    const d = await this.get(a, id);
    if ((await this.effectiveRole(a, d)) !== 'QURUVCHI' && d.order.clientOrgId !== a.orgId) throw DomainError.forbidden();
    if (d.status !== 'UNLOADING') throw new DomainError('DELIVERY_INVALID_TRANSITION', 'Faqat tushirish bosqichida e\'tiroz bildiriladi');
    const photoKeys = await this.storage.verifyKeys(a.userId, input.photoKeys, ['dispute', 'report']);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.delivery.updateMany({ where: { id, status: 'UNLOADING' }, data: { status: 'DISPUTED' } });
      if (r.count !== 1) throw new DomainError('DELIVERY_INVALID_TRANSITION', "Reys holati allaqachon o'zgargan");
      const u = await tx.delivery.update({ where: { id }, data: { status: 'DISPUTED', disputeReason: input.reason, disputeComment: input.comment }, include: this.include });
      await tx.deliveryEvent.create({ data: { deliveryId: id, from: 'UNLOADING', to: 'DISPUTED', byUserId: a.userId, byRole: 'QURUVCHI', at: now, note: `${input.reason}: ${input.comment ?? ''}`, photoKey: photoKeys[0] } });
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

  private async effectiveRole(a: AuthContext, d: { driver: { userId: string } | null; order: { plantOrgId: string; clientOrgId: string } }): Promise<Role> {
    if (d.driver?.userId === a.userId && (a.role === 'HAYDOVCHI' || !a.orgId)) {
      // Tizim (geofence/SLA) emas, haqiqiy haydovchi bo'lsa — zavodda hali faol a'zo ekani tekshiriladi:
      // X-Org-Id'siz so'rovda rol guard'i ishlamaydi, o'chirilgan haydovchi eski reysini boshqarishda davom etardi
      if (a.sessionId !== 'system') {
        const active = await this.prisma.membership.count({ where: { userId: a.userId, organizationId: d.order.plantOrgId, role: 'HAYDOVCHI', isActive: true } });
        if (!active) throw DomainError.forbidden("Haydovchi a'zoligi faol emas");
      }
      return 'HAYDOVCHI';
    }
    if (a.role === 'TADBIRKOR' && d.order.plantOrgId === a.orgId) return 'TADBIRKOR';
    if (a.orgId === d.order.clientOrgId) return 'QURUVCHI';
    throw DomainError.forbidden();
  }

  /**
   * Qabul qilingan hajm yuklangandan (yoki rejadan) ko'p bo'lolmaydi: faktura shu hajm bo'yicha yoziladi —
   * haydovchi qabul kodi bilan yakunlaganda xato/ataylab katta son mijozga ortiqcha schyot bo'lardi.
   */
  private assertAcceptedM3(d: { loadedM3: Prisma.Decimal | null; plannedM3: Prisma.Decimal }, acceptedM3: number): Prisma.Decimal {
    const maxM3 = Prisma.Decimal.max(d.loadedM3 ?? d.plannedM3, d.plannedM3);
    const v = new Prisma.Decimal(acceptedM3);
    if (v.gt(maxM3)) {
      throw new DomainError('VALIDATION', `Qabul qilingan hajm ${maxM3.toString()} m³ dan oshmasin`, { acceptedM3, maxM3: maxM3.toNumber() });
    }
    return v;
  }

  /**
   * Qabul kodi tekshiruvi: muddat (30 daq) va urinishlar (5). Hisoblagich argon2'dan OLDIN atomar oshiriladi
   * (`updateMany where attempts < 5`) — parallel so'rovlar bilan limitni aylanib o'tib bo'lmaydi.
   */
  private async verifyAcceptOtp(d: { id: string; acceptOtpHash: string | null; acceptOtpExpiresAt: Date | null }, otpCode?: string) {
    if (!otpCode || !d.acceptOtpHash) throw new DomainError('DELIVERY_SIGNATURE_REQUIRED', "Qabul kodi noto'g'ri");
    if (!d.acceptOtpExpiresAt || d.acceptOtpExpiresAt < new Date()) throw new DomainError('AUTH_OTP_EXPIRED', "Qabul kodi muddati tugagan — yangi kod so'rang");
    const claimed = await this.prisma.delivery.updateMany({
      where: { id: d.id, acceptOtpAttempts: { lt: ACCEPT_OTP_MAX_ATTEMPTS } },
      data: { acceptOtpAttempts: { increment: 1 } },
    });
    if (claimed.count !== 1) throw new DomainError('AUTH_OTP_INVALID', "Urinishlar tugadi — yangi kod so'rang");
    if (!(await argon2.verify(d.acceptOtpHash, otpCode))) throw new DomainError('DELIVERY_SIGNATURE_REQUIRED', "Qabul kodi noto'g'ri");
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
    if (to === 'COMPLETED') this.events.emit(DELIVERY_EVENTS.completed, { deliveryId: d.id, orderId: d.orderId });
    // Buyurtma yopilishi oxirgi reys COMPLETED bo'lganda EMAS, oxirgi reys YOPILGANDA tekshiriladi:
    // oxirgisi FAILED/CANCELLED bo'lsa buyurtma IN_PROGRESS da osilib, faktura chiqmay qolardi
    if (to === 'COMPLETED' || to === 'FAILED' || to === 'CANCELLED') {
      const [open, completed] = await Promise.all([
        this.prisma.delivery.count({ where: { orderId: d.orderId, status: { notIn: ['COMPLETED', 'CANCELLED', 'FAILED'] } } }),
        this.prisma.delivery.count({ where: { orderId: d.orderId, status: 'COMPLETED' } }),
      ]);
      if (open === 0) {
        // Birorta reys yetkazilgan — DELIVERED (faktura); birortasi ham yo'q — buyurtma bekor
        await this.orders.systemTransition(d.orderId, completed > 0 ? 'DELIVERED' : 'CANCELLED', byUserId);
      }
    }
  }
}

/** Qabul kodi umri va urinishlar — `sign` va `requestAcceptOtp` uchun umumiy. */
const ACCEPT_OTP_TTL_MS = 30 * 60_000;
const ACCEPT_OTP_MAX_ATTEMPTS = 5;

/**
 * Mijoz yuborgan vaqt: kelajak qabul qilinmaydi; oflayn navbat uchun o'tmish mumkin, lekin 24 soatdan
 * ko'p emas — aks holda haydovchi SLA/vaqt tamg'alarini xohlagancha orqaga surardi.
 */
export function clampClientTime(at: Date, now = new Date()): Date {
  if (at > now) return now;
  const floor = new Date(now.getTime() - 24 * 3600_000);
  return at < floor ? floor : at;
}
