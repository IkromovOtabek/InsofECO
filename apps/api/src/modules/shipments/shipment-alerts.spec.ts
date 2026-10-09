import {
  IOS_STILL_SILENT_MIN, SILENT_ALERT_MIN, STOP_ALERT_MIN, acceptPlannedRoute, decideOffRoute, decideWatch, distanceToPolyline,
  firstInsideSite, lastSeenStationary, latest, parseRoute, pointToSegmentMeters, standingSince,
} from './shipment-alerts';
import { ShipmentsService } from './shipments.service';

const t0 = Date.parse('2026-10-09T08:00:00Z');
const min = (m: number) => new Date(t0 + m * 60_000);
/** Shimolga `m` metr (1° kenglik ≈ 111 195 m). */
const at = (m: number, northM = 0) => ({ lat: 41 + northM / 111_195, lng: 69.2, at: min(m) });
const site = { lat: 41 + 2000 / 111_195, lng: 69.2 };

describe('firstInsideSite', () => {
  it('300 m ichidagi birinchi nuqta (tartibsiz kelsa ham)', () => {
    const pts = [at(5, 1900), at(1, 0), at(3, 1750), at(2, 1000)];
    expect(firstInsideSite(pts, site)?.at).toEqual(min(3));
  });
  it('doiraga kirmagan iz va noma\'lum obyekt — null', () => {
    expect(firstInsideSite([at(1, 0), at(2, 1600)], site)).toBeNull();
    expect(firstInsideSite([at(1, 2000)], null)).toBeNull();
  });
  it('(0,0) va noto\'g\'ri nuqta hisobga olinmaydi', () => {
    expect(firstInsideSite([{ lat: 0, lng: 0, at: min(1) }], { lat: 0.001, lng: 0 })).toBeNull();
  });
});

describe('standingSince', () => {
  it('oxirgi harakatdan keyingi birinchi nuqta — turish boshlanishi', () => {
    const pts = [at(0, 0), at(5, 1000), at(10, 1040), at(20, 1010), at(30, 1050)];
    expect(standingSince(pts)).toEqual(min(5));
  });
  it('yurayotgan mashina — oxirgi nuqtaning o\'zi', () => {
    expect(standingSince([at(0, 0), at(1, 500), at(2, 1000)])).toEqual(min(2));
  });
  it('nuqta yo\'q — null', () => {
    expect(standingSince([])).toBeNull();
  });
});

describe('decideWatch', () => {
  const base = { departedAt: min(0), stopAlertAt: null, silentAlertAt: null };

  it(`${STOP_ALERT_MIN} daqiqa turdi — "turibdi" yuboriladi`, () => {
    const d = decideWatch({ ...base, now: min(30), lastGpsAt: min(29), standingSince: min(8) });
    expect(d).toMatchObject({ stop: 'send', stoppedMin: 22, silent: null });
  });
  it('19 daqiqa — hali yo\'q', () => {
    expect(decideWatch({ ...base, now: min(27), lastGpsAt: min(26), standingSince: min(8) }).stop).toBeNull();
  });
  it('allaqachon yuborilgan — qayta yuborilmaydi; yurgach belgi tozalanadi', () => {
    expect(decideWatch({ ...base, stopAlertAt: min(28), now: min(35), lastGpsAt: min(34), standingSince: min(8) }).stop).toBeNull();
    expect(decideWatch({ ...base, stopAlertAt: min(28), now: min(40), lastGpsAt: min(39), standingSince: min(39) }).stop).toBe('clear');
  });
  it(`${SILENT_ALERT_MIN} daqiqa GPS yo'q — "jim"; turish baholanmaydi va belgisi tozalanmaydi`, () => {
    const d = decideWatch({ ...base, stopAlertAt: min(25), now: min(45), lastGpsAt: min(34), standingSince: min(1) });
    expect(d).toMatchObject({ silent: 'send', silentMin: 11, stop: null, stoppedMin: null });
  });
  it('hali birorta nuqta kelmagan — yo\'lga chiqqandan hisoblanadi', () => {
    expect(decideWatch({ ...base, now: min(9), lastGpsAt: null, standingSince: null }).silent).toBeNull();
    expect(decideWatch({ ...base, now: min(10), lastGpsAt: null, standingSince: null }).silent).toBe('send');
  });
  it('GPS qaytdi — "jim" belgisi tozalanadi', () => {
    expect(decideWatch({ ...base, silentAlertAt: min(20), now: min(31), lastGpsAt: min(30), standingSince: min(30) }).silent).toBe('clear');
  });
});

