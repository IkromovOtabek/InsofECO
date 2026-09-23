import { config } from './config';
import { KEYS, secure } from './storage';
import { ApiException } from './api';
import type { ApiError } from '@insof/shared';
import { useSession } from './session';

/**
 * Insof ERP backend klienti — zavod xodimlari uchun (login + parol).
 *
 * ECO klientidan (`core/api.ts`) ajratilgan: boshqa server, boshqa token, X-Org-Id yo'q.
 * Tokenlar SecureStore'da alohida kalitlarda turadi — ikki tizim bir-birini bosib ketmaydi.
 */
export type ErpRole = 'DIRECTOR' | 'SALES' | 'PRODUCTION' | 'SUPERVISOR' | 'LOGISTICS' | 'WAREHOUSE' | 'PROCUREMENT' | 'ACCOUNTING' | 'FINANCE' | 'HR' | 'CASHIER' | 'DRIVER';
export interface ErpUser { id: string; login: string; fullName: string; role: ErpRole; roleLabel: string }
export interface ErpTokens { accessToken: string; refreshToken: string }

export type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info';
export interface ErpCard { key: string; label: string; value: string; hint?: string; tone?: Tone; icon?: string }
export interface ErpRow { id: string; title: string; subtitle?: string; right?: string; status?: string; tone?: Tone }
/** `target` — qator bosilganda ochiladigan kartochka turi; bo'lmasa qator bosilmaydi. */
export interface ErpSection { title: string; empty: string; rows: ErpRow[]; target?: string }
export interface ErpField { label: string; value: string; tone?: Tone }
export interface ErpFormOption { value: string; label: string; extra?: Record<string, string> }
export interface ErpFormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'time' | 'select' | 'switch' | 'items';
  required?: boolean;
  placeholder?: string;
  value?: string;
  hint?: string;
  options?: ErpFormOption[];
  /** Boshqa maydon shu qiymatda bo'lsagina ko'rinadi. */
  showIf?: { field: string; equals: string };
  /** `items` turi uchun ustunlar. */
  columns?: ErpFormField[];
}
export interface ErpCreateForm { key: string; title: string; submitLabel: string; fields: ErpFormField[] }
/** Amal bajarilgandan keyin ilova nima qilishi — qaror serverda (`lib/mobile/detail.ts`). */
export interface ErpActionEffect {
  /** Fon GPS kuzatuvi: reys yo'lga chiqqanda 'start', yopilganda 'stop'. */
  track?: 'start' | 'stop';
  /** Navigatsiya ilovasini shu nuqtaga ochish. */
  navigate?: { lat: number; lng: number; label: string };
}
export interface ErpAction { id: string; label: string; tone?: 'brand' | 'danger' | 'success' | 'warning'; confirm?: string; form?: ErpFormField[]; effect?: ErpActionEffect }
export interface ErpDetailData { key: string; id: string; title: string; subtitle?: string; status?: string; fields: ErpField[]; sections: ErpSection[]; actions: ErpAction[] }
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
export interface ErpHomeData { role: ErpRole; roleLabel: string; fullName: string; list: { key: string; title: string }; create: { key: string; label: string } | null; quick: ErpQuick[]; cards: ErpCard[]; sections: ErpSection[]; live?: ErpLiveTruck[] }
/** Ro'yxat ustidagi filtr chipi — serverdan keladi (masalan ishlab chiqarish "Zayavkalar"i). */
export interface ErpListFilter { key: string; label: string; count: number; active: boolean }
export interface ErpListData { key: string; title: string; rows: ErpRow[]; filters?: ErpListFilter[] }

let refreshing: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refreshToken = await secure.get(KEYS.erpRefresh);
    if (!refreshToken) return null;
    const r = await fetch(`${config.erpUrl}/api/mobile/auth/refresh`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }),
    });
    if (!r.ok) { await useSession.getState().signOut(); return null; }
    const j = (await r.json()) as ErpTokens;
    await secure.set(KEYS.erpAccess, j.accessToken);
    await secure.set(KEYS.erpRefresh, j.refreshToken);
    return j.accessToken;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

interface ErpOpts { method?: 'GET' | 'POST'; body?: unknown; auth?: boolean; query?: Record<string, string | undefined> }

/** Barcha ERP so'rovlari shu orqali: Bearer, 401 → refresh → qayta urinish. */
export async function erpApi<T>(path: string, opts: ErpOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query } = opts;
  const qs = query
    ? '?' + Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
    : '';
  const doFetch = async (token: string | null) => {
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    return fetch(`${config.erpUrl}/api/mobile${path}${qs}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  };

  let token = auth ? await secure.get(KEYS.erpAccess) : null;
  let res = await doFetch(token);
  if (res.status === 401 && auth) {
    token = await refreshAccess();
    if (token) res = await doFetch(token);
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  // ERP xato kodlari ECO'nikidan boshqa ro'yxat (BAD_CREDENTIALS, FORBIDDEN…) — shakli bir xil,
  // ApiException faqat `code` va `message` ni o'qiydi.
  if (!res.ok) throw new ApiException(res.status, (json as ApiError | null) ?? ({ code: 'INTERNAL', message: 'Xato' } as ApiError));
  return json as T;
}

export const erpAuth = {
  login: (login: string, password: string) =>
    erpApi<ErpTokens & { user: ErpUser }>('/auth/login', { method: 'POST', body: { login, password }, auth: false }),
  me: () => erpApi<ErpUser>('/me'),
  home: () => erpApi<ErpHomeData>('/home'),
  list: (key: string, q?: string, filter?: string) => erpApi<ErpListData>('/list', { query: { key, q, filter } }),
  detail: (key: string, id: string) => erpApi<ErpDetailData>('/detail', { query: { key, id } }),
  /** Kartochkadagi tugma — veb ERP'dagi bilan bir xil amal (audit ham yoziladi). */
  action: (action: string, id: string, payload?: Record<string, unknown>) =>
    erpApi<{ ok: true; message: string }>('/action', { method: 'POST', body: { action, id, payload } }),
  /** Yangi hujjat formasi — maydonlar va dolzarb tanlov ro'yxatlari serverdan. */
  form: (key: string) => erpApi<ErpCreateForm>('/form', { query: { key } }),
  create: (key: string, payload: Record<string, unknown>) =>
    erpApi<{ key: string; id: string; message: string }>('/create', { method: 'POST', body: { key, payload } }),
};
