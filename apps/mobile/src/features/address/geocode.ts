import { TurboModuleRegistry, type TurboModule } from 'react-native';
import * as Location from 'expo-location';
import { config } from '@/core/config';
import { initMaps } from '@/core/map';

/**
 * Manzil qidiruvi: yozish paytida takliflar, taklifning koordinatasi va xaritadagi nuqtaning manzili.
 *
 * Manbalar, tartib bilan:
 *  1. Yandex MapKit (Full) — `RTNSuggestsModule` / `RTNSearchModule`, MapKit kaliti bilan.
 *     Lite build'da modullar bor, lekin har chaqiruvni rad etadi — shunda 2-manbaga o'tamiz.
 *  2. Yandex HTTP API — `EXPO_PUBLIC_YANDEX_GEOSUGGEST_KEY` (takliflar) va
 *     `EXPO_PUBLIC_YANDEX_GEOCODER_KEY` (koordinata / teskari geokod). Ixtiyoriy zaxira.
 *  3. Kalitsiz — telefonning o'z geokoderi (expo-location): takliflar yo'q, lekin GPS nuqtadan
 *     manzil matni va yozilgan manzildan taxminiy nuqta olinadi.
 *
 * Native modul `getEnforcing` bilan emas, `get` bilan olinadi: modul bo'lmasa (Expo Go, eski
 * build) ilova yiqilmaydi, faqat keyingi manbaga o'tiladi.
 */

export interface PickedAddress { address: string; lat: number; lng: number }
export interface PlaceSuggestion { id: string; title: string; subtitle?: string; uri?: string; lat?: number; lng?: number }
export type SearchSource = 'yandex' | 'http' | 'none';

interface Pt { lat: number; lon: number }
interface NativeAddress { formatted?: string; point?: Pt; uri?: string }
interface SuggestSpec extends TurboModule {
  suggestWithOptions(query: string, options: object): Promise<{ title: string; subtitle?: string; uri?: string }[]>;
}
interface SearchSpec extends TurboModule {
  geoToAddress(point: Pt): Promise<NativeAddress>;
  searchByURI(uri: string, options: object): Promise<NativeAddress>;
  addressToGeo(address: string): Promise<Pt>;
}

const GEOSUGGEST_KEY = (process.env.EXPO_PUBLIC_YANDEX_GEOSUGGEST_KEY ?? '').trim();
const GEOCODER_KEY = (process.env.EXPO_PUBLIC_YANDEX_GEOCODER_KEY ?? '').trim();

/** O'zbekiston va qo'shni hududlar — takliflar shu oynada ustun. */
const UZ_BOX = { southWest: { lat: 37.0, lon: 55.9 }, northEast: { lat: 45.6, lon: 73.2 } };

/** Native qidiruv bir marta "yo'q" desa (Lite build) — qayta urinib vaqt yo'qotmaymiz. */
let nativeOff = !config.mapsEnabled;

function native() {
  if (nativeOff) return null;
  try {
    initMaps(); // MapKit kalitsiz qidiruv ham ishlamaydi
    const suggest = TurboModuleRegistry.get<SuggestSpec>('RTNSuggestsModule');
    const search = TurboModuleRegistry.get<SearchSpec>('RTNSearchModule');
    if (!suggest || !search) { nativeOff = true; return null; }
    return { suggest, search };
  } catch {
    nativeOff = true;
    return null;
  }
}

/** Lite yoki modul yo'q — bu doimiy holat; tarmoq xatosi esa vaqtinchalik. */
function markNative(e: unknown) {
  const msg = String((e as Error)?.message ?? e);
  if (/lite|not available|not implemented|null/i.test(msg)) nativeOff = true;
}

/** Hozir qaysi manba ishlaydi — UI izohi uchun. */
export function searchSource(): SearchSource {
  if (!nativeOff) return 'yandex';
  return GEOSUGGEST_KEY ? 'http' : 'none';
}

const valid = (lat?: number, lng?: number): lat is number =>
  lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