describe('iOS: turgan telefon jimligi', () => {
  const base = { departedAt: min(0), stopAlertAt: null, silentAlertAt: null };
  it('lastSeenStationary: sekin va 150 m ichida — true; yurgan yoki bitta nuqta — false', () => {
    expect(lastSeenStationary([{ ...at(5, 0), speedKmh: 0.5 }, { ...at(6, 40), speedKmh: 0 }])).toBe(true);
    expect(lastSeenStationary([at(5, 0), at(6, 40)])).toBe(true);
    expect(lastSeenStationary([{ ...at(5, 0), speedKmh: 30 }, { ...at(6, 500), speedKmh: 30 }])).toBe(false);
    expect(lastSeenStationary([at(5, 0), { ...at(6, 40), speedKmh: 12 }])).toBe(false);
    expect(lastSeenStationary([at(6, 0)])).toBe(false);
  });
  it(`iOS turibdi — ${IOS_STILL_SILENT_MIN} daqiqagacha "jim" emas, "turibdi" ishlaydi`, () => {
    const d = decideWatch({ ...base, now: min(35), lastGpsAt: min(14), standingSince: min(8), iosStill: true });
    expect(d).toMatchObject({ silent: null, stop: 'send', stoppedMin: 27 });
    expect(decideWatch({ ...base, now: min(45), lastGpsAt: min(14), standingSince: min(8), iosStill: true }).silent).toBe('send');
  });
  it('Android yoki yurgan iOS — odatdagi 10 daqiqa', () => {
    expect(decideWatch({ ...base, now: min(25), lastGpsAt: min(14), standingSince: min(8), iosStill: false }).silent).toBe('send');
  });
  it('ping — oxirgi nuqtadan kechroq bo\'lsa u hisoblanadi', () => {
    expect(latest(min(10), min(20))).toEqual(min(20));
    expect(latest(min(20), null)).toEqual(min(20));
    expect(latest(undefined, min(5))).toEqual(min(5));
    expect(latest(null, null)).toBeNull();
    expect(decideWatch({ ...base, now: min(25), lastGpsAt: latest(min(10), min(20)), standingSince: min(10) }).silent).toBeNull();
  });
});

describe('Nuqtadan chiziqqacha masofa', () => {
  // Sharqqa `m` metr (41° kenglikda)
  const east = (m: number, northM = 0) => ({ lat: 41 + northM / 111_195, lng: 69.2 + m / (111_195 * Math.cos((41 * Math.PI) / 180)) });
  const line = [east(0), east(1000), east(1000, 1000)];
  it('kesma ichiga perpendikulyar', () => {
    expect(pointToSegmentMeters(east(500, 200), east(0), east(1000))).toBeCloseTo(200, -1);
  });
  it('kesma uchidan tashqarida — eng yaqin uchgacha', () => {
    expect(pointToSegmentMeters(east(-300, 400), east(0), east(1000))).toBeCloseTo(500, -1);
  });
  it('siniq chiziq — eng yaqin kesma; bo\'sh — Infinity', () => {
    expect(distanceToPolyline(east(1300, 600), line)).toBeCloseTo(300, -1);
    expect(distanceToPolyline(east(500, 0), line)).toBeLessThan(1);
    expect(distanceToPolyline(east(0), [])).toBe(Infinity);
  });
  it('parseRoute — buzilgan nuqtalar tashlanadi', () => {
    expect(parseRoute([{ lat: 41, lng: 69 }, { lat: 'x' }, null, { lat: 0, lng: 0 }])).toEqual([{ lat: 41, lng: 69 }]);
    expect(parseRoute(null)).toEqual([]);
  });
});

