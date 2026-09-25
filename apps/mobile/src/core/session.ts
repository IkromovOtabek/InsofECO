import { create } from 'zustand';
import { Role } from '@insof/shared';
import { kv, KEYS, secure } from './storage';
import type { ErpUser } from './erp';
import { unregisterPush } from './push';

export interface Membership { role: Role; isActive: boolean; organization: { id: string; name: string; type: 'PLANT' | 'CONTRACTOR' } }
export interface Profile { id: string; phone: string; fullName: string | null; locale: string; memberships: Membership[] }

/**
 * Ilovada ikki xil hisob bor:
 *   'eco' — telefon + parol (Tadbirkor / Quruvchi / Haydovchi), ECO backend'i;
 *   'erp' — login + parol (zavod xodimlari: direktor, sotuv, logistika...), Insof ERP backend'i.
 * Bir vaqtda bittasi faol. `kind` — yo'naltirish va tema shu bo'yicha tanlanadi.
 */
export type SessionKind = 'eco' | 'erp';

interface SessionState {
  status: 'loading' | 'anon' | 'authed';
  kind: SessionKind | null;
  user: Profile | null;
  active: Membership | null;
  erp: ErpUser | null;
  hydrate: () => Promise<void>;
  signIn: (tokens: { accessToken: string; refreshToken: string }, user: Profile) => Promise<void>;
  signInErp: (tokens: { accessToken: string; refreshToken: string }, user: ErpUser) => Promise<void>;
  setUser: (user: Profile) => void;
  setErpUser: (user: ErpUser) => void;
  selectMembership: (m: Membership) => void;
  signOut: () => Promise<void>;
}

const ACTIVE_KEY = 'session.activeMembership';
const KIND_KEY = 'session.kind';
const ERP_USER_KEY = 'session.erpUser';

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  kind: null,
  user: null,
  active: null,
  erp: null,

  async hydrate() {
    const kind = kv.getString(KIND_KEY) as SessionKind | undefined;

    if (kind === 'erp') {
      const refresh = await secure.get(KEYS.erpRefresh);
      const cached = kv.getString(ERP_USER_KEY);
      if (!refresh || !cached) return set({ status: 'anon', kind: null });
      return set({ status: 'authed', kind: 'erp', erp: JSON.parse(cached) as ErpUser });
    }

    const refresh = await secure.get(KEYS.refresh);
    const cachedUser = kv.getString('session.user');
    if (!refresh || !cachedUser) return set({ status: 'anon', kind: null });
    const user = JSON.parse(cachedUser) as Profile;
    const activeRaw = kv.getString(ACTIVE_KEY);
    const active = activeRaw ? (JSON.parse(activeRaw) as Membership) : pickDefault(user);
    set({ status: 'authed', kind: 'eco', user, active });
  },

  async signIn(tokens, user) {
    await secure.set(KEYS.access, tokens.accessToken);
    await secure.set(KEYS.refresh, tokens.refreshToken);
    kv.set(KIND_KEY, 'eco');
    kv.set('session.user', JSON.stringify(user));
    const active = pickDefault(user);
    if (active) kv.set(ACTIVE_KEY, JSON.stringify(active));
    set({ status: 'authed', kind: 'eco', user, active, erp: null });
  },

  async signInErp(tokens, user) {
    await secure.set(KEYS.erpAccess, tokens.accessToken);
    await secure.set(KEYS.erpRefresh, tokens.refreshToken);
    kv.set(KIND_KEY, 'erp');
    kv.set(ERP_USER_KEY, JSON.stringify(user));
    set({ status: 'authed', kind: 'erp', erp: user, user: null, active: null });
  },

  setUser(user) {
    kv.set('session.user', JSON.stringify(user));
    set({ user });
  },

  setErpUser(user) {
    kv.set(ERP_USER_KEY, JSON.stringify(user));
    set({ erp: user });
  },

  selectMembership(m) {
    kv.set(ACTIVE_KEY, JSON.stringify(m));
    set({ active: m });
  },

  async signOut() {
    // Tokenlar o'chishidan OLDIN: shu telefonga endi xabar yuborilmasin, aks holda
    // ishdan ketgan xodimning ekranida zavod xabarlari chiqib turardi.
    await unregisterPush(get().kind === 'erp' ? 'erp' : 'eco');
    await Promise.all([secure.del(KEYS.access), secure.del(KEYS.refresh), secure.del(KEYS.erpAccess), secure.del(KEYS.erpRefresh)]);
    kv.delete('session.user');
    kv.delete(ACTIVE_KEY);
    kv.delete(KIND_KEY);
    kv.delete(ERP_USER_KEY);
    set({ status: 'anon', kind: null, user: null, active: null, erp: null });
  },
}));

/** Bitta a'zolik bo'lsa avtomatik; ko'p bo'lsa null → rol tanlash ekrani. */
function pickDefault(user: Profile): Membership | null {
  const active = user.memberships.filter((m) => m.isActive);
  return active.length === 1 ? active[0]! : null;
}

export const useRole = () => useSession((s) => s.active?.role ?? null);
export const useErpRole = () => useSession((s) => s.erp?.role ?? null);
/** Ekranlarda ko'rsatiladigan ism — qaysi tizimda bo'lishidan qat'i nazar. */
export const useDisplayName = () => useSession((s) => (s.kind === 'erp' ? s.erp?.fullName : s.user?.fullName) ?? null);