/** Taklif havolasidagi `ll=uzunlik,kenglik` (MapKit ba'zan nuqtani shu yerda beradi). */
function llFromUri(uri?: string): { lat: number; lng: number } | null {
  const m = uri?.match(/[?&]ll=([-\d.]+)(?:%2C|,)([-\d.]+)/i);
  if (!m) return null;
  const lng = Number(m[1]), lat = Number(m[2]);
  return valid(lat, lng) ? { lat, lng } : null;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

// ───────────── takliflar ─────────────

/**
 * Yozilgan matn bo'yicha takliflar. `near` — foydalanuvchi turgan joy (yaqinlari yuqorida).
 * Bo'sh ro'yxat — topilmadi YOKI manba yo'q; farqini `searchSource()` aytadi.
 */
export async function suggestPlaces(query: string, near?: { lat: number; lng: number } | null, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const n = native();
  if (n) {
    try {
      const items = await n.suggest.suggestWithOptions(q, {
        suggestTypes: ['GEO', 'BIZ'],
        boundingBox: UZ_BOX,
        ...(near ? { userPosition: { lat: near.lat, lon: near.lng } } : {}),
      });
      return items.slice(0, 7).map((s, i) => {
        const ll = llFromUri(s.uri);
        return { id: `y${i}:${s.uri ?? s.title}`, title: s.title, subtitle: s.subtitle, uri: s.uri, lat: ll?.lat, lng: ll?.lng };
      });
    } catch (e) {
      markNative(e);
      // Lite build — doimiy holat, UI "takliflar yo'q" izohiga o'tadi; tarmoq xatosi — ko'rsatiladi
      if (!GEOSUGGEST_KEY) { if (nativeOff) return []; throw e; }
    }
  }

  if (!GEOSUGGEST_KEY) return [];
  const params = new URLSearchParams({ apikey: GEOSUGGEST_KEY, text: q, lang: 'uz', results: '7', print_address: '1', attrs: 'uri' });
  if (near) params.set('ll', `${near.lng},${near.lat}`);
  else { params.set('ll', '66.0,41.3'); params.set('spn', '17,9'); } // butun O'zbekiston
  type Resp = { results?: { title?: { text?: string }; subtitle?: { text?: string }; address?: { formatted_address?: string }; uri?: string }[] };
  const r = await fetchJson<Resp>(`https://suggest-maps.yandex.ru/v1/suggest?${params.toString()}`, signal);
  return (r.results ?? []).filter((x) => x.title?.text).map((x, i) => ({
    id: `h${i}:${x.uri ?? x.title?.text}`,
    title: x.title!.text!,
    subtitle: x.address?.formatted_address ?? x.subtitle?.text,
    uri: x.uri,
  }));
}

// ───────────── HTTP geokoder ─────────────

type GeoResp = { response?: { GeoObjectCollection?: { featureMember?: { GeoObject?: { Point?: { pos?: string }; metaDataProperty?: { GeocoderMetaData?: { text?: string } } } }[] } } };

async function httpGeocode(params: Record<string, string>): Promise<PickedAddress | null> {
  if (!GEOCODER_KEY) return null;
  const qs = new URLSearchParams({ apikey: GEOCODER_KEY, format: 'json', lang: 'uz_UZ', results: '1', ...params });
  const r = await fetchJson<GeoResp>(`https://geocode-maps.yandex.ru/1.x/?${qs.toString()}`);
  const g = r.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  const [lng, lat] = (g?.Point?.pos ?? '').split(' ').map(Number);
  const text = g?.metaDataProperty?.GeocoderMetaData?.text;
  return valid(lat, lng) && text ? { address: text, lat, lng: lng! } : null;
}

// ───────────── taklif → nuqta ─────────────

/** Tanlangan taklifning koordinatasi. `null` — nuqta topilmadi (manzil matn bo'lib qoladi). */
export async function resolvePlace(s: PlaceSuggestion): Promise<PickedAddress | null> {
  const label = [s.title, s.subtitle].filter(Boolean).join(', ');
  if (valid(s.lat, s.lng)) return { address: label, lat: s.lat, lng: s.lng! };

  const n = native();
  if (n) {
    try {
      const a = s.uri ? await n.search.searchByURI(s.uri, {}) : null;
      if (a?.point && valid(a.point.lat, a.point.lon)) return { address: a.formatted || label, lat: a.point.lat, lng: a.point.lon };
      const p = await n.search.addressToGeo(label);
      if (valid(p.lat, p.lon)) return { address: label, lat: p.lat, lng: p.lon };
    } catch (e) { markNative(e); }
  }
  try {
    const h = s.uri ? await httpGeocode({ uri: s.uri }) : null;
    if (h) return { ...h, address: label || h.address };
    const t = await httpGeocode({ geocode: label });
    if (t) return { ...t, address: label || t.address };
  } catch { /* keyingi manba */ }
  const g = await geocodeText(label);
  return g ? { address: label, ...g } : null;
}

/** Yozilgan matndan taxminiy nuqta — telefonning o'z geokoderi (kalit kerak emas). */
export async function geocodeText(text: string): Promise<{ lat: number; lng: number } | null> {
  if (text.trim().length < 5) return null;
  try {
    const r = (await Location.geocodeAsync(text))[0];
    return r && valid(r.latitude, r.longitude) ? { lat: r.latitude, lng: r.longitude } : null;
  } catch {
    return null;
  }
}

// ───────────── nuqta → manzil ─────────────

/** Xaritadagi / GPS nuqtaning manzil matni. Topilmasa `null` — matn foydalanuvchida qoladi. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const n = native();
  if (n) {
    try {
      const a = await n.search.geoToAddress({ lat, lon: lng });
      if (a?.formatted) return tidy(a.formatted);
    } catch (e) { markNative(e); }
  }
  try {
    const h = await httpGeocode({ geocode: `${lng},${lat}`, kind: 'house' });
    if (h) return tidy(h.address);
  } catch { /* keyingi manba */ }
  try {
    const g = (await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }))[0];
    if (!g) return null;
    const text = [g.city ?? g.subregion ?? g.region, g.district, g.street, g.streetNumber].filter(Boolean).join(', ');
    return text.length >= 5 ? text : g.formattedAddress ?? null;
  } catch {
    return null;
  }
}

/** "O'zbekiston, Toshkent, ..." — davlat nomi har manzil boshida ortiqcha. */
const tidy = (s: string) => s.replace(/^(O['ʻ‘’]?zbekiston|Uzbekistan|Узбекистан),\s*/i, '').trim();