describe('decideOffRoute', () => {
  // Yo'l shimolga 10 km (lng 69.2); `side` — yo'ldan sharqqa metr
  const route = [{ lat: 41, lng: 69.2 }, { lat: 41 + 10_000 / 111_195, lng: 69.2 }];
  const k = 111_195 * Math.cos((41 * Math.PI) / 180);
  const fx = (m: number, northM: number, side: number) => ({ lat: 41 + northM / 111_195, lng: 69.2 + side / k, at: min(m) });
  const onRoute = [fx(0, 0, 10), fx(1, 500, 20), fx(2, 1000, 30)];

  it('2 daqiqadan ko\'p, 3+ nuqta 500 m dan uzoq — bir marta xabar', () => {
    const pts = [...onRoute, fx(3, 1200, 600), fx(4, 1300, 800), fx(5, 1400, 900)];
    const d = decideOffRoute({ now: min(5), route, points: pts, offRouteAlertAt: null });
    expect(d).toMatchObject({ action: 'send', since: min(3) });
    expect(d.distanceM).toBeCloseTo(900, -1);
    expect(decideOffRoute({ now: min(5), route, points: pts, offRouteAlertAt: min(5) }).action).toBeNull();
  });
  it('qisqa chetlashish (1 daqiqa) yoki bitta sakrash — xabar yo\'q', () => {
    expect(decideOffRoute({ now: min(4), route, points: [...onRoute, fx(3, 1200, 600), fx(4, 1300, 700)], offRouteAlertAt: null }).action).toBeNull();
    expect(decideOffRoute({ now: min(5), route, points: [...onRoute, fx(5, 1300, 2000)], offRouteAlertAt: null }).action).toBeNull();
  });
  it('yo\'lga 300 m ichida qaytdi — belgi tozalanadi; 300–500 m — o\'zgarmaydi', () => {
    expect(decideOffRoute({ now: min(9), route, points: [fx(8, 2000, 900), fx(9, 2100, 100)], offRouteAlertAt: min(5) }).action).toBe('clear');
    expect(decideOffRoute({ now: min(9), route, points: [fx(8, 2000, 900), fx(9, 2100, 400)], offRouteAlertAt: min(5) }).action).toBeNull();
  });
  it('yo\'l yo\'q yoki ma\'lumot eski — baholanmaydi', () => {
    const pts = [fx(3, 1200, 600), fx(4, 1300, 800), fx(6, 1400, 900)];
    expect(decideOffRoute({ now: min(6), route: [], points: pts, offRouteAlertAt: null }).action).toBeNull();
    expect(decideOffRoute({ now: min(30), route, points: pts, offRouteAlertAt: null }).action).toBeNull();
  });
});

describe('acceptPlannedRoute', () => {
  const stored = [{ lat: 41, lng: 69.2 }, { lat: 41.1, lng: 69.2 }];
  const k = 111_195 * Math.cos((41 * Math.PI) / 180);
  const pos = (side: number) => ({ lat: 41.05, lng: 69.2 + side / k });
  const nextFrom = (p: { lat: number; lng: number }) => [p, { lat: 41.1, lng: 69.2 }];

  it('birinchi yo\'l yoki mashina yo\'lda — qabul', () => {
    expect(acceptPlannedRoute({ stored: [], next: nextFrom(pos(0)), pos: pos(0), offRouteAlertAt: null })).toEqual({ accept: true, clearAlert: false });
    expect(acceptPlannedRoute({ stored, next: nextFrom(pos(100)), pos: pos(100), offRouteAlertAt: null })).toEqual({ accept: true, clearAlert: false });
  });
  it('chetlashish baholanmoqda (xabar hali yo\'q) — rad: eski yo\'l qoladi', () => {
    expect(acceptPlannedRoute({ stored, next: nextFrom(pos(800)), pos: pos(800), offRouteAlertAt: null })).toEqual({ accept: false, clearAlert: false });
  });
  it('xabar berilgan — yangi yo\'l asos bo\'ladi va belgi tozalanadi (mashina yangi yo\'lda bo\'lsa)', () => {
    expect(acceptPlannedRoute({ stored, next: nextFrom(pos(800)), pos: pos(800), offRouteAlertAt: min(5) })).toEqual({ accept: true, clearAlert: true });
    expect(acceptPlannedRoute({ stored, next: nextFrom(pos(3000)), pos: pos(800), offRouteAlertAt: min(5) })).toEqual({ accept: true, clearAlert: false });
  });
});

