/**
 * Superadmin API (/v1/admin/*) — tiplar va hooklar.
 *
 * Kirish huquqini SERVER tekshiradi (SuperAdminGuard, har so'rovda bazadan). Ilovadagi `isSuperAdmin`
 * faqat menyu/yo'naltirish uchun: bayroq soxtalashtirilsa ham bu so'rovlar 404 qaytaradi.
 * Kalitlar `['admin', …]` — ular diskka persist qilinmaydi (`app/_layout.tsx`) va bo'limdan chiqilganda tozalanadi.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uuid } from '@/core/api';
import { config } from '@/core/config';

export type Health = 'ok' | 'degraded' | 'down' | 'unknown';
export type EcoRole = 'TADBIRKOR' | 'QURUVCHI' | 'HAYDOVCHI';

export interface Probe { status: Health; latencyMs: number | null; detail?: string }
export interface AdminHealth {
  at: string;
  overall: Health;
  api: Probe & { version: string; commit: string | null; node: string; env: string; startedAt: string; uptimeSec: number; pid: number };
  db: Probe & { migrations?: number };
  redis: Probe & { state?: string };
  queue: { status: Health; name: string; counts?: Record<string, number>; detail?: string };
  erp: Probe & { url: string | null; httpStatus?: number };
  sockets: Probe & { connections: number | null; namespace: string };
  system: {
    hostname: string; platform: string; cpus: number; loadAvg: number[]; osUptimeSec: number;
    memory: { totalMb: number; freeMb: number; rssMb: number; heapUsedMb: number; heapTotalMb: number };
    disk: { totalGb: number; freeGb: number; usedPct: number | null } | null;
  };
  errors: { total: number; lastHour: number; last24h: number; recent: { at: string; method: string; path: string; status: number; message: string }[] };
  clients: { platform: string; appVersion: string; devices: number }[];
  /** Ilovada o'lchangan: so'rov ketib-kelish vaqti, ms */
  rttMs: number;
}

export interface AdminOverview {
  since: string;
  users: { total: number; today: number; blocked: number };
  organizations: { plants: number; contractors: number; blocked: number };
  orders: { today: number; byStatus: Record<string, number> };
  deliveries: { today: number; active: number; slaBreachedToday: number; byStatus: Record<string, number> };
  devices: { active24h: number };
}

export interface AdminOrgRow {
  id: string; name: string; type: 'PLANT' | 'CONTRACTOR'; inn: string | null; address: string | null; externalRef: string | null;
  blockedAt: string | null; blockedReason: string | null; createdAt: string; members: number; orders: number;
}
export interface AdminOrg {
  id: string; name: string; type: 'PLANT' | 'CONTRACTOR'; inn: string | null; address: string | null; externalRef: string | null;
  blockedAt: string | null; blockedReason: string | null; createdAt: string; deletedAt: string | null;
  counts: { ordersAsPlant: number; ordersAsClient: number; vehicles: number; sites: number; ordersToday: number };
  members: { id: string; role: EcoRole; isActive: boolean; createdAt: string; user: { id: string; phone: string; fullName: string | null; blockedAt: string | null; isSuperAdmin: boolean } }[];
  integrations: { id: string; name: string; keyPrefix: string; isActive: boolean; lastUsedAt: string | null; webhookUrl: string | null }[];
}

export interface AdminUserRow {
  id: string; phone: string; fullName: string | null; isSuperAdmin: boolean; blockedAt: string | null; createdAt: string; lastSeenAt: string | null;
  memberships: { role: EcoRole; isActive: boolean; organization: { id: string; name: string } }[];
}
export interface AdminUser {
  id: string; phone: string; fullName: string | null; locale: string; isSuperAdmin: boolean; blockedAt: string | null; blockedReason: string | null;
  tokensValidAfter: string | null; deleteRequestedAt: string | null; deletedAt: string | null; createdAt: string; hasPassword: boolean; activeSessions: number;
  memberships: { id: string; role: EcoRole; isActive: boolean; createdAt: string; organization: { id: string; name: string; type: 'PLANT' | 'CONTRACTOR'; blockedAt: string | null } }[];
  devices: { id: string; platform: string; model: string | null; appVersion: string | null; lastSeenAt: string; push: boolean }[];
}

export interface AppConfigRow { key: string; value: unknown; isPublic: boolean; description: string | null; updatedAt: string; updatedById: string | null }
export interface AuditRow { id: string; action: string; targetType: string | null; targetId: string | null; status: number | null; createdAt: string; actor: { id: string; fullName: string | null; phone: string } }

