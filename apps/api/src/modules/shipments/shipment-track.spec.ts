import { summarizeTrack } from './shipment-track';

const t0 = Date.parse('2026-10-09T08:00:00Z');
/** Shimolga har `dtS` soniyada `stepM` metr (1° kenglik ≈ 111 195 m). */
const line = (n: number, stepM: number, dtS: number, from = 0) =>
  Array.from({ length: n }, (_, i) => ({ lat: 41 + ((from + i) * stepM) / 111_195, lng: 69.2, at: new Date(t0 + (from + i) * dtS * 1000) }));

describe('summarizeTrack', () => {
  it('bo\'sh iz — nol, vaqtlar null', () => {
    const r = summarizeTrack([]);
    expect(r).toMatchObject({ points: [], meters: 0, distanceKm: 0, movingMinutes: 0, firstAt: null, lastAt: null });
  });

  it('masofa va harakat vaqti: 11 nuqta × 500 m / 30 s → 5 km, 5 daq', () => {
    const r = summarizeTrack(line(11, 500, 30));
    expect(r.meters).toBeGreaterThan(4990);
    expect(r.meters).toBeLessThan(5010);
    expect(r.distanceKm).toBe(5);
    expect(r.movingMinutes).toBe(5);
    expect(r.points).toHaveLength(11);
  });

  it('turgan mashina drifti (< 15 m) chiziqqa ham, masofaga ham qo\'shilmaydi', () => {
    const r = summarizeTrack(line(20, 3, 15));
    expect(r.points.length).toBeLessThan(20);
    expect(r.meters).toBeLessThan(60);
    expect(r.movingMinutes).toBe(0);
  });

  it('GPS sakrashi (> 180 km/soat) tashlanadi', () => {
    const pts = line(5, 200, 30);
    pts.splice(2, 0, { lat: 41.5, lng: 69.2, at: new Date(t0 + 45_000) }); // 50 km nariga 15 s da
    const r = summarizeTrack(pts);
    expect(r.points.some((p) => p.lat === 41.5)).toBe(false);
    expect(r.meters).toBeGreaterThan(790);
    expect(r.meters).toBeLessThan(810);
  });

  it('juda uzun iz siyraklashadi, oxirgi nuqta qoladi', () => {
    const pts = line(5000, 20, 2);
    const r = summarizeTrack(pts);
    expect(r.points.length).toBeLessThanOrEqual(1501);
    expect(r.points[r.points.length - 1]!.at).toBe(pts[pts.length - 1]!.at.toISOString());
  });
});
