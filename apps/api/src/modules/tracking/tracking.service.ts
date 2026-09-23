import { Injectable } from '@nestjs/common';
import { DEFAULT_RULES, GpsBatch } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { DeliveriesService } from '../deliveries/deliveries.service';

export interface LivePosition {
  deliveryId: string;
  lat: number;
  lng: number;
  speedKmh?: number;
  heading?: number;
  at: string;
  etaMin: number | null;
  /** Reys boshidan beri GPS izi bo'yicha bosib o'tilgan masofa, km */
  distanceKm?: number;
}

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly deliveries: DeliveriesService,
  ) {}

  /**
   * GPS paketni qabul qiladi: faqat haydovchi o'z faol reysiga.
   * Saqlaydi (Postgres), oxirgi nuqtani Redis'ga (tez o'qish), geofence tekshiradi.
   */
  async ingest(userId: string, batch: GpsBatch): Promise<LivePosition | null> {
    const d = await this.prisma.delivery.findFirst({
      where: { id: batch.deliveryId, driver: { userId }, status: { in: ['LOADING', 'EN_ROUTE', 'ARRIVED', 'UNLOADING'] } },
      include: { order: { select: { lat: true, lng: true, plantOrgId: true, clientOrgId: true } } },
    });
    if (!d) return null;

    await this.prisma.gpsPoint.createMany({
      data: batch.points.map((p) => ({ deliveryId: d.id, lat: p.lat, lng: p.lng, speedKmh: p.speedKmh, heading: p.heading, at: p.at })),
    });

    const last = batch.points.map((p) => ({ ...p, at: new Date(p.at) })).reduce((a, b) => (a.at > b.at ? a : b));
    // Zayavkada obyekt koordinatasi berilmagan bo'lsa (lat/lng = 0) masofa ham, ETA ham ma'nosiz —
    // "11754 daqiqa qoldi" ko'rsatgandan ko'ra hech narsa ko'rsatmagan ma'qul.
    const hasDest = d.order.lat !== 0 || d.order.lng !== 0;
    const distM = hasDest ? haversineMeters(last.lat, last.lng, d.order.lat, d.order.lng) : null;
    const speed = last.speedKmh && last.speedKmh > 5 ? last.speedKmh : 30; // shahar o'rtacha
    const pos: LivePosition = { deliveryId: d.id, lat: last.lat, lng: last.lng, speedKmh: last.speedKmh, heading: last.heading, at: last.at.toISOString(), etaMin: distM != null && d.status === 'EN_ROUTE' ? Math.round(distM / 1000 / speed * 60) : null };
    await this.redis.client.set(`pos:${d.id}`, JSON.stringify(pos), 'EX', 3600);
    await this.redis.client.del(`odo:${d.id}`); // yangi nuqtalar keldi — masofa qayta hisoblansin

    // Geofence: throttle 30 s (Redis NX)
    if (d.status === 'EN_ROUTE' && distM != null && distM <= DEFAULT_RULES.arrivalGeofenceMeters) {
      const first = await this.redis.client.set(`geofence:${d.id}`, '1', 'EX', 30, 'NX');
      if (first) await this.deliveries.systemArrive(d.id, last.at, last.lat, last.lng);
    }
    return pos;
  }

  async lastPosition(deliveryId: string): Promise<LivePosition | null> {
    const raw = await this.redis.client.get(`pos:${deliveryId}`);
    return raw ? (JSON.parse(raw) as LivePosition) : null;
  }

  /** Reys izini (polyline) qaytaradi — nizolarda dalil. */
  track(deliveryId: string) {
    return this.prisma.gpsPoint.findMany({ where: { deliveryId }, orderBy: { at: 'asc' }, select: { lat: true, lng: true, at: true, speedKmh: true } });
  }

  /**
   * Reys boshidan beri bosib o'tilgan masofa (metr) va iz statistikasi.
   * GPS izi bo'yicha — ya'ni haqiqiy yurilgan yo'l, to'g'ri chiziq emas.
   * Natija 30 s Redis'da turadi: xarita har 15 s da so'raydi, har safar qayta hisoblash shart emas.
   */
  async odometer(deliveryId: string): Promise<TrackStats> {
    const cached = await this.redis.client.get(`odo:${deliveryId}`);
    if (cached) return JSON.parse(cached) as TrackStats;
    const points = await this.prisma.gpsPoint.findMany({
      where: { deliveryId },
      orderBy: { at: 'asc' },
      select: { lat: true, lng: true, at: true, speedKmh: true },
    });
    const stats = trackStats(points);
    await this.redis.client.set(`odo:${deliveryId}`, JSON.stringify(stats), 'EX', 30);
    return stats;
  }

  /**
   * Haydovchilar kesimida bosib o'tilgan yo'l (davr bo'yicha).
   *
   * Masofa Postgres'da, `LAG()` oynasi bilan hisoblanadi: oylik hisobotda yuz minglab GPS
   * nuqtasi bo'lishi mumkin, ularni Node'ga tortib olish shart emas. Filtr `trackStats`
   * bilan bir xil — 15 m dan kichik siljish (GPS drifti) va 3 km dan katta sakrash
   * (aloqa uzilishi) yo'lga qo'shilmaydi.
   */
  async mileageByDriver(orgId: string, from: Date, to: Date) {
    return this.prisma.$queryRaw<
      { driverId: string; userId: string; fullName: string; phone: string; trips: bigint; meters: number | null }[]
    >`
      WITH steps AS (
        SELECT
          d."driverId" AS "driverId",
          g."deliveryId" AS "deliveryId",
          2 * 6371000 * asin(sqrt(
            power(sin(radians(g.lat - lag(g.lat) OVER w) / 2), 2) +
            cos(radians(lag(g.lat) OVER w)) * cos(radians(g.lat)) *
            power(sin(radians(g.lng - lag(g.lng) OVER w) / 2), 2)
          )) AS step
        FROM "GpsPoint" g
        JOIN "Delivery" d ON d.id = g."deliveryId"
        JOIN "Order" o ON o.id = d."orderId"
        WHERE o."plantOrgId" = ${orgId}
          AND d."driverId" IS NOT NULL
          AND g.at >= ${from} AND g.at < ${to}
        WINDOW w AS (PARTITION BY g."deliveryId" ORDER BY g.at)
      )
      SELECT
        s."driverId"                         AS "driverId",
        dp."userId"                          AS "userId",
        u."fullName"                         AS "fullName",
        u.phone                              AS phone,
        count(DISTINCT s."deliveryId")       AS trips,
        round(sum(s.step))                   AS meters
      FROM steps s
      JOIN "DriverProfile" dp ON dp.id = s."driverId"
      JOIN "User" u ON u.id = dp."userId"
      WHERE s.step BETWEEN 15 AND 3000
      GROUP BY s."driverId", dp."userId", u."fullName", u.phone
      ORDER BY meters DESC NULLS LAST
    `;
  }

  /** Foydalanuvchi shu reysni kuzatishga haqlimi (zavod, mijoz yoki haydovchi). */
  async canWatch(userId: string, deliveryId: string) {
    const d = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, OR: [{ driver: { userId } }, { order: { plant: { memberships: { some: { userId, isActive: true } } } } }, { order: { client: { memberships: { some: { userId, isActive: true } } } } }] },
      select: { id: true },
    });
    return !!d;
  }
}

