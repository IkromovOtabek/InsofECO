import { config } from './config';
import { KEYS, secure } from './storage';
import { ApiException, deviceId, fetchWithTimeout, parseJsonSafe, refreshRejected } from './api';
import type { ApiError } from '@insof/shared';
import { useSession } from './session';
import { appHeaders, checkUpdateRequired } from './app-update';

/**
 * Insof ERP backend klienti — zavod xodimlari uchun (login + parol).
 *
 * ECO klientidan (`core/api.ts`) ajratilgan: boshqa server, boshqa token, X-Org-Id yo'q.
 * Tokenlar SecureStore'da alohida kalitlarda turadi — ikki tizim bir-birini bosib ketmaydi.
 */
export type ErpRole = 'DIRECTOR' | 'SALES' | 'PRODUCTION' | 'SUPERVISOR' | 'LOGISTICS' | 'WAREHOUSE' | 'PROCUREMENT' | 'ACCOUNTING' | 'FINANCE' | 'HR' | 'CASHIER' | 'MECHANIC' | 'DRIVER' | 'BRIGADIER';
export interface ErpUser { id: string; login: string; fullName: string; role: ErpRole; roleLabel: string }
export interface ErpTokens { accessToken: string; refreshToken: string }

export type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info';

/** Muhim amal cheki (masalan zayavka qabul qilindi) — server tayyorlaydi, ilova katta modalda chizadi. */
export interface Receipt {
  headline: string;
  caption?: string;
  /** `danger` — pul chiqib ketgan hujjat (chiqim, xarid): qizil plashka. */
  status: { label: string; tone: 'success' | 'warning' | 'danger'; at: string };
  rows: { label: string; value: string; copy?: boolean }[];
}
/** Karta filtri (davr) — bosilganda bosh sahifa `?<filterParam>=<key>` bilan qayta so'raladi. */
export interface ErpCardFilter { key: string; label: string; active: boolean }
export interface ErpCard { key: string; label: string; value: string; hint?: string; tone?: Tone; icon?: string; filterParam?: string; filters?: ErpCardFilter[]; /** Kalendardan tanlangan oraliq (YYYY-MM-DD) */ range?: { from: string; to: string } | null;
  /** Bosilganda: `id` bilan — batafsil kartochka (`/erp/<key>/<id>`), `id` siz — ro'yxat (`/erp/list/<key>`). */
  open?: { key: string; id?: string } }
/** `open` — bosilganda ochiladigan ro'yxat (bo'limda `target` bo'lmaganda, masalan direktorning "Bugun nima qilish kerak"i). */
export interface ErpRow { id: string; title: string; subtitle?: string; right?: string; status?: string; tone?: Tone; open?: string }
/** `target` — qator bosilganda ochiladigan kartochka turi; bo'lmasa qator bosilmaydi.
 * `icon` — `target` yo'q bo'limlar uchun ma'noli belgi (server beradi; bo'lmasa doira). */
/** Bo'lim diagrammasi — server beradi (`lib/mobile/home.ts` SectionChart). */
export type ErpSectionChart =
  | { kind: 'progress'; items: { label: string; pct: number | null; fact: string; plan: string | null; tone: Tone; invert?: boolean; open?: string }[] }
  | { kind: 'columns'; series: { key: string; label: string; tone: Tone }[]; groups: { label: string; values: number[]; texts: string[] }[] }
  /** Davr savatlari (soat / kun / hafta / oy) bo'yicha ustunlar — rol dashboardi (`lib/mobile/dashboard.ts`). */
  | { kind: 'bars'; series: { key: string; label: string }[]; points: { label: string; values: number[]; texts: string[] }[]; total?: string }
  /** Ulushlar halqasi — eng katta 4 ta + "Boshqa", markazda jami. */
  | { kind: 'donut'; items: { label: string; value: number; text: string }[]; total: string; totalLabel?: string };
