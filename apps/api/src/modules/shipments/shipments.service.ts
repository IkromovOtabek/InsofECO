import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { SHIPMENT_TRANSITIONS, ShipmentStatus, ShipmentTransitionSchema, canTransition } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';
import { assertAtSite, knownPoint } from '../deliveries/geofence';
import { summarizeTrack } from './shipment-track';
import { acceptPlannedRoute, firstInsideSite, parseRoute } from './shipment-alerts';

/** Haydovchi telefoni GPS nuqtalarini shu holatlarda yozadi (yuklashdan yetkazishgacha). */
const TRACKED: ShipmentStatus[] = ['LOADING', 'EN_ROUTE'];
/** "Yetkazdim"dan keyin buferda qolgan nuqtalar shuncha vaqt ichida yetib kelsa ham qabul qilinadi. */
const LATE_FLUSH_MS = 2 * 60 * 60_000;

export interface ShipmentGpsInput {
  points: { lat: number; lng: number; speedKmh?: number; heading?: number; at: Date }[];
  /** Nuqtasiz "tiriklik" belgisi: ilova tirik, kuzatuv va GPS xizmati yoqiq (lekin yangi nuqta yo'q). */
  ping?: Date;
  platform?: 'ios' | 'android';
}
export interface PlannedRouteInput { line: { lat: number; lng: number }[]; meters?: number; seconds?: number }

const include = {
  project: { select: { id: true, name: true, address: true, lat: true, lng: true } },
  warehouse: { select: { id: true, name: true, address: true, lat: true, lng: true } },
  driver: { select: { id: true, fullName: true, phone: true } },
  vehicle: true,
  request: { include: { material: true } },
} satisfies Prisma.ShipmentInclude;

/**
 * Yuk yetkazish zanjiri. CONFIRMED (qabul qiluvchi tasdiqladi) — bitta tranzaksiyada:
 * Inventory −qty · MaterialRequest CONFIRMED · Expense(MATERIAL) · Project.spent + · Payout(haydovchi) · Expense(DRIVER)
 */
