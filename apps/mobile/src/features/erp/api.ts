/** Insof ERP hooklari — mobil ilovadagi xodim bo'limlari uchun. */
import { useMutation, keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import { erpApi, erpAuth, type ErpFleetTruck, type ErpTripRoute } from '@/core/erp';
import { config } from '@/core/config';
import { KEYS, secure } from '@/core/storage';
import { ApiException } from '@/core/api';
import { appHeaders, checkUpdateRequired } from '@/core/app-update';
import type { ApiError } from '@insof/shared';
import { usePollInterval } from '@/shared/hooks';

/**
 * Bosh sahifa. `params` — karta filtrlari (masalan `{ revenue: 'week' }`). Filtrsiz chaqiruvlar
 * (sarlavha, "+" tugmasi) ham shu keshni o'qiydi — oldingi ma'lumot turadi, filtr almashganda sakramaydi.
 */
export const useErpHome = (params?: Record<string, string>) =>
  useQuery({
    queryKey: params && Object.keys(params).length ? ['erp', 'home', params] : ['erp', 'home'],
    queryFn: () => erpAuth.home(params),
    refetchInterval: usePollInterval(30_000),
    placeholderData: keepPreviousData,
  });

export const useErpList = (key: string, q?: string, filter?: string) =>
  useQuery({ queryKey: ['erp', 'list', key, q ?? '', filter ?? ''], queryFn: () => erpAuth.list(key, q, filter), enabled: !!key });

/**
 * Kartochka. Reys kartochkasi davriy yangilanadi — reys davomida "Yurilgan yo'l" raqami
 * o'sib boradi va haydovchi ham, logistika ham uni kutmasdan ko'radi. Boshqa kartochkalarda
 * bunga hojat yo'q (schyot yoki xodim ma'lumoti o'z-o'zidan o'zgarmaydi).
 */
export const useErpDetail = (key: string, id: string) =>
  useQuery({
    queryKey: ['erp', 'detail', key, id],
    queryFn: () => erpAuth.detail(key, id),
    enabled: !!key && !!id,
    refetchInterval: usePollInterval(key === 'trips' ? 30_000 : false),
  });

/**
 * Marshrut ekrani.
 *
 * Yo'l mashinaning hozirgi joyidan quriladi, shuning uchun joylashuvni beruvchi funksiya
 * uziladi (`ref` dan o'qiydi): har GPS nuqtasida so'rov qayta tuzilsa, OSRM'ga daqiqada
 * o'nlab murojaat ketardi. 90 soniyada bir yangilanadi.
 *
 * Chiziq KESHDA saqlanadi. Server uni har javobda qaytarmaydi (17 KB geometriya bekorga
 * yurmasin), shuning uchun "qaytarmadim" degan javob kelganda avvalgisini o'rnida
 * qoldiramiz. Aks holda ekrandan chiqib qaytilganda kesh chiziqsiz javobni ko'rsatib,
 * xaritada yo'l umuman chizilmay qolardi.
 */
export const useErpTripRoute = (
  id: string,
  pos: () => { lat: number; lng: number } | null,
  /** `true` — yo'lni qayta qurish kerak (yo'ldan chiqib ketilgan yoki hali chiziq yo'q). */
  wantNewLine: () => boolean,
) => {
  const qc = useQueryClient();
  const key = ['erp', 'trip-route', id];
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const prev = qc.getQueryData<ErpTripRoute>(key);
      const keep = !wantNewLine() && !!prev?.line.length;
      const next = await erpAuth.tripRoute(id, pos() ?? undefined, keep);
      if (next.lineIncluded || !prev?.line.length) return next;
      // Server chiziqni qayta qurmadi — avvalgisi bilan to'ldiramiz
      return { ...next, lineIncluded: true, line: prev.line, routeMeters: prev.routeMeters, routeSeconds: prev.routeSeconds, routeSource: prev.routeSource };
    },
    enabled: !!id,
    refetchInterval: usePollInterval(90_000),
  });
};

/**
 * Bildirishnomalar. Yarim daqiqada bir yangilanadi: push kelmagan bo'lsa ham
 * (ruxsat berilmagan, telefon o'chiq edi) xodim ro'yxatda ko'radi.
 */
export const useErpNotifications = () =>
  useQuery({ queryKey: ['erp', 'notifications'], queryFn: erpAuth.notifications, refetchInterval: usePollInterval(30_000) });

/** Ro'yxat ochilganda hammasi o'qilgan deb belgilanadi. */
export function useErpReadNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => erpAuth.readNotifications(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp', 'notifications'] }),
  });
}

export const useErpForm = (key: string) =>
  useQuery({ queryKey: ['erp', 'form', key], queryFn: () => erpAuth.form(key), enabled: !!key, staleTime: 0 });

/** Yangi hujjat ochish. Muvaffaqiyatda ro'yxat va ko'rsatkichlar yangilanadi. */
export function useErpCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { key: string; payload: Record<string, unknown> }) => erpAuth.create(v.key, v.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp'] }),
  });
}