export interface ErpSection { title: string; empty: string; rows: ErpRow[]; target?: string; icon?: string; chart?: ErpSectionChart }
export interface ErpField { label: string; value: string; tone?: Tone }
export interface ErpFormOption { value: string; label: string; extra?: Record<string, string> }
export interface ErpFormField {
  name: string;
  label: string;
  /** `photo` — kamera/galereya; qiymati `data:image/jpeg;base64,...` bo'lib serverga ketadi. */
  type: 'text' | 'number' | 'date' | 'time' | 'select' | 'switch' | 'items' | 'photo';
  required?: boolean;
  placeholder?: string;
  value?: string;
  hint?: string;
  options?: ErpFormOption[];
  /** Boshqa maydon shu qiymatda bo'lsagina ko'rinadi. */
  showIf?: { field: string; equals: string };
  /** `photo` uchun: old/orqa kamera va faqat jonli kadr (galereya yo'q) — yuz bilan davomat shunday. */
  camera?: 'front' | 'back';
  cameraOnly?: boolean;
  /** `items` turi uchun ustunlar. */
  columns?: ErpFormField[];
  /** `date` maydoni uchun — 10 kunlik kunlik yuklama (veb "ish tartibi" bilan bir xil hisob). */
  cells?: ErpDayCell[];
}
/** Bitta kun — sana tanlovida kunlik quvvat rangi va hajmi. */
export interface ErpDayCell { key: string; label: string; weekday: string; m3: number; pct: number; count: number; isToday: boolean }
export interface ErpCreateForm { key: string; title: string; submitLabel: string; fields: ErpFormField[] }
/** Amal bajarilgandan keyin ilova nima qilishi — qaror serverda (`lib/mobile/detail.ts`). */
export interface ErpActionEffect {
  /** Fon GPS kuzatuvi: reys yo'lga chiqqanda 'start', yopilganda 'stop'. */
  track?: 'start' | 'stop';
  /** Ilova ichidagi marshrut ekrani (xarita, tezlik, qolgan masofa) — tashqi navigator o'rniga. */
  route?: boolean;
  /** Navigatsiya ilovasini shu nuqtaga ochish. `route` bo'lsa e'tiborga olinmaydi. */
  navigate?: { lat: number; lng: number; label: string };
}
export interface ErpAction {
  id: string;
  label: string;
  tone?: 'brand' | 'danger' | 'success' | 'warning';
  confirm?: string;
  form?: ErpFormField[];
  effect?: ErpActionEffect;
  /** Tugma ko'rinadi, lekin bosilmaydi; nega — `hint` da. */
  disabled?: boolean;
  hint?: string;
  /** Serverga so'rov yubormaydi — faqat `effect` bajariladi. */
  local?: boolean;
}
/**
 * Marshrut ekrani uchun ma'lumot (`/api/mobile/trip-route`).
 * `line` — xaritadagi yo'l; qolgan masofa shu chiziq bo'ylab ilovaning o'zida hisoblanadi,
 * shuning uchun aloqasiz joyda ham raqamlar yangilanib turadi.
 */
export interface ErpLatLng { lat: number; lng: number }
export interface ErpTripRoute {
  tripId: string;
  ref: string;
  status: string;
  customer: string;
  address: string;
  destination: ErpLatLng | null;
  origin: ErpLatLng | null;
  /** Chiziq shu javobda bormi. `false` — ilova o'zidagini saqlab qoladi (qayta qurilmadi). */
  lineIncluded: boolean;
  line: ErpLatLng[];
  routeMeters: number;
  routeSeconds: number;
  routeSource: 'ROUTE' | 'LINE';
  traveledMeters: number;
  traveledMinutes: number;
  arriveWithinM: number;
  canDeliver: boolean;
  deliverHint: string | null;
  /** "Yetkazdim" so'raydigan maydonlar — kartochkadagi bilan bitta ro'yxat (serverdan). */
  deliverForm: ErpFormField[];
}
/** `receipt` — pul hujjati (kirim-chiqim, to'lov, schyot, xarid): sarlavha va maydonlar o'rniga chek kartasi chiziladi. */
export interface ErpDetailData { key: string; id: string; title: string; subtitle?: string; status?: string; fields: ErpField[]; sections: ErpSection[]; actions: ErpAction[]; receipt?: Receipt }
/** Ilovadagi bildirishnoma. `link` — bosilganda ochiladigan kartochka. */
export interface ErpNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: { key: string; id: string } | null;
  readAt: string | null;
  createdAt: string;
}

