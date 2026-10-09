import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { STOP_ALERT_MIN, decideOffRoute, decideWatch, lastSeenStationary, latest, parseRoute, standingSince } from './shipment-alerts';

/** Tekshiruv oralig'i. Chegaralar daqiqalarda (10 / 20) — bir daqiqalik aniqlik yetarli. */
const TICK_MS = 60_000;
/**
 * Turishni baholash uchun shuncha oxirgi vaqt nuqtalari olinadi (chegara 20 daq + zaxira).
 * iOS'da turgan telefon 30 daqiqagacha jim bo'lishi mumkin — oyna undan ham katta bo'lsin.
 */
const WINDOW_MS = (STOP_ALERT_MIN + 40) * 60_000;

/** Bitta jarayonda bitta taymer (modul ikki marta yuklansa ham — masalan, testda). */
let running = false;

export interface ShipmentAlertEvent {
  kind: 'STOPPED' | 'SILENT' | 'OFF_ROUTE';
  shipmentId: string;
  number: number;
  cargo: string;
  orgId: string;
  minutes: number;
  /** OFF_ROUTE: rejadagi yo'ldan masofa, metr. */
  meters?: number;
  plate: string | null;
  driver: string | null;
}

/**
 * Yo'ldagi (EN_ROUTE) yuklar kuzatuvchisi: har daqiqada "uzoq turibdi", "GPS jim" va "marshrutdan chiqdi" holatlarini
 * tekshiradi va dispetcherga (TADBIRKOR) bir marta xabar beradi (`shipment.alert` hodisasi →
 * NotificationsListener). Qaror — `decideWatch` / `decideOffRoute` (sof funksiyalar, testlangan).
 *
 * Nega oddiy taymer: API'da cron (@nestjs/schedule) yo'q, BullMQ esa kechiktirilgan bitta
 * ishlar uchun ishlatiladi. Bir nechta API jarayoni bo'lsa ham xabar ikki marta ketmaydi:
 * belgi `updateMany(where: stopAlertAt = null)` bilan atomar qo'yiladi — faqat yutgan jarayon yuboradi.
 * O'chirish: `SHIPMENT_WATCH=false`.
 */
@Injectable()
export class ShipmentWatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShipmentWatchService.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() {
    if (running || process.env.NODE_ENV === 'test' || (process.env.SHIPMENT_WATCH ?? 'true').toLowerCase() === 'false') return;
    running = true;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; running = false; }
  }

  /** Bitta aylanish. Oldingisi tugamagan bo'lsa o'tkazib yuboriladi (sekin baza — navbat yig'ilmasin). */
  async tick(now = new Date()) {
    if (this.busy) return;
    this.busy = true;
    try {
      const list = await this.prisma.shipment.findMany({
        where: { status: 'EN_ROUTE', departedAt: { not: null } },
        select: {
          id: true, number: true, cargo: true, organizationId: true, departedAt: true, stopAlertAt: true, silentAlertAt: true,
          gpsLastSeenAt: true, gpsPlatform: true, plannedRoute: true, offRouteAlertAt: true,
          vehicle: { select: { plateNumber: true } }, driver: { select: { fullName: true, phone: true } },
        },
        take: 500,
      });
      for (const s of list) {
        try { await this.check(s, now); } catch (e) { this.logger.warn(`yuk ${s.id}: ${String(e)}`); }
      }
    } catch (e) {
      this.logger.warn(`tick: ${String(e)}`);
    } finally {
      this.busy = false;
    }
  }

  private async check(s: {
    id: string; number: number; cargo: string; organizationId: string; departedAt: Date | null; stopAlertAt: Date | null; silentAlertAt: Date | null;
    gpsLastSeenAt: Date | null; gpsPlatform: string | null; plannedRoute: unknown; offRouteAlertAt: Date | null;
    vehicle: { plateNumber: string } | null; driver: { fullName: string | null; phone: string } | null;
  }, now: Date) {
    const from = new Date(Math.max(s.departedAt?.getTime() ?? 0, now.getTime() - WINDOW_MS));
    const points = await this.prisma.shipmentGpsPoint.findMany({
      where: { shipmentId: s.id, at: { gte: from, lte: new Date(now.getTime() + 5 * 60_000) } },
      orderBy: { at: 'asc' },
      select: { lat: true, lng: true, at: true, speedKmh: true },
    });
    const d = decideWatch({
      now,
      departedAt: s.departedAt,
      // Nuqtasiz ping ham "tirik" — lekin faqat yo'lga chiqqandan keyingisi
      lastGpsAt: latest(points[points.length - 1]?.at, s.gpsLastSeenAt && s.departedAt && s.gpsLastSeenAt >= s.departedAt ? s.gpsLastSeenAt : null),
      iosStill: s.gpsPlatform === 'ios' && lastSeenStationary(points),
      standingSince: standingSince(points),
      stopAlertAt: s.stopAlertAt,
      silentAlertAt: s.silentAlertAt,
    });
    const base = { shipmentId: s.id, number: s.number, cargo: s.cargo, orgId: s.organizationId, plate: s.vehicle?.plateNumber ?? null, driver: s.driver?.fullName ?? s.driver?.phone ?? null };

    if (d.silent === 'send') {
      const won = await this.prisma.shipment.updateMany({ where: { id: s.id, silentAlertAt: null, status: 'EN_ROUTE' }, data: { silentAlertAt: now } });
      if (won.count === 1) this.events.emit('shipment.alert', { ...base, kind: 'SILENT', minutes: d.silentMin ?? 0 } satisfies ShipmentAlertEvent);
    } else if (d.silent === 'clear') {
      await this.prisma.shipment.updateMany({ where: { id: s.id }, data: { silentAlertAt: null } });
    }

    if (d.stop === 'send') {
      const won = await this.prisma.shipment.updateMany({ where: { id: s.id, stopAlertAt: null, status: 'EN_ROUTE' }, data: { stopAlertAt: now } });
      if (won.count === 1) this.events.emit('shipment.alert', { ...base, kind: 'STOPPED', minutes: d.stoppedMin ?? 0 } satisfies ShipmentAlertEvent);
    } else if (d.stop === 'clear') {
      await this.prisma.shipment.updateMany({ where: { id: s.id }, data: { stopAlertAt: null } });
    }

    // Marshrutdan chetlashish — GPS jim bo'lsa baholanmaydi (oxirgi nuqtalar eskirgan)
    if (d.silentMin != null) return;
    const off = decideOffRoute({ now, route: parseRoute(s.plannedRoute), points, offRouteAlertAt: s.offRouteAlertAt });
    if (off.action === 'send') {
      const won = await this.prisma.shipment.updateMany({ where: { id: s.id, offRouteAlertAt: null, status: 'EN_ROUTE' }, data: { offRouteAlertAt: now } });
      if (won.count === 1) {
        const since = off.since ?? now;
        this.events.emit('shipment.alert', { ...base, kind: 'OFF_ROUTE', minutes: Math.max(0, Math.floor((now.getTime() - since.getTime()) / 60_000)), meters: off.distanceM ?? undefined } satisfies ShipmentAlertEvent);
      }
    } else if (off.action === 'clear') {
      await this.prisma.shipment.updateMany({ where: { id: s.id }, data: { offRouteAlertAt: null } });
    }
  }
}
