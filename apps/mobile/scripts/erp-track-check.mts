#!/usr/bin/env node
/**
 * ERP GPS izi tekshiruvi — `src/core/erp-track-logic.ts` (bufer, filtr, stop) va `src/core/polyline.ts`.
 *
 *   node scripts/erp-track-check.mts   (yarn workspace @insof/mobile test)
 */
import {
  HEARTBEAT_MS, MAX_ACCURACY_M, TRACK_CHUNK, ackSent, appendPoints, heartbeatDue, nextChunk, runFlush, stopOf, toTrackPoint, trackBody,
  type TrackBuffer, type TrackPoint,
} from '../src/core/erp-track-logic.ts';
import { decodePolyline } from '../src/core/polyline.ts';

let fail = 0;
const ok = (name: string, cond: boolean, info?: unknown) => {
  if (cond) console.log(`  ✓ ${name}`);
  else { fail++; console.log(`  ✗ ${name}${info !== undefined ? ` — ${JSON.stringify(info)}` : ''}`); }
};
const near = (a: number, b: number, eps = 1e-5) => Math.abs(a - b) < eps;

/** Sinov uchun kodlovchi (ERP `encodePolyline` bilan bir xil algoritm). */
function encode(pts: { lat: number; lng: number }[]) {
  let out = '', pLat = 0, pLng = 0;
  const enc = (v: number) => { let x = v < 0 ? ~(v << 1) : v << 1; while (x >= 0x20) { out += String.fromCharCode((0x20 | (x & 0x1f)) + 63); x >>= 5; } out += String.fromCharCode(x + 63); };
  for (const p of pts) { const la = Math.round(p.lat * 1e5), ln = Math.round(p.lng * 1e5); enc(la - pLat); enc(ln - pLng); pLat = la; pLng = ln; }
  return out;
}

console.log('── Polyline');
{
  const r = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  ok('Google namunasi: 3 nuqta', r.length === 3, r);
  ok('1-nuqta 38.5, -120.2', near(r[0]!.lat, 38.5) && near(r[0]!.lng, -120.2), r[0]);
  ok('3-nuqta 43.252, -126.453', near(r[2]!.lat, 43.252) && near(r[2]!.lng, -126.453), r[2]);
  const tash = [{ lat: 41.31112, lng: 69.27974 }, { lat: 41.31, lng: 69.3 }, { lat: 41.2995, lng: 69.24011 }, { lat: 41.2995, lng: 69.24011 }];
  const back = decodePolyline(encode(tash));
  ok('kodlash → dekodlash (Toshkent, takror nuqta bilan)', back.length === 4 && back.every((p, i) => near(p.lat, tash[i]!.lat) && near(p.lng, tash[i]!.lng)), back);
  ok("bo'sh / null — []", decodePolyline('').length === 0 && decodePolyline(null).length === 0);
  const broken = encode(tash).slice(0, -1);
  ok('buzilgan satr — o\'qilgancha, yiqilmaydi', decodePolyline(broken).length === 3, decodePolyline(broken).length);
}

console.log('── Nuqta filtri');
{
  const at = Date.parse('2026-10-09T08:00:00Z');
  const fix = (c: Record<string, number | null>) => ({ timestamp: at, coords: { latitude: 41.3, longitude: 69.28, ...c } });
  const ios = toTrackPoint(fix({ speed: -1, heading: -1, accuracy: 12 }));
  ok("iOS -1 tezlik/yo'nalish — yuborilmaydi", !!ios && !('speedKmh' in ios) && !('heading' in ios), ios);
  ok('aniqlik yuboriladi', ios?.accuracy === 12, ios);
  ok(`aniqlik > ${MAX_ACCURACY_M} m — buferga qo'shilmaydi`, toTrackPoint(fix({ accuracy: 150 })) === null);
  ok('aniqlik roppa-rosa 100 m — qabul', toTrackPoint(fix({ accuracy: 100 })) !== null);
  const fast = toTrackPoint(fix({ speed: 10, heading: 359.6, accuracy: null }));
  ok('10 m/s → 36 km/soat, yo\'nalish yaxlitlanadi', fast?.speedKmh === 36 && fast?.heading === 360 && !('accuracy' in fast!), fast);
  ok("aql bovar qilmas tezlik (>300 km/soat) — maydon yo'q", !('speedKmh' in toTrackPoint(fix({ speed: 100 }))!));
  ok('buzuq koordinata — tashlanadi', toTrackPoint({ timestamp: at, coords: { latitude: NaN, longitude: 69 } }) === null && toTrackPoint({ timestamp: at, coords: { latitude: 0, longitude: 0 } }) === null);
  ok('vaqt ISO', ios?.at === '2026-10-09T08:00:00.000Z', ios?.at);
}