export interface ErpQuick { key: string; label: string; icon: string; kind: 'list' | 'new' }
/** Yo'ldagi mashina — bosh ekrandagi xaritada bitta belgi. `km` — reys boshidan beri yurilgan yo'l. */
export interface ErpLiveTruck {
  ref: string;
  /** ERP reys kartochkasi uchun id; null bo'lsa qator bosilmaydi. */
  tripId: string | null;
  lat: number;
  lng: number;
  plate: string;
  driver: string;
  customer: string;
  status: string;
  km: number;
  etaMin: number | null;
}
/**
 * Logistika xaritasidagi reys — barcha faol reyslar, GPS'i yo'qlari ham (`gps: null`).
 * Server tayyor matn beradi (bosqich, kechikish, reja soati); ilova faqat chizadi.
 */
export interface ErpFleetTruck {
  tripId: string;
  ref: string;
  plate: string;
  driver: string;
  driverPhone: string | null;
  customer: string;
  address: string;
  phase: string;
  tone: 'brand' | 'success' | 'warning' | 'danger' | 'info';
  plannedAt: string | null;
  delay: string | null;
  delayTone: 'brand' | 'success' | 'warning' | 'danger' | 'info' | null;
  openIssues: number;
  gps: { lat: number; lng: number; at: string; etaMin: number | null; km: number | null } | null;
}
export interface ErpHomeData { role: ErpRole; roleLabel: string; fullName: string; list: { key: string; title: string }; create: { key: string; label: string } | null; quick: ErpQuick[]; cards: ErpCard[]; sections: ErpSection[]; live?: ErpLiveTruck[]; fleet?: ErpFleetTruck[];
  /** Xodimning o'z davomati (bosh sahifa "Keldim / Ketdim" kartasi). Login xodimga bog'lanmagan — null. */
  selfAttendance?: ErpSelfAttendance | null;
  /** Rahbar: boshqalarning davomati kartochkasi (`/erp/<key>/<id>`). */
  attendanceManage?: { title: string; subtitle: string; key: string; id: string } | null }

/** Xodimning bugungi davomati — server `lib/self-attendance.ts` (`SelfAttendance`) bilan bir xil. */
export interface ErpSelfAttendance {
  linked: boolean;
  date: string;
  state: 'none' | 'in' | 'out' | 'other';
  /** "Bugun: kelmadingiz", "Keldingiz 08:12", "Ketdingiz 18:05". */
  label: string;
  hint: string | null;
  checkIn: string | null;
  checkOut: string | null;
  lateMin: number | null;
  next: 'in' | 'out' | null;
  shift: { start: string; end: string };
  workplace: { lat: number; lng: number; radiusM: number } | null;
}
export interface ErpSelfMarkBody {
  kind: 'in' | 'out'; lat: number; lng: number; accuracy: number | null;
  /** Yuz skaneri kadri — `data:image/jpeg;base64,...` (server profil surati bilan solishtiradi). */
  photo: string; deviceId: string; at: string; mocked: boolean;
}
export interface ErpSelfMarkResult { ok: true; already: boolean; message: string; attendance: ErpSelfAttendance }
export interface ErpMyAttendanceDay {
  date: string; day: number; weekday: string; weekend: boolean;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'SICK' | 'DAYOFF' | null; mark: string | null;
  checkIn: string | null; checkOut: string | null; minutes: number | null; lateMin: number | null; self: boolean;
}
export interface ErpMyAttendance {
  today: ErpSelfAttendance;
  month: {
    month: string; title: string; prev: string; next: string | null;
    employee: { fullName: string; position: string };
    shift: { start: string; end: string };
    totals: { present: number; absent: number; sick: number; leave: number; dayoff: number; minutes: number; lateDays: number; lateMinutes: number };
    days: ErpMyAttendanceDay[];
  };
}
/** Ro'yxat ustidagi filtr chipi — serverdan keladi (masalan ishlab chiqarish "Zayavkalar"i). */
export interface ErpListFilter { key: string; label: string; count: number; active: boolean }
export interface ErpListData { key: string; title: string; rows: ErpRow[]; filters?: ErpListFilter[] }

