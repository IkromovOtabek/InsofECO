/**
 * Google encoded polyline (5 xona) dekoderi — ERP `src/lib/trip-track.ts` → `decodePolyline` bilan bir xil.
 * Kutubxona (native modul) qo'shmaslik uchun o'zimizniki. Buzilgan satr — o'qilgan qismigacha qaytariladi.
 */
export interface PolyPoint { lat: number; lng: number }

export function decodePolyline(s: string | null | undefined, precision = 5): PolyPoint[] {
  if (!s) return [];
  const f = 10 ** precision;
  const out: PolyPoint[] = [];
  let i = 0, lat = 0, lng = 0;
  const next = (): number | null => {
    let shift = 0, res = 0, b: number;
    do {
      if (i >= s.length) return null;
      b = s.charCodeAt(i++) - 63;
      if (b < 0 || b > 63) return null;
      res |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return res & 1 ? ~(res >> 1) : res >> 1;
  };
  while (i < s.length) {
    const dLat = next();
    const dLng = next();
    if (dLat == null || dLng == null) break;
    lat += dLat; lng += dLng;
    out.push({ lat: lat / f, lng: lng / f });
  }
  return out;
}
