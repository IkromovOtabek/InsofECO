#!/usr/bin/env node
/**
 * Park xaritasi guruhlash (klaster) tekshiruvi — `src/features/erp/cluster.ts` sof funksiyalari.
 *
 *   node scripts/cluster-check.mts   (yarn workspace @insof/mobile test)
 */
import { CLUSTER_MAX_ZOOM, boundsOf, clusterPoints, metersPerPoint, worldPoint, worstStatus } from '../src/features/erp/cluster.ts';

let fail = 0;
const ok = (name: string, cond: boolean, info?: unknown) => {
  if (cond) console.log(`  ✓ ${name}`);
  else { fail++; console.log(`  ✗ ${name}${info !== undefined ? ` — ${JSON.stringify(info)}` : ''}`); }
};

// Toshkent markazi; 1 m ≈ 1/111195 gradus kenglik
const T = { lat: 41.3111, lng: 69.2797 };
const at = (id: string, dLatM: number, dLngM = 0) => ({
  id, item: id,
  lat: T.lat + dLatM / 111_195,
  lng: T.lng + dLngM / (111_195 * Math.cos((T.lat * Math.PI) / 180)),
});

console.log('── Proyeksiya');
{
  const mpp = metersPerPoint(12, T.lat);
  const a = worldPoint(T.lat, T.lng, 12), b = worldPoint(at('x', 0, 1000).lat, at('x', 0, 1000).lng, 12);
  ok(`zoom 12: 1 km sharqqa ≈ ${(1000 / mpp).toFixed(1)} pt`, Math.abs(b.x - a.x - 1000 / mpp) < 0.5, { dx: b.x - a.x });
  ok('zoom +1 — masofa 2 baravar', Math.abs(worldPoint(T.lat, T.lng, 13).x - 2 * a.x) < 1e-6);
}

console.log('── Guruhlash');
{
  // zoom 12 da 1 pt ≈ 29 m: 300 m ≈ 10 pt (birlashadi), 5 km ≈ 170 pt (alohida)
  const pts = [at('a', 0), at('b', 300), at('c', 0, 300), at('d', 5000), at('e', -5000, 5000)];
  const r = clusterPoints(pts, 12);
  ok('yaqin uchta — bitta guruh', r.clusters.length === 1 && r.clusters[0]!.members.length === 3, r.clusters.map((c) => c.members.map((m) => m.id)));
  ok('uzoq ikkitasi — yolg\'iz', r.singles.map((s) => s.id).sort().join() === 'd,e', r.singles.map((s) => s.id));
  ok('guruh kaliti — eng kichik id', r.clusters[0]!.id === 'a');
  ok('hamma nuqta saqlandi', r.singles.length + r.clusters.reduce((n, c) => n + c.members.length, 0) === pts.length);

  const close = clusterPoints(pts, 16);
  ok('zoom 16 (1 pt ≈ 1.8 m): 300 m — alohida', close.clusters.length === 0 && close.singles.length === 5);
  ok(`zoom ≥ ${CLUSTER_MAX_ZOOM}: bir joydagilar ham guruhlanmaydi`, clusterPoints([at('a', 0), at('b', 0)], CLUSTER_MAX_ZOOM).clusters.length === 0);

  const kept = clusterPoints(pts, 12, { keep: (p) => p.id === 'b' });
  ok('tanlangan (keep) mashina guruhga kirmaydi', kept.singles.some((s) => s.id === 'b') && kept.clusters[0]!.members.every((m) => m.id !== 'b'));

  const shuffled = clusterPoints([...pts].reverse(), 12);
  ok('tartib o\'zgarsa ham natija bir xil', JSON.stringify(shuffled.clusters) === JSON.stringify(r.clusters));

  ok('bitta nuqta — guruh yo\'q', clusterPoints([at('a', 0)], 5).clusters.length === 0);
  ok('NaN koordinata tashlanadi', clusterPoints([{ id: 'n', item: 'n', lat: NaN, lng: 1 }, at('a', 0)], 10).singles.length === 1);

  // Ko'p mashina (bir depoda 200 ta) — tez va hammasi bitta guruhda
  const many = Array.from({ length: 200 }, (_, i) => at(`m${String(i).padStart(3, '0')}`, (i % 20) * 5, Math.floor(i / 20) * 5));
  const t0 = Date.now();
  const m = clusterPoints(many, 10);
  ok(`200 ta mashina: bitta guruh, ${Date.now() - t0} ms`, m.clusters.length === 1 && m.clusters[0]!.members.length === 200);
}

console.log('── Rang va chegara');
ok('muammo eng ustun', worstStatus(['moving', 'offline', 'issue']) === 'issue');
ok('keyin GPS eskirgan', worstStatus(['moving', 'loaded', 'offline']) === 'offline');
ok("yo'lda > yuklangan > kutilmoqda", worstStatus(['waiting', 'loaded', 'moving']) === 'moving' && worstStatus(['waiting', 'loaded']) === 'loaded');
{
  const b = boundsOf([at('a', 0), at('b', 1000)]);
  ok(`chegara: 1 km → ${Math.round(b.spanM)} m`, Math.abs(b.spanM - 1000) < 2);
}

if (fail) { console.log(`\n${fail} ta tekshiruv o'tmadi`); process.exit(1); }
console.log('\nHammasi joyida');
