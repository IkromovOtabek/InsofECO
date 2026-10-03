import { create } from 'zustand';
import { Role } from '@insof/shared';
import { kv, KEYS, secure } from './storage';
import type { ErpUser } from './erp';
import { unregisterPush } from './push';

export interface Membership { role: Role; isActive: boolean; organization: { id: string; name: string; type: 'PLANT' | 'CONTRACTOR' } }
export interface Profile { id: string; phone: string; fullName: string | null; locale: string; /** `/v1/avatars/<fayl>` — `avatarUri()` bilan to'liq manzilga aylanadi */ avatarUrl?: string | null; memberships: Membership[]; /** Haydovchi hisobni o'chirishni so'ragan — direktor tasdig'i kutilmoqda */ deleteRequestedAt?: string | null;
  /** Platforma superadmini (server /me dan). Faqat UX uchun: /admin/* ni server har so'rovda o'zi tekshiradi. */ isSuperAdmin?: boolean }

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
  /** Superadmin bo'limi tanlangan (faqat `user.isSuperAdmin` bo'lsa). Bunda `active` = null — X-Org-Id yuborilmaydi. */
  admin: boolean;
  hydrate: () => Promise<void>;
  signIn: (tokens: { accessToken: string; refreshToken: string }, user: Profile) => Promise<void>;
  signInErp: (tokens: { accessToken: string; refreshToken: string }, user: ErpUser) => Promise<void>;
  setUser: (user: Profile) => void;
  setErpUser: (user: ErpUser) => void;
  selectMembership: (m: Membership) => void;
  /** Superadmin bo'limiga o'tish (rol tanlash / tezkor almashtirish). */
  selectAdmin: () => void;
  /** Superadmin bo'limidan chiqish — rol tanlash ekraniga. */
  exitAdmin: () => void;
  signOut: () => Promise<void>;
}

/** signOut ichidan yana signOut chaqirilsa (refresh xatosi) — ikkinchisi darhol qaytadi. */
let signingOut = false;

const ACTIVE_KEY = 'session.activeMembership';
const KIND_KEY = 'session.kind';
const ERP_USER_KEY = 'session.erpUser';
const ADMIN_KEY = 'session.admin';

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  kind: null,
  user: null,
  active: null,
  erp: null,
  admin: false,

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
    const admin = !!user.isSuperAdmin && kv.getString(ADMIN_KEY) === '1';
    const activeRaw = admin ? undefined : kv.getString(ACTIVE_KEY);
    const active = admin ? null : activeRaw ? (JSON.parse(activeRaw) as Membership) : pickDefault(user);
    set({ status: 'authed', kind: 'eco', user, active, admin });
  },

  async signIn(tokens, user) {
    await secure.set(KEYS.access, tokens.accessToken);
    await secure.set(KEYS.refresh, tokens.refreshToken);
    kv.set(KIND_KEY, 'eco');
    kv.set('session.user', JSON.stringify(user));
    // Faol a'zoligi yo'q superadmin — to'g'ridan-to'g'ri o'z bo'limiga; a'zoligi bor bo'lsa tanlaydi
    const admin = !!user.isSuperAdmin && !user.memberships.some((m) => m.isActive);
    const active = admin ? null : pickDefault(user);
    if (active) kv.set(ACTIVE_KEY, JSON.stringify(active));
    if (admin) kv.set(ADMIN_KEY, '1'); else kv.delete(ADMIN_KEY);
    set({ status: 'authed', kind: 'eco', user, active, erp: null, admin });
  },

  async signInErp(tokens, user) {
    await secure.set(KEYS.erpAccess, tokens.accessToken);
    await secure.set(KEYS.erpRefresh, tokens.refreshToken);
    kv.set(KIND_KEY, 'erp');
    kv.set(ERP_USER_KEY, JSON.stringify(user));
    kv.delete(ADMIN_KEY);
    set({ status: 'authed', kind: 'erp', erp: user, user: null, active: null, admin: false });
  },

  setUser(user) {
    kv.set('session.user', JSON.stringify(user));
    // Server huquqni olib qo'ygan bo'lsa — bo'lim darhol yopiladi (Gate rol tanlashga o'tkazadi)
    if (!user.isSuperAdmin && get().admin) { kv.delete(ADMIN_KEY); set({ user, admin: false }); return; }
    set({ user });
  },

  setErpUser(user) {
    kv.set(ERP_USER_KEY, JSON.stringify(user));
    set({ erp: user });
  },

  selectMembership(m) {
    kv.set(ACTIVE_KEY, JSON.stringify(m));
    kv.delete(ADMIN_KEY);
    set({ active: m, admin: false });
  },

  selectAdmin() {
    if (!get().user?.isSuperAdmin) return;
    kv.set(ADMIN_KEY, '1');
    kv.delete(ACTIVE_KEY);
    set({ admin: true, active: null });
  },

  exitAdmin() {
    kv.delete(ADMIN_KEY);
    set({ admin: false, active: null });
  },

  async signOut() {
    // Qayta kirish qulfi: push'ni o'chirish so'rovi 401 olsa refresh ishlaydi, refresh
    // muvaffaqiyatsiz bo'lsa yana signOut() chaqiriladi — qulfsiz ikkalasi bir-birini
    // kutib qolardi va "Chiqish" tugmasi hech narsa qilmasdi.
    if (signingOut) return;
    signingOut = true;
    try {
      // Tokenlar o'chishidan OLDIN: shu telefonga endi xabar yuborilmasin, aks holda
      // ishdan ketgan xodimning ekranida zavod xabarlari chiqib turardi. Server javob
      // bermasa ham chiqish kutib qolmaydi (3 s).
      await Promise.race([unregisterPush(get().kind === 'erp' ? 'erp' : 'eco'), new Promise<void>((r) => setTimeout(r, 3000))]);
      await Promise.all([secure.del(KEYS.access), secure.del(KEYS.refresh), secure.del(KEYS.erpAccess), secure.del(KEYS.erpRefresh)]);
      kv.delete('session.user');
      kv.delete(ACTIVE_KEY);
      kv.delete(KIND_KEY);
      kv.delete(ERP_USER_KEY);
      kv.delete(ADMIN_KEY);
      set({ status: 'anon', kind: null, user: null, active: null, erp: null, admin: false });
    } finally {
      signingOut = false;
    }
  },
}));

/** Bitta a'zolik bo'lsa avtomatik; ko'p bo'lsa null → rol tanlash ekrani. Superadmin har doim tanlaydi (rol yoki "Superadmin"). */
function pickDefault(user: Profile): Membership | null {
  if (user.isSuperAdmin) return null;
  const active = user.memberships.filter((m) => m.isActive);
  return active.length === 1 ? active[0]! : null;
}

export const useRole = () => useSession((s) => s.active?.role ?? null);
export const useErpRole = () => useSession((s) => s.erp?.role ?? null);
/** Ekranlarda ko'rsatiladigan ism — qaysi tizimda bo'lishidan qat'i nazar. */
export const useDisplayName = () => useSession((s) => (s.kind === 'erp' ? s.erp?.fullName : s.user?.fullName) ?? null);
