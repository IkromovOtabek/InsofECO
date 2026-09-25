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

let refreshing: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refreshToken = await secure.get(KEYS.refresh);
    if (!refreshToken) return null;
    const r = await fetch(`${config.apiUrl}/v1/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
    if (!r.ok) { await useSession.getState().signOut(); return null; }
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
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const org = useSession.getState().active?.organization.id;
    if (org) headers['x-org-id'] = org;
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    return fetch(`${config.apiUrl}/v1${path}${qs}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  };

  let token = auth ? await secure.get(KEYS.access) : null;
  let res = await doFetch(token);
  if (res.status === 401 && auth) {
    token = await refreshAccess();
    if (token) res = await doFetch(token);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiException(res.status, (json as ApiError) ?? { code: 'INTERNAL', message: 'Xato' });
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
