import { kv } from '@/core/storage';
import type { ErpRole } from '@/core/erp';
import type { IconName } from '@/design/icons';
import type { ModuleTone } from '@/design/tokens';

/**
 * Menyu katalogi — `/api/mobile/home` → `quick` dagi bo'limlar vebdagi menyu kabi guruhlarga bo'linadi
 * (Sotuv, Moliya, Ishlab chiqarish…) va guruh chiplari bilan ko'rsatiladi; sevimlilar telefonda, rol bo'yicha.
 * Server bo'limga guruh bermaydi — guruh ro'yxat kalitidan olinadi, notanish kalit «Boshqa»ga tushadi.
 */
export type MenuGroup = 'boshqaruv' | 'yangi' | 'sotuv' | 'moliya' | 'ishlab' | 'logistika' | 'sklad' | 'kadr' | 'boshqa';

/** Chiplar tartibi — vebdagi chap menyu tartibi bilan bir xil. */
export const MENU_GROUPS: { key: MenuGroup; label: string }[] = [
  { key: 'boshqaruv', label: 'Boshqaruv' },
  { key: 'sotuv', label: 'Sotuv' },
  { key: 'moliya', label: 'Moliya' },
  { key: 'ishlab', label: 'Ishlab chiqarish' },
  { key: 'logistika', label: 'Logistika' },
  { key: 'sklad', label: "Sklad va ta'minot" },
  { key: 'kadr', label: 'Kadrlar' },
  { key: 'yangi', label: 'Yangi hujjat' },
  { key: 'boshqa', label: 'Boshqa' },
];

const KEYS: Record<Exclude<MenuGroup, 'yangi' | 'boshqa'>, string[]> = {
  boshqaruv: ['approvals', 'activity', 'bi', 'ilova-users', 'byudjet'],
  sotuv: ['orders', 'sales', 'customers', 'leads', 'offers', 'shop', 'invoices', 'realizatsiya', 'real-reestr', 'products', 'recipients', 'smm', 'target', 'marketing'],
  moliya: ['cashflow', 'payments', 'kirim', 'payreq', 'unpaid-receipts', 'kirim-qqs', 'openings', 'ledger', 'oy-yopish', 'loans', 'assets', 'pay-plan', 'expenses', 'arenda-jurnal', 'arenda-shops', 'arenda-debtors', 'arenda-svet'],
  ishlab: ['production', 'recipes', 'tasks', 'brigades', 'prod-report', 'brig-issues', 'brig-shifts', 'brig-days', 'capacity', 'brig-stock'],
  logistika: ['trips', 'drivers', 'vehicles', 'fuel', 'logi-orders', 'logi-day', 'trip-pay', 'waybills', 'deliveries', 'logi-report', 'sites', 'logi-moliya'],
  sklad: ['stock', 'avto-zapchast', 'snabjeniye', 'supply', 'receipts', 'suppliers', 'prixod', 'rasxod', 'ostatki', 'disp-stock'],
  kadr: ['employees', 'tabel', 'ish-haqi', 'jarima-bonus', 'kadr-taqvim', 'oyligim', 'vazifalarim', 'hr-calls', 'emp-debts', 'teams'],
};
const GROUP_OF = new Map<string, MenuGroup>(Object.entries(KEYS).flatMap(([g, keys]) => keys.map((k) => [k, g as MenuGroup] as const)));

/** Ro'yxat kaliti → menyu guruhi. */
export const groupOf = (listKey: string): MenuGroup => GROUP_OF.get(listKey) ?? 'boshqa';

export interface MenuItem {
  /** Sevimlilar shu id bilan saqlanadi: `list:<kalit>`, `new:<kalit>` yoki maxsus (`work`, `ai`, `report`, `fleet`…). */
  id: string;
  label: string;
  sub?: string;
  icon: IconName | string;
  module?: ModuleTone;
  group: MenuGroup;
  badge?: number;
  onPress: () => void;
}

/** Birinchi ochilishda sevimlilar — rolda bori qoladi; keyin foydalanuvchi o'zi qo'shadi / olib tashlaydi. */
const DEFAULT_FAVS = ['work', 'ai', 'report', 'fleet', 'list:cashflow', 'list:orders'];

const favKey = (role: ErpRole) => `erp.menu.fav.${role}`;

export function loadFavs(role: ErpRole): string[] {
  try {
    const raw = kv.getString(favKey(role));
    const v: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : DEFAULT_FAVS;
  } catch {
    return DEFAULT_FAVS;
  }
}

export function saveFavs(role: ErpRole, ids: string[]) {
  kv.set(favKey(role), JSON.stringify(ids));
}

/** Tanlangan chip eslab qolinadi (`fav` — sevimlilar). */
export const loadChip = (): string => kv.getString('erp.menu.chip') ?? 'fav';
export const saveChip = (k: string) => kv.set('erp.menu.chip', k);

/** Qidiruv: katta-kichik harf va apostrof turlari (o', o‘, o`) farq qilmaydi. */
const norm = (s: string) => s.toLowerCase().replace(/[‘’`ʻʼ]/g, "'");
export const matches = (it: MenuItem, q: string) => {
  const n = norm(q.trim());
  return !n || norm(it.label).includes(n) || (!!it.sub && norm(it.sub).includes(n));
};