@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly storage: StorageService,
  ) {}

  list(a: AuthContext, status?: string) {
    return this.prisma.shipment.findMany({
      where: {
        organizationId: a.orgId!,
        ...(a.role === 'HAYDOVCHI' ? { OR: [{ driverUserId: a.userId }, { driverUserId: null, status: 'NEW' }] } : {}),
        ...(a.role === 'QURUVCHI' ? { project: { members: { some: { userId: a.userId } } } } : {}),
        ...(status ? { status: { in: status.split(',') as ShipmentStatus[] } } : {}),
      },
      include,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async get(a: AuthContext, id: string) {
    const s = await this.prisma.shipment.findFirst({ where: { id, organizationId: a.orgId! }, include: { ...include, payouts: true } });
    if (!s) throw DomainError.notFound('Yuk');
    // Haydovchi uchun "Qo'ng'iroq": so'rov bergan quruvchi, bo'lmasa tashkilot tadbirkori
    const contactUser = s.request?.requestedByUserId
      ? await this.prisma.user.findUnique({ where: { id: s.request.requestedByUserId }, select: { fullName: true, phone: true } })
      : null;
    const fallback = contactUser ?? (await this.prisma.membership.findFirst({ where: { organizationId: s.organizationId, role: 'TADBIRKOR', isActive: true, user: { isSuperAdmin: false } }, select: { user: { select: { fullName: true, phone: true } } } }))?.user ?? null;
    return { ...s, contact: fallback };
  }

  async transition(a: AuthContext, id: string, input: z.infer<typeof ShipmentTransitionSchema>) {
    const s = await this.get(a, id);
    const from = s.status as ShipmentStatus;
    if (a.role === 'HAYDOVCHI' && s.driverUserId && s.driverUserId !== a.userId) throw DomainError.forbidden('Bu yuk boshqa haydovchiga biriktirilgan');
    if (!canTransition(SHIPMENT_TRANSITIONS, from, input.to, a.role!)) throw new DomainError('DELIVERY_INVALID_TRANSITION', `${from} → ${input.to} (${a.role}) mumkin emas`);
    // Quruvchi faqat o'zi a'zo loyihaga kelgan yukni tasdiqlaydi (ro'yxat ham shunday filtrlanadi)
    if (a.role === 'QURUVCHI' && s.request?.requestedByUserId !== a.userId) {
      const member = await this.prisma.project.count({ where: { id: s.projectId, members: { some: { userId: a.userId } } } });
      if (!member) throw DomainError.forbidden('Bu yuk sizning loyihangizga tegishli emas');
    }

    // "Yetkazdim" — faqat obyekt yonida. Ilgari ilova koordinata yubormas, server esa
    // tekshirmas edi: haydovchi yo'lning yarmida bossa ham yuk "Yetkazildi" bo'lib qolardi.
    // DELIVERED faqat haydovchiniki (SHIPMENT_TRANSITIONS) — dispetcher override'i bu holat uchun yo'q.
    if (input.to === 'DELIVERED' && a.role === 'HAYDOVCHI') {
      assertAtSite(input.location, knownPoint(s.project.lat, s.project.lng), 'Yetkazdim');
    }
    if (input.to === 'ACCEPTED') {
      const busy = await this.prisma.shipment.count({ where: { driverUserId: a.userId, status: { in: ['ACCEPTED', 'LOADING', 'EN_ROUTE'] } } });
      if (busy > 0) throw new DomainError('DELIVERY_DRIVER_BUSY', 'Avval joriy yukni yetkazing');
    }
    // Foto: faqat haydovchining o'zi yuklagan, omborda mavjud fayl
    const photoKey = input.to === 'DELIVERED' ? await this.storage.verifyKey(a.userId, input.photoKey, ['waybill', 'report']) : undefined;
    const now = new Date();
    const stamps: Prisma.ShipmentUncheckedUpdateManyInput = { ACCEPTED: { acceptedAt: now, driverUserId: a.userId }, LOADING: { loadedAt: now }, EN_ROUTE: { departedAt: now }, DELIVERED: { deliveredAt: now, photoKey, receiverName: input.receiverName, deliveredLat: input.location?.lat, deliveredLng: input.location?.lng }, CONFIRMED: { confirmedAt: now } }[input.to as string] ?? {};

    // Holat o'tishi atomar (compare-and-set): ikki haydovchi bir vaqtda "Qabul qilaman" bossa yoki
    // qabul qiluvchi "Tasdiqlash"ni ikki marta yuborsa — faqat bittasi o'tadi. Ilgari ikkalasi ham
    // o'tardi: yuk oxirgi bosganga yozilardi, CONFIRMED esa ombordan ikki marta ayirib, haydovchiga
    // ikki marta haq yozardi.
    const claim = (tx: Prisma.TransactionClient) =>
      tx.shipment.updateMany({
        where: { id, status: from, ...(input.to === 'ACCEPTED' ? { OR: [{ driverUserId: null }, { driverUserId: a.userId }] } : {}) },
        data: { status: input.to, ...stamps },
      });
    const lost = () => new DomainError('DELIVERY_INVALID_TRANSITION', input.to === 'ACCEPTED' ? 'Bu yukni boshqa haydovchi oldi' : 'Yuk holati allaqachon o\'zgargan — sahifani yangilang', { from, to: input.to });

    if (input.to === 'CONFIRMED') {
      await this.prisma.$transaction(async (tx) => {
        if ((await claim(tx)).count !== 1) throw lost();
        if (s.request) {
          // Atomar shartli ayirish: zaxira >= miqdor bo'lsagina. Parallel tasdiqlar qoldiqni manfiyga tushira olmaydi —
          // yetmasa butun tranzaksiya (holat, xarajat, haq) qaytariladi.
          const taken = await tx.inventoryItem.updateMany({
            where: { warehouseId: s.warehouseId, materialId: s.request.materialId, quantity: { gte: s.quantity } },
            data: { quantity: { decrement: s.quantity } },
          });
          if (taken.count !== 1) throw new DomainError('VALIDATION', `Omborda ${s.cargo} uchun zaxira yetarli emas`, { warehouseId: s.warehouseId, materialId: s.request.materialId });
          await tx.materialRequest.update({ where: { id: s.request.id }, data: { status: 'CONFIRMED' } });
          const cost = s.request.material.price.mul(s.quantity);
          await tx.expense.create({ data: { organizationId: s.organizationId, projectId: s.projectId, category: 'MATERIAL', amount: cost, description: `${s.cargo} → ${s.project.name}`, refType: 'MATERIAL_REQUEST', refId: s.request.id, createdByUserId: a.userId } });
          await tx.project.update({ where: { id: s.projectId }, data: { spent: { increment: cost } } });
        }
        if (s.driverUserId && s.driverFee.gt(0)) {
          await tx.payout.create({ data: { organizationId: s.organizationId, userId: s.driverUserId, shipmentId: id, amount: s.driverFee, description: `Yuk №${s.number}: ${s.cargo}` } });
          await tx.expense.create({ data: { organizationId: s.organizationId, projectId: s.projectId, category: 'DRIVER', amount: s.driverFee, description: `Yetkazish №${s.number}`, refType: 'SHIPMENT', refId: id, createdByUserId: a.userId } });
          await tx.project.update({ where: { id: s.projectId }, data: { spent: { increment: s.driverFee } } });
        }
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        if ((await claim(tx)).count !== 1) throw lost();
        if (s.request && (input.to === 'LOADING' || input.to === 'DELIVERED')) {
          await tx.materialRequest.update({ where: { id: s.request.id }, data: { status: input.to === 'LOADING' ? 'LOADING' : 'DELIVERED' } });
        }
      });
    }
    const updated = await this.get(a, id);
    this.events.emit('shipment.status_changed', { shipmentId: id, number: s.number, cargo: s.cargo, from, to: input.to, orgId: s.organizationId, driverUserId: updated.driverUserId, requesterUserId: s.request?.requestedByUserId ?? null, byUserId: a.userId });
    return updated;
  }

  /**
   * Haydovchi telefonidan GPS paket. Faqat o'sha yukning haydovchisi va faqat yuklash/yo'l
   * holatida. "Yetkazdim"dan keyin buferda qolgan nuqtalar ham olinadi — lekin faqat
   * yetkazish vaqtigacha bo'lganlari (keyin uyga qaytgan yo'l reys iziga tushmasin).
   */
  async ingestGps(a: AuthContext, id: string, input: ShipmentGpsInput) {
    const s = await this.prisma.shipment.findFirst({
      where: { id, organizationId: a.orgId!, driverUserId: a.userId },
      select: { id: true, number: true, cargo: true, organizationId: true, status: true, loadedAt: true, deliveredAt: true, nearSiteAt: true, project: { select: { name: true, lat: true, lng: true } }, request: { select: { requestedByUserId: true } } },
    });
    if (!s) throw DomainError.notFound('Yuk');
    const status = s.status as ShipmentStatus;
    const late = (status === 'DELIVERED' || status === 'CONFIRMED') && s.deliveredAt && Date.now() - s.deliveredAt.getTime() < LATE_FLUSH_MS;
    if (!TRACKED.includes(status) && !late) return { accepted: 0 };
    const after = s.loadedAt ? s.loadedAt.getTime() - 60_000 : 0;
    const before = late && s.deliveredAt ? s.deliveredAt.getTime() + 60_000 : Date.now() + 5 * 60_000;
    const points = input.points.filter((p) => p.at.getTime() >= after && p.at.getTime() <= before);
    if (points.length) {
      await this.prisma.shipmentGpsPoint.createMany({
        data: points.map((p) => ({ shipmentId: s.id, lat: p.lat, lng: p.lng, speedKmh: p.speedKmh, heading: p.heading, at: p.at })),
      });
    }
    // Tiriklik belgisi va platforma — "GPS jim" kuzatuvchisi uchun (faqat yo'ldagi reys; kelajakdagi vaqt — hozir)
    if (TRACKED.includes(status) && (input.ping || input.platform)) {
      const seen = input.ping ? new Date(Math.min(input.ping.getTime(), Date.now())) : undefined;
      await this.prisma.shipment.update({ where: { id: s.id }, data: { ...(seen ? { gpsLastSeenAt: seen } : {}), ...(input.platform ? { gpsPlatform: input.platform } : {}) } });
    }
    if (status === 'EN_ROUTE' && !s.nearSiteAt) await this.checkArrival(s, points);
    return { accepted: points.length };
  }

  /**
   * Obyektga yetib kelish (geofence): yo'ldagi reysning GPS izi birinchi marta obyektdan
   * `SITE_RADIUS_M` (300 m) ichiga kirsa — quruvchiga (so'rov bergan) va dispetcherga xabar.
   * Bir marta: `nearSiteAt` atomar qo'yiladi (ikki parallel paket ikki xabar bermaydi).
   */
  private async checkArrival(
    s: { id: string; number: number; cargo: string; organizationId: string; project: { name: string; lat: number | null; lng: number | null }; request: { requestedByUserId: string } | null },
    points: ShipmentGpsInput['points'],
  ) {
    const hit = firstInsideSite(points, knownPoint(s.project.lat, s.project.lng));
    if (!hit) return;
    const won = await this.prisma.shipment.updateMany({ where: { id: s.id, nearSiteAt: null }, data: { nearSiteAt: hit.at } });
    if (won.count !== 1) return;
    this.events.emit('shipment.near_site', { shipmentId: s.id, number: s.number, cargo: s.cargo, orgId: s.organizationId, project: s.project.name, requesterUserId: s.request?.requestedByUserId ?? null, at: hit.at });
  }

  /**
   * Rejadagi yo'l — haydovchi ilovasi Yandex yo'lini qurganda (birinchi marta yoki qayta qurganda)
   * yuboradi; "marshrutdan chiqdi" kuzatuvi shu bilan solishtiradi. Yo'ldan chiqib ketish paytidagi
   * qayta qurilgan yo'l darhol qabul qilinmaydi (`acceptPlannedRoute`) — aks holda chetlashish
   * hech qachon aniqlanmasdi. Rad etilsa `{ accepted: false }` — ilova keyinroq qayta yuboradi.
   */
  async setPlannedRoute(a: AuthContext, id: string, input: PlannedRouteInput) {
    const s = await this.prisma.shipment.findFirst({
      where: { id, organizationId: a.orgId!, driverUserId: a.userId },
      select: { id: true, status: true, plannedRoute: true, offRouteAlertAt: true },
    });
    if (!s) throw DomainError.notFound('Yuk');
    if (!TRACKED.includes(s.status as ShipmentStatus)) return { accepted: false, reason: 'status' };
    const next = parseRoute(input.line);
    if (next.length < 2) return { accepted: false, reason: 'empty' };
    // Mashina joyi — serverdagi oxirgi nuqta (10 daqiqadan yangi); bo'lmasa yo'lning boshi (telefon joyi)
    const last = await this.prisma.shipmentGpsPoint.findFirst({ where: { shipmentId: id, at: { gte: new Date(Date.now() - 10 * 60_000) } }, orderBy: { at: 'desc' }, select: { lat: true, lng: true } });
    const d = acceptPlannedRoute({ stored: parseRoute(s.plannedRoute), next, pos: last ?? next[0]!, offRouteAlertAt: s.offRouteAlertAt });
    if (!d.accept) return { accepted: false, reason: 'off-route' };
    await this.prisma.shipment.update({
      where: { id },
      data: { plannedRoute: next.map((p) => ({ lat: p.lat, lng: p.lng })), plannedRouteAt: new Date(), ...(d.clearAlert ? { offRouteAlertAt: null } : {}) },
    });
    return { accepted: true };
  }

  /**
   * Reysning haqiqiy izi: qaysi yo'llardan yurilgan (soddalashtirilgan chiziq), necha km va
   * qancha vaqt. Ruxsat — yuk kartochkasi bilan bir xil (`get`).
   * Vaqt: yo'lga chiqqandan ("Yo'lga chiqdim") yetkazgungacha; reys hali yo'lda bo'lsa — hozirgacha.
   *
   * `since` — faqat shu vaqtdan keyingi nuqtalar (jonli xaritadagi qisqa "dum": oxirgi ~15 daqiqa).
   * Bunda km/vaqt ham shu oraliq bo'yicha. `last` — eng oxirgi xom nuqta (tezlik va yo'nalish bilan):
   * mashina belgisi shu yerda turadi.
   */
  async track(a: AuthContext, id: string, since?: Date) {
    const s = await this.get(a, id);
    const rows = await this.prisma.shipmentGpsPoint.findMany({
      where: { shipmentId: id, ...(since ? { at: { gte: since } } : {}) },
      orderBy: { at: 'asc' },
      select: { lat: true, lng: true, at: true, speedKmh: true, heading: true },
    });
    const lastRow = rows[rows.length - 1];
    const t = summarizeTrack(rows);
    const live = TRACKED.includes(s.status as ShipmentStatus);
    const startedAt = s.departedAt ?? s.loadedAt ?? (t.firstAt ? new Date(t.firstAt) : null);
    const endedAt = s.deliveredAt ?? (live ? new Date() : t.lastAt ? new Date(t.lastAt) : null);
    const durationMinutes = startedAt && endedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000)) : null;
    return {
      shipmentId: s.id,
      status: s.status,
      live,
      points: t.points,
      meters: t.meters,
      distanceKm: t.distanceKm,
      startedAt: startedAt?.toISOString() ?? null,
      endedAt: s.deliveredAt?.toISOString() ?? (live ? null : t.lastAt),
      durationMinutes,
      movingMinutes: t.movingMinutes,
      avgSpeedKmh: t.movingMinutes > 0 ? Math.round((t.meters / 1000) / (t.movingMinutes / 60)) : null,
      maxSpeedKmh: t.maxSpeedKmh,
      loadedAt: s.loadedAt?.toISOString() ?? null,
      departedAt: s.departedAt?.toISOString() ?? null,
      deliveredAt: s.deliveredAt?.toISOString() ?? null,
      rawPoints: t.rawPoints,
      last: lastRow ? { lat: lastRow.lat, lng: lastRow.lng, at: lastRow.at.toISOString(), speedKmh: lastRow.speedKmh, heading: lastRow.heading } : null,
      nearSiteAt: s.nearSiteAt?.toISOString() ?? null,
    };
  }

  /** Haydovchi tarixi va daromadi. */
  async history(a: AuthContext) {
    return this.prisma.shipment.findMany({ where: { driverUserId: a.userId, status: { in: ['DELIVERED', 'CONFIRMED', 'CANCELLED'] } }, include, orderBy: { deliveredAt: 'desc' }, take: 100 });
  }
}
