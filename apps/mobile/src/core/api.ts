import { ApiError } from '@insof/shared';
import { config } from './config';
import { KEYS, kv, secure } from './storage';
import { useSession } from './session';

export class ApiException extends Error {
  constructor(readonly status: number, readonly body: ApiError) {
    super(body.message);
  }
  get code() { return this.body.code; }
}

/**
 * Tarmoq so'rovi vaqt chegarasi bilan. RN `fetch` o'zi hech qachon voz kechmaydi: yarim ochiq
 * mobil aloqada (tunnel, zaif 2G) so'rov cheksiz osilib qoladi — outbox `flushing` bayrog'i
 * yechilmaydi, refresh va'dasi esa barcha keyingi so'rovlarni ushlab turadi.
 */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 30_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Javob matni JSON bo'lmasa (proksi 502 HTML sahifasi) — SyntaxError emas, `null`. */
export const parseJsonSafe = (text: string): unknown => { if (!text) return null; try { return JSON.parse(text); } catch { return null; } };

/** Refresh rad etildi (token eskirgan/bekor) — faqat shunda chiqariladi. 5xx/502 (deploy) chiqarib yubormaydi. */
export const refreshRejected = (status: number) => status === 400 || status === 401 || status === 403;

let refreshing: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refreshToken = await secure.get(KEYS.refresh);
    if (!refreshToken) return null;
    const r = await fetchWithTimeout(`${config.apiUrl}/v1/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }) }, 15_000);
    if (!r.ok) { if (refreshRejected(r.status)) await useSession.getState().signOut(); return null; }
    const j = (await r.json()) as { accessToken: string; refreshToken: string };
    await secure.set(KEYS.access, j.accessToken);
    await secure.set(KEYS.refresh, j.refreshToken);
    return j.accessToken;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

export interface RequestOpts { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; idempotencyKey?: string; auth?: boolean; query?: Record<string, string | number | undefined> }

/** Barcha so'rovlar shu orqali: Bearer, X-Org-Id (faol tashkilot), Idempotency-Key, 401 → refresh → retry. */
export async function api<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', body, idempotencyKey, auth = true, query } = opts;
  const qs = query ? '?' + Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : '';
  const doFetch = async (token: string | null) => {
    // FormData (fayl yuklash) — content-type'ni fetch o'zi qo'yadi (boundary bilan)
    const form = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers: Record<string, string> = form ? { accept: 'application/json' } : { 'content-type': 'application/json', accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const org = useSession.getState().active?.organization.id;
    if (org) headers['x-org-id'] = org;
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    // Fayl yuklash sekin tarmoqda uzoqroq davom etadi
    return fetchWithTimeout(`${config.apiUrl}/v1${path}${qs}`, { method, headers, body: body === undefined ? undefined : form ? (body as FormData) : JSON.stringify(body) }, form ? 120_000 : 30_000);
  };

  let token = auth ? await secure.get(KEYS.access) : null;
  let res = await doFetch(token);
  if (res.status === 401 && auth) {
    token = await refreshAccess();
    if (token) res = await doFetch(token);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = parseJsonSafe(text);
  if (!res.ok) throw new ApiException(res.status, (json as ApiError | null) ?? { code: 'INTERNAL', message: 'Xato' });
  return json as T;
}

export const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/**
 * Shu telefonning barqaror id'si — push manzili va sessiya shu bo'yicha bog'lanadi.
 * Bir marta yaratiladi va saqlanadi: ilova qayta ochilganda o'zgarmasligi kerak,
 * aks holda har ishga tushishda serverda yangi qurilma paydo bo'lardi.
 */
export function deviceId(): string {
  let id = kv.getString(KEYS.deviceId);
  if (!id) { id = uuid(); kv.set(KEYS.deviceId, id); }
  return id;
}