/** AI yordamchi (`/api/mobile/ai`) — vebdagi "Tahlil → AI" bilan bitta miya. */
export interface ErpAiAnswer { key: string; text: string; bullets?: string[]; href?: { label: string; href: string } }
export interface ErpAiReply { answer: ErpAiAnswer; level: 0 | 2; model?: string; period: string }
export interface ErpAiCatalog { llm: boolean; groups: { label: string; questions: { key: string; text: string }[] }[] }
export interface ErpAiTurn { role: 'user' | 'assistant'; text: string }

let refreshing: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refreshToken = await secure.get(KEYS.erpRefresh);
    if (!refreshToken) return null;
    const r = await fetchWithTimeout(`${config.erpUrl}/api/mobile/auth/refresh`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...appHeaders() }, body: JSON.stringify({ refreshToken }),
    }, 15_000);
    if (r.status === 426) { checkUpdateRequired(426, parseJsonSafe(await r.text())); return null; }
    if (!r.ok) { if (refreshRejected(r.status)) await useSession.getState().signOut(); return null; }
    const j = (await r.json()) as ErpTokens;
    await secure.set(KEYS.erpAccess, j.accessToken);
    await secure.set(KEYS.erpRefresh, j.refreshToken);
    return j.accessToken;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

interface ErpOpts { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; auth?: boolean; query?: Record<string, string | undefined> }