export interface TrackStats {
  /** Bosib o'tilgan masofa, metr */
  meters: number;
  /** Nechta GPS nuqtasi bor */
  points: number;
  /** Birinchi va oxirgi nuqta orasidagi vaqt, daqiqa */
  movingMinutes: number;
  /** Iz bo'yicha o'rtacha tezlik, km/soat (vaqt 0 bo'lsa null) */
  avgSpeedKmh: number | null;
  /** Izdagi eng yuqori tezlik, km/soat */
  maxSpeedKmh: number | null;
}

/**
 * GPS izidan masofa va tezlik statistikasi.
 * Shovqin filtri: turgan mashina ham bir necha metr "siljiydi" (GPS drift), shu bilan birga
 * tunnel/aloqa uzilishidan keyin nuqta kilometrlab sakraydi. Ikkalasi ham yo'lga qo'shilmaydi.
 */
export function trackStats(points: { lat: number; lng: number; at: Date; speedKmh?: number | null }[]): TrackStats {
  const MIN_STEP_M = 15;      // bundan kichigi — GPS drifti, harakat emas
  const MAX_STEP_M = 3_000;   // bundan kattasi — aloqa uzilgan, oraliq yo'l noma'lum

  let meters = 0;
  let maxSpeed: number | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const step = haversineMeters(a.lat, a.lng, b.lat, b.lng);
    if (step >= MIN_STEP_M && step <= MAX_STEP_M) meters += step;
    if (b.speedKmh != null && (maxSpeed == null || b.speedKmh > maxSpeed)) maxSpeed = b.speedKmh;
  }
  const first = points[0], last = points[points.length - 1];
  const movingMinutes = first && last ? Math.max(0, (last.at.getTime() - first.at.getTime()) / 60000) : 0;
  return {
    meters: Math.round(meters),
    points: points.length,
    movingMinutes: Math.round(movingMinutes),
    avgSpeedKmh: movingMinutes > 0 ? Math.round((meters / 1000 / (movingMinutes / 60)) * 10) / 10 : null,
    maxSpeedKmh: maxSpeed != null ? Math.round(maxSpeed) : null,
  };
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371e3, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