const P = (i: number): TrackPoint => ({ lat: 41 + i / 1e4, lng: 69, at: new Date(Date.UTC(2026, 9, 9, 8, 0, i)).toISOString() });
const range = (n: number, from = 0) => Array.from({ length: n }, (_, i) => P(from + i));

console.log('── Bufer va bo\'laklar');
{
  let b: TrackBuffer = { tripId: null, points: [] };
  b = appendPoints(b, 'A', range(3));
  b = appendPoints(b, 'A', [P(2), P(3)]);
  ok("takror nuqta qo'shilmaydi", b.points.length === 4, b.points.length);
  const sameAt = appendPoints(b, 'A', [{ ...P(3), lat: 41.5 }, P(4)]);
  ok("vaqti bir xil (joyi boshqa) nuqta qo'shilmaydi", sameAt.points.length === 5 && sameAt.points[3]!.lat === P(3).lat, sameAt.points.length);
  const c = appendPoints(b, 'B', [P(10)]);
  ok("boshqa reys — eski bufer almashtiriladi (B iziga A tushmaydi)", c.tripId === 'B' && c.points.length === 1, c);
  ok('MAX chegarasi — eng eskisi tashlanadi', appendPoints({ tripId: 'A', points: range(10) }, 'A', range(5, 10), 8).points[0]!.at === P(7).at);

  const big: TrackBuffer = { tripId: 'A', points: range(1200) };
  const ch = nextChunk(big);
  ok(`bo'lak ≤ ${TRACK_CHUNK}`, ch.length === TRACK_CHUNK && ch[0]!.at === P(0).at, ch.length);

  // Yuborish paytida fon vazifasi yangi nuqta qo'shdi — javobdan keyin faqat yuborilganlar o'chadi
  const during = appendPoints(big, 'A', range(3, 5000));
  const after = ackSent(during, 'A', ch);
  ok("faqat yuborilganlar o'chdi, yangilari qoldi", after.points.length === 700 + 3 && after.points[0]!.at === P(500).at && after.points.at(-1)!.at === P(5002).at, after.points.length);
  ok("boshqa reys buferiga tegilmaydi", ackSent({ tripId: 'B', points: range(2) }, 'A', range(2)).points.length === 2);

  // To'liq sikl: 1200 nuqta → 3 so'rov (500/500/200), hammasi ketdi
  let buf: TrackBuffer = big; const sizes: number[] = [];
  for (let i = 0; i < 5 && buf.points.length; i++) { const x = nextChunk(buf); sizes.push(x.length); buf = ackSent(buf, 'A', x); }
  ok('1200 nuqta → 500 + 500 + 200', sizes.join(',') === '500,500,200' && buf.points.length === 0, sizes);

  // Xato (tarmoq) — ack yo'q: bufer o'zgarmaydi, keyingi safar qayta ketadi
  ok("xatoda bufer joyida", nextChunk(big).length === 500 && big.points.length === 1200);
}

console.log("── Stop va «tirikman»");
{
  ok('200 {stop, CLOSED}', stopOf({ ok: true, accepted: 0, stop: true, reason: 'CLOSED' }, 200) === 'CLOSED');
  ok('200 {stop, DELIVERED}', stopOf({ ok: true, stop: true, reason: 'DELIVERED' }, 200) === 'DELIVERED');
  ok('403 {code: FORBIDDEN, stop, REASSIGNED}', stopOf({ code: 'FORBIDDEN', message: 'x', stop: true, reason: 'REASSIGNED' }, 403) === 'REASSIGNED');
  ok('404 {stop: true} — sababsiz', stopOf({ code: 'NOT_FOUND', message: 'Reys topilmadi', stop: true }, 404) === 'NOT_FOUND');
  ok("oddiy javob — to'xtatilmaydi", stopOf({ ok: true, accepted: 5, dropped: 0, duplicates: 0 }, 200) === null);
  ok("eski server 403 (stop yo'q) — to'xtatilmaydi", stopOf({ code: 'FORBIDDEN', message: 'x' }, 403) === null);
  ok('stop: "true" (satr) — hisobga olinmaydi', stopOf({ stop: 'true' }) === null && stopOf(null) === null);

  const now = 1_000_000;
  ok(`${HEARTBEAT_MS / 1000} s o'tdi — tirikman`, heartbeatDue(now - HEARTBEAT_MS, now) && !heartbeatDue(now - HEARTBEAT_MS + 1, now));
  const hb = trackBody('A', [], 'ios', Date.parse('2026-10-09T08:00:00Z'));
  ok("bo'sh nuqta — heartbeat + ping + platform", 'heartbeat' in hb && hb.heartbeat === true && hb.points.length === 0 && (hb as { ping: string }).ping === '2026-10-09T08:00:00.000Z' && hb.platform === 'ios', hb);
  const pb = trackBody('A', [P(1)], 'android');
  ok("nuqtali so'rovda heartbeat yo'q, platform bor", !('heartbeat' in pb) && pb.platform === 'android' && pb.points.length === 1, pb);
}