const POLL = 15_000;

/** Server holati — 15 s da bir; ketib-kelish vaqti ham o'lchanadi (sparkline uchun). */
export const useAdminHealth = () => useQuery({
  queryKey: ['admin', 'health'],
  queryFn: async () => {
    const t = Date.now();
    const h = await api<Omit<AdminHealth, 'rttMs'>>('/admin/health');
    return { ...h, rttMs: Date.now() - t } as AdminHealth;
  },
  refetchInterval: POLL,
  staleTime: 5_000,
  retry: 0,
});

/** ERP serveri — telefondan to'g'ridan-to'g'ri (`config.erpUrl/health`); server tekshiruvidan farq qilsa tarmoq muammosi. */
export const useErpFromDevice = () => useQuery({
  queryKey: ['admin', 'erp-device'],
  queryFn: async () => {
    const t = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(`${config.erpUrl}/health`, { signal: ctrl.signal });
      return { ok: r.status < 500, status: r.status, ms: Date.now() - t };
    } catch {
      return { ok: false, status: 0, ms: null as number | null };
    } finally { clearTimeout(timer); }
  },
  refetchInterval: POLL,
  retry: 0,
});

export const useAdminOverview = () => useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api<AdminOverview>('/admin/overview'), refetchInterval: 60_000 });

export const useAdminOrgs = (p: { q?: string; type?: 'PLANT' | 'CONTRACTOR'; blocked?: boolean }) => useQuery({
  queryKey: ['admin', 'orgs', p],
  queryFn: () => api<{ total: number; rows: AdminOrgRow[] }>('/admin/organizations', { query: { q: p.q, type: p.type, blocked: p.blocked === undefined ? undefined : String(p.blocked), limit: 50 } }),
  refetchInterval: 60_000,
});
export const useAdminOrg = (id: string) => useQuery({ queryKey: ['admin', 'org', id], queryFn: () => api<AdminOrg>(`/admin/organizations/${id}`), enabled: !!id });

export const useAdminUsers = (p: { q?: string; role?: EcoRole; blocked?: boolean }) => useQuery({
  queryKey: ['admin', 'users', p],
  queryFn: () => api<{ total: number; rows: AdminUserRow[] }>('/admin/users', { query: { q: p.q, role: p.role, blocked: p.blocked === undefined ? undefined : String(p.blocked), limit: 50 } }),
  refetchInterval: 60_000,
});
export const useAdminUser = (id: string) => useQuery({ queryKey: ['admin', 'user', id], queryFn: () => api<AdminUser>(`/admin/users/${id}`), enabled: !!id });

export const useAdminConfig = () => useQuery({ queryKey: ['admin', 'config'], queryFn: () => api<AppConfigRow[]>('/admin/config'), refetchInterval: false });
export const useAdminAudit = () => useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api<AuditRow[]>('/admin/audit', { query: { limit: 30 } }), refetchInterval: false });

/** Superadmin amali: POST/PATCH/PUT/DELETE → muvaffaqiyatda `['admin']` ostidagi hammasi yangilanadi. */
export function useAdminAction<V>(build: (v: V) => { path: string; method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: V) => { const r = build(v); return api<unknown>(r.path, { method: r.method ?? 'POST', body: r.body ?? {}, idempotencyKey: uuid() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export const adminApi = {
  broadcast: (b: { title: string; body: string; role?: EcoRole; organizationId?: string; dryRun?: boolean }) =>
    api<{ recipients: number; devices: number; sent: boolean }>('/admin/broadcast', { method: 'POST', body: b, idempotencyKey: uuid() }),
};

// ───── yordamchilar ─────

export const ROLE_LABEL: Record<EcoRole, string> = { TADBIRKOR: 'Tadbirkor', QURUVCHI: 'Mijoz', HAYDOVCHI: 'Haydovchi' };

/** "3 kun 4 soat", "5 soat 12 daq", "40 daq". */
export function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86_400), h = Math.floor((sec % 86_400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d) return `${d} kun ${h} soat`;
  if (h) return `${h} soat ${m} daq`;
  return `${Math.max(m, 0)} daq`;
}

export const HEALTH_LABEL: Record<Health, string> = { ok: 'Ishlayapti', degraded: 'Sekin', down: 'Ishlamayapti', unknown: "Noma'lum" };
export const healthTone = (h: Health) => (h === 'ok' ? 'success' : h === 'degraded' ? 'warning' : h === 'down' ? 'danger' : 'neutral') as 'success' | 'warning' | 'danger' | 'neutral';