/** Barcha ERP so'rovlari shu orqali: Bearer, 401 → refresh → qayta urinish. */
export async function erpApi<T>(path: string, opts: ErpOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query } = opts;
  const qs = query
    ? '?' + Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
    : '';
  const doFetch = async (token: string | null) => {
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json', ...appHeaders() };
    if (token) headers.authorization = `Bearer ${token}`;
    // Rasm (base64) yuboriladigan formalar uchun chegara kengroq
    return fetchWithTimeout(`${config.erpUrl}/api/mobile${path}${qs}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, 60_000);
  };

  let token = auth ? await secure.get(KEYS.erpAccess) : null;
  let res = await doFetch(token);
  if (res.status === 401 && auth) {
    token = await refreshAccess();
    if (token) res = await doFetch(token);
  }
  const text = await res.text();
  const json = parseJsonSafe(text);
  // ERP xato kodlari ECO'nikidan boshqa ro'yxat (BAD_CREDENTIALS, FORBIDDEN…) — shakli bir xil,
  // ApiException faqat `code` va `message` ni o'qiydi.
  if (!res.ok) {
    checkUpdateRequired(res.status, json);
    throw new ApiException(res.status, (json as ApiError | null) ?? ({ code: 'INTERNAL', message: 'Xato' } as ApiError));
  }
  return json as T;
}

export const erpAuth = {
  login: (login: string, password: string) =>
    erpApi<ErpTokens & { user: ErpUser }>('/auth/login', { method: 'POST', body: { login, password }, auth: false }),
  me: () => erpApi<ErpUser>('/me'),
  /** Shu qurilmaning access/refresh tokenlarini serverda bekor qiladi (boshqa qurilmalar chiqarilmaydi). */
  logout: async () => erpApi<{ ok: true }>('/auth/logout', { method: 'POST', body: { refreshToken: (await secure.get(KEYS.erpRefresh)) ?? undefined, deviceId: deviceId() } }),
  home: (params?: Record<string, string>) => erpApi<ErpHomeData>('/home', { query: params }),
  list: (key: string, q?: string, filter?: string) => erpApi<ErpListData>('/list', { query: { key, q, filter } }),
  detail: (key: string, id: string) => erpApi<ErpDetailData>('/detail', { query: { key, id } }),
  /**
   * Marshrut ekrani. Mashinaning hozirgi joyi berilsa — yo'l o'sha yerdan quriladi.
   * `keepLine` — yo'l ilovada bor, qayta qurilmasin (faqat ko'rsatkichlar kerak).
   */
  tripRoute: (id: string, pos?: { lat: number; lng: number }, keepLine?: boolean) =>
    erpApi<ErpTripRoute>('/trip-route', {
      query: { id, lat: pos ? String(pos.lat) : undefined, lng: pos ? String(pos.lng) : undefined, line: keepLine ? 'skip' : undefined },
    }),
  /** Kartochkadagi tugma — veb ERP'dagi bilan bir xil amal (audit ham yoziladi). */
  action: (action: string, id: string, payload?: Record<string, unknown>) =>
    erpApi<{ ok: true; message: string; receipt?: Receipt }>('/action', { method: 'POST', body: { action, id, payload } }),
  /** Bildirishnomalar ro'yxati va o'qilmaganlar soni. */
  notifications: () => erpApi<{ unread: number; rows: ErpNotification[] }>('/notifications'),
  /** O'qilgan deb belgilash. `ids` berilmasa — hammasi (ro'yxat ochilganda). */
  readNotifications: (ids?: string[]) =>
    erpApi<{ ok: true; unread: number }>('/notifications', { method: 'POST', body: { ids } }),
  /** Yangi hujjat formasi — maydonlar va dolzarb tanlov ro'yxatlari serverdan. */
  form: (key: string) => erpApi<ErpCreateForm>('/form', { query: { key } }),
  create: (key: string, payload: Record<string, unknown>) =>
    erpApi<{ key: string; id: string; message: string }>('/create', { method: 'POST', body: { key, payload } }),
  /** Hisobni o'chirish so'rovi (do'kon talabi): xodim hisobini direktor bergan — so'rov unga tushadi, u tasdiqlaydi. */
  deletionStatus: () => erpApi<{ pending: boolean; requestedAt: string | null }>('/account'),
  requestDeletion: (note?: string) => erpApi<{ status: 'requested'; requestId: string }>('/account', { method: 'POST', body: { note } }),
  cancelDeletion: () => erpApi<{ ok: true }>('/account', { method: 'DELETE' }),
  /** AI yordamchi: tayyor savollar katalogi va savol berish. */
  aiCatalog: () => erpApi<ErpAiCatalog>('/ai'),
  aiQuick: (key: string) => erpApi<ErpAiReply>('/ai', { method: 'POST', body: { mode: 'quick', key } }),
  aiAsk: (question: string, history: ErpAiTurn[]) => erpApi<ErpAiReply>('/ai', { method: 'POST', body: { mode: 'chat', question, history } }),
  /** "Mening davomatim": bugungi holat va oy (`YYYY-MM`, berilmasa — joriy). Faqat o'ziniki. */
  myAttendance: (month?: string) => erpApi<ErpMyAttendance>('/attendance/self', { query: { month } }),
  /** "Keldim" / "Ketdim" — GPS va ilova ichidagi yuz skaneridan keyin. Geofence va takror tekshiruvi serverda. */
  markSelf: (body: ErpSelfMarkBody) => erpApi<ErpSelfMarkResult>('/attendance/self', { method: 'POST', body }),
};