describe('ShipmentsService.ingestGps — obyektga yetib kelish', () => {
  const ship = (over: Record<string, unknown> = {}) => ({
    id: 's1', number: 7, cargo: 'Sement', organizationId: 'org', status: 'EN_ROUTE', loadedAt: min(-10), deliveredAt: null, nearSiteAt: null,
    project: { name: 'Uy', lat: site.lat, lng: site.lng }, request: { requestedByUserId: 'q1' }, ...over,
  });
  function setup(s: ReturnType<typeof ship>, won = 1) {
    const prisma = {
      shipment: { findFirst: jest.fn().mockResolvedValue(s), updateMany: jest.fn().mockResolvedValue({ count: won }) },
      shipmentGpsPoint: { createMany: jest.fn() },
    };
    const events = { emit: jest.fn() };
    return { svc: new ShipmentsService(prisma as never, events as never, {} as never), prisma, events };
  }
  const a = { userId: 'd1', role: 'HAYDOVCHI' as const, orgId: 'org', sessionId: 'x' };
  const now = Date.now();
  const pt = (northM: number, agoMin: number) => ({ ...at(0, northM), at: new Date(now - agoMin * 60_000) });

  it('doiraga kirdi — bir marta xabar', async () => {
    const { svc, prisma, events } = setup(ship({ loadedAt: new Date(now - 60 * 60_000) }));
    await svc.ingestGps(a, 's1', { points: [pt(1500, 2), pt(1850, 1)] });
    expect(prisma.shipment.updateMany).toHaveBeenCalledWith({ where: { id: 's1', nearSiteAt: null }, data: { nearSiteAt: expect.any(Date) } });
    expect(events.emit).toHaveBeenCalledWith('shipment.near_site', expect.objectContaining({ shipmentId: 's1', requesterUserId: 'q1' }));
  });
  it('parallel paket yutqazdi yoki allaqachon belgilangan — xabar yo\'q', async () => {
    const lost = setup(ship({ loadedAt: new Date(now - 60 * 60_000) }), 0);
    await lost.svc.ingestGps(a, 's1', { points: [pt(1900, 1)] });
    expect(lost.events.emit).not.toHaveBeenCalled();
    const done = setup(ship({ loadedAt: new Date(now - 60 * 60_000), nearSiteAt: new Date() }));
    await done.svc.ingestGps(a, 's1', { points: [pt(1900, 1)] });
    expect(done.prisma.shipment.updateMany).not.toHaveBeenCalled();
  });
  it('uzoqda yoki yuklash holatida — tekshirilmaydi', async () => {
    const far = setup(ship({ loadedAt: new Date(now - 60 * 60_000) }));
    await far.svc.ingestGps(a, 's1', { points: [pt(500, 1)] });
    expect(far.prisma.shipment.updateMany).not.toHaveBeenCalled();
    const loading = setup(ship({ status: 'LOADING', loadedAt: new Date(now - 60 * 60_000) }));
    await loading.svc.ingestGps(a, 's1', { points: [pt(1950, 1)] });
    expect(loading.prisma.shipment.updateMany).not.toHaveBeenCalled();
  });
});