console.log('── Yuborish sikli (runFlush)');
{
  /** Soxta MMKV + server: `replies` — har so'rovga javob; `handleStop` — erp-track.ts dagi kabi. */
  const world = (init: TrackBuffer, active: string | null, replies: ('ok' | 'stop' | 'error')[], onSend?: (n: number) => void) => {
    const st = { buf: init, active, sent: [] as { tripId: string; n: number }[] };
    const d = {
      read: () => st.buf,
      write: (b: TrackBuffer) => { st.buf = b; },
      active: () => st.active,
      send: async (tripId: string, pts: TrackPoint[]) => {
        st.sent.push({ tripId, n: pts.length });
        onSend?.(st.sent.length);
        const r = replies.shift() ?? 'ok';
        if (r === 'stop') { if (st.buf.tripId === tripId) st.buf = { tripId: null, points: [] }; if (st.active === tripId) st.active = null; return 'stopped' as const; }
        return r === 'error' ? 'error' as const : 'ok' as const;
      },
    };
    return { st, d };
  };
  {
    const { st, d } = world({ tripId: 'A', points: range(1200) }, 'A', []);
    await runFlush(d);
    ok('1200 → 3 so\'rov, bufer bo\'sh', st.sent.map((x) => x.n).join(',') === '500,500,200' && st.buf.points.length === 0, st.sent);
  }
  {
    const { st, d } = world({ tripId: 'A', points: range(700) }, 'A', ['ok', 'error']);
    await runFlush(d);
    ok('2-bo\'lakda tarmoq xatosi — 200 nuqta joyida', st.buf.points.length === 200 && st.buf.points[0]!.at === P(500).at, st.buf.points.length);
  }
  {
    const { st, d } = world({ tripId: 'A', points: range(5) }, 'A', ['stop']);
    await runFlush(d);
    ok('200 stop — bufer tozalandi, kuzatuv to\'xtadi, boshqa so\'rov yo\'q', st.buf.points.length === 0 && st.active === null && st.sent.length === 1, st);
  }
  {
    const { st, d } = world({ tripId: null, points: [] }, 'A', []);
    await runFlush(d);
    ok("bo'sh bufer + faol reys — bitta «tirikman» (0 nuqta)", st.sent.length === 1 && st.sent[0]!.n === 0 && st.sent[0]!.tripId === 'A', st.sent);
  }
  {
    const { st, d } = world({ tripId: null, points: [] }, null, []);
    await runFlush(d);
    ok("faol reys yo'q — hech narsa yuborilmaydi", st.sent.length === 0);
  }
  {
    // Eski reys A qoldig'i, hozir B faol: A o'z id'si bilan ketadi, «tirikman» B uchun ortiqcha yuborilmaydi
    const { st, d } = world({ tripId: 'A', points: range(3) }, 'B', []);
    await runFlush(d);
    ok("eski reys qoldig'i o'z tripId'si bilan", st.sent.length === 1 && st.sent[0]!.tripId === 'A' && st.buf.points.length === 0, st.sent);
  }
  {
    // Yuborish paytida fon vazifasi 2 ta yangi nuqta qo'shdi — ular yo'qolmaydi
    const holder: { d?: { write: (b: TrackBuffer) => void; read: () => TrackBuffer } } = {};
    const { st, d } = world({ tripId: 'A', points: range(3) }, 'A', ['ok', 'error'], (n) => { if (n === 1) holder.d!.write(appendPoints(holder.d!.read(), 'A', range(2, 100))); });
    holder.d = d;
    await runFlush(d);
    ok("so'rov paytida kelgan nuqtalar buferda qoldi", st.buf.points.length === 2 && st.buf.points[0]!.at === P(100).at, st.buf.points);
  }
  {
    // 403 REASSIGNED (stop) — boshqa haydovchiga o'tgan reys: tozalanadi
    const { st, d } = world({ tripId: 'A', points: range(4) }, 'A', ['stop']);
    await runFlush(d);
    ok('403/404 stop — xuddi shunday tozalanadi', st.buf.points.length === 0 && st.active === null);
  }
}

console.log(fail ? `\n${fail} ta tekshiruv o'tmadi` : '\nHammasi joyida');
process.exit(fail ? 1 : 0);