/** Amal bajarilgach butun ERP keshi yangilanadi — ko'rsatkichlar ham darhol o'zgaradi. */
export function useErpAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { action: string; id: string; payload?: Record<string, unknown> }) => erpAuth.action(v.action, v.id, v.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['erp'] }),
  });
}

// ───────────────────────── Reyslar xaritasi (direktor, logistika, mexanik) ─────────────────────────

/** Xaritadagi reys — `ErpFleetTruck` + yangi server maydonlari (eski server bermasa `undefined`). */
export type ErpFleetItem = ErpFleetTruck & {
  orderId?: string;
  orderNo?: string;
  status?: string;
  qty?: string;
  /** Obyekt nuqtasi — "Navigatorda ochish" uchun. */
  dest?: { lat: number; lng: number } | null;
  /** Nima olib ketyapti — "Beton M300 (B22.5)". */
  product?: string | null;
  /**
   * Ixtiyoriy (server bersa): mashinaning oxirgi ~15 daqiqalik izi, vaqt bo'yicha tartiblangan.
   * Hozirgi ERP `/api/mobile/fleet` bermaydi — kelsa xaritada xira chiziq bo'lib chiziladi.
   */
  trail?: { lat: number; lng: number; at?: string }[] | null;
};
export interface ErpFleetData { at: string; trucks: ErpFleetItem[]; gpsError: string | null }

/** Jonli xarita uchun yangilanish oralig'i — 12 s (talab: 10–15 s). */
export const FLEET_POLL_MS = 12_000;

/**
 * Faol reyslar (`GET /api/mobile/fleet`). Server hali yangilanmagan bo'lsa (404) — bosh sahifadagi
 * `fleet`/`live` dan yig'iladi: ekran baribir ishlaydi, faqat 30 s da yangilanadi.
 */
export const useErpFleet = (enabled = true) => {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['erp', 'fleet'],
    enabled,
    refetchInterval: FLEET_POLL_MS,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<ErpFleetData> => {
      try {
        return await erpApi<ErpFleetData>('/fleet');
      } catch (e) {
        // Eski server: marshrut yo'q — 404 (Next HTML sahifasi JSON emas, shuning uchun SyntaxError ham)
        const missing = (e instanceof ApiException && e.status === 404) || e instanceof SyntaxError;
        if (!missing) throw e;
        const home = await qc.fetchQuery({ queryKey: ['erp', 'home'], queryFn: () => erpAuth.home(), staleTime: 25_000 });
        const trucks: ErpFleetItem[] = home.fleet ?? (home.live ?? []).map((t) => ({
          // Reys id'si topilmagan (ECO) — kartochka ochilmaydi (`ref:` belgisi, `fleet.tsx`)
          tripId: t.tripId ?? `ref:${t.ref}`, ref: t.ref, plate: t.plate, driver: t.driver, driverPhone: null, customer: t.customer, address: '',
          phase: t.status, tone: 'brand', plannedAt: null, delay: null, delayTone: null, openIssues: 0,
          gps: { lat: t.lat, lng: t.lng, at: new Date().toISOString(), etaMin: t.etaMin, km: t.km },
        }));
        return { at: new Date().toISOString(), trucks, gpsError: null };
      }
    },
  });
};

// ───────────────────────── Kunlik hisobot (Excel) ─────────────────────────

/** `YYYY-MM-DD` (mahalliy kun). */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Kunlik hisobotni yuklab oladi (`GET /api/mobile/report/daily?date=`) va kesh papkasidagi fayl manzilini qaytaradi.
 * Token eskirgan bo'lsa avval `/me` orqali yangilanadi (umumiy `erpApi` 401 → refresh qiladi).
 * Server xato qaytarsa (JSON `{code, message}`) — xabari bilan `ApiException`.
 */
export async function downloadDailyReport(date: string): Promise<string> {
  await erpAuth.me();
  const token = await secure.get(KEYS.erpAccess);
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error("Qurilmada fayl saqlash joyi topilmadi");
  const target = `${dir}kunlik-hisobot-${date}.xlsx`;
  // Shu kunning eski fayli qolgan bo'lsa (avvalgi yuklash) — ustiga yozish iOS'da xato beradi
  await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
  const res = await FileSystem.downloadAsync(`${config.erpUrl}/api/mobile/report/daily?date=${encodeURIComponent(date)}`, target, {
    headers: { authorization: `Bearer ${token ?? ''}`, accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json', ...appHeaders() },
  });
  if (res.status !== 200) {
    let message = res.status === 404 ? "Serverda kunlik hisobot hali yo'q — ERP yangilanishi kerak" : 'Hisobot yuklanmadi';
    let code = 'REPORT_FAILED';
    try {
      const j = JSON.parse(await FileSystem.readAsStringAsync(res.uri)) as { code?: string; message?: string };
      if (j.message && res.status !== 404) message = j.message;
      if (j.code) code = j.code;
      checkUpdateRequired(res.status, j);
    } catch { /* JSON emas */ }
    await FileSystem.deleteAsync(res.uri, { idempotent: true }).catch(() => undefined);
    throw new ApiException(res.status, { code, message } as ApiError);
  }
  return res.uri;
}
