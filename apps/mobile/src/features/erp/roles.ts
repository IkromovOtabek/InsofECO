import type { ErpRole } from '@/core/erp';
import type { IconName } from '@/design/icons';

/**
 * Har bir ERP roli — ilovadagi o'z bo'limi (alohida route guruhi, o'z tablari, o'z rangi).
 * Yangi rol qo'shilsa: shu jadvalga qator + `app/(erp-<kalit>)/` papkasi.
 */
export interface ErpRoleConfig {
  /** expo-router guruhi — `app/(erp-...)` papkasi nomi. */
  group: string;
  label: string;
  /** Birinchi tab. */
  homeTitle: string;
  homeIcon: IconName;
  /** Ikkinchi tab — rolning ishchi ro'yxati (`/api/mobile/list?key=...`). */
  listKey: string;
  workTitle: string;
  workIcon: IconName;
  /** Pastki panelda "AI yordamchi" tabi — `app/(erp-<kalit>)/ai.tsx` fayli ham bo'lishi shart. */
  ai?: boolean;
  /**
   * Pastki panel — `docs/redesign/roles/<ROLE>.json` dagi `tabs` (yorliq, ikonka, tartib) 1:1.
   * `route` — `app/(erp-<kalit>)/<route>.tsx` fayli; `screen` — u nimani ko'rsatadi.
   */
  tabs: ErpTabSpec[];
}

/** Tab ekrani: bosh sahifa, ishchi ro'yxat, boshqa ERP ro'yxati, bo'limlar menyusi, AI, xabarlar, xarita, yo'l, profil. */
export type ErpTabScreen =
  | { kind: 'home' }
  | { kind: 'work' }
  /** Boshqa ro'yxat (`/api/mobile/list?key=`). Rolga ochiq bo'lmasa — "Bo'limlar" menyusi ko'rinadi. */
  | { kind: 'list'; key: string }
  | { kind: 'sections' }
  | { kind: 'ai' }
  | { kind: 'notifications' }
  | { kind: 'map' }
  | { kind: 'road' }
  | { kind: 'menu' };

export interface ErpTabSpec { route: string; title: string; icon: IconName; screen: ErpTabScreen }

const HOME = (title: string): ErpTabSpec => ({ route: 'index', title, icon: 'house', screen: { kind: 'home' } });
const WORK = (title: string, icon: IconName): ErpTabSpec => ({ route: 'work', title, icon, screen: { kind: 'work' } });
const LIST = (route: string, title: string, icon: IconName, key: string): ErpTabSpec => ({ route, title, icon, screen: { kind: 'list', key } });
const MENU = (icon: IconName = 'list'): ErpTabSpec => ({ route: 'menu', title: 'Menyu', icon, screen: { kind: 'menu' } });

/** Oxirgi tab — profil va bo'limlar menyusi (spekdagi "Menyu"). */
export const MENU_TAB = { title: 'Menyu', icon: 'list' } as const;
/** Direktorning AI tabi. */
export const AI_TAB = { title: 'AI', icon: 'message-circle' } as const;

export const ERP_ROLES: Record<ErpRole, ErpRoleConfig> = {
  // Tab yorliqlari va ikonkalar — `docs/redesign/roles/<ROLE>.json` dagi `tabs` (mavjud ekranlarga mos keladiganlari)
  // Ikkinchi tab — direktor qarorini kutayotganlar (bloklangan zayavka, ta'minot tasdig'i/to'lovi); zayavkalar "Bo'limlar"da
  DIRECTOR:    { group: '(erp-director)',    label: 'Direktor',         homeTitle: 'Asosiy',    homeIcon: 'house', listKey: 'approvals',  workTitle: 'Tasdiqlar',  workIcon: 'circle-check', ai: true , tabs: [HOME('Asosiy'), WORK('Tasdiqlar', 'check'), { route: 'sections', title: "Bo'limlar", icon: 'layers', screen: { kind: 'sections' } }, { route: 'ai', title: 'AI', icon: 'message-circle', screen: { kind: 'ai' } }, MENU()] },
  SALES:       { group: '(erp-sales)',       label: 'Sotuv',            homeTitle: 'Bugun',     homeIcon: 'house', listKey: 'orders',     workTitle: 'Zayavka',    workIcon: 'file-text' , tabs: [HOME('Bugun'), WORK('Zayavka', 'file-text'), LIST('customers', 'Mijozlar', 'users', 'customers'), LIST('nasiya', 'Nasiya', 'wallet', 'invoices'), MENU()] },
  PRODUCTION:  { group: '(erp-production)',  label: 'Ishlab chiqarish', homeTitle: 'Sex',       homeIcon: 'house', listKey: 'production', workTitle: 'Zameslar',   workIcon: 'package' , tabs: [HOME('Sex'), WORK('Zameslar', 'package'), LIST('tasks', 'Topshiriq', 'clipboard-list', 'tasks'), { route: 'xabarlar', title: 'Xabarlar', icon: 'bell', screen: { kind: 'notifications' } }, MENU()] },
  SUPERVISOR:  { group: '(erp-supervisor)',  label: 'Ish boshqaruvchi', homeTitle: 'Ishlar',    homeIcon: 'house', listKey: 'tasks',      workTitle: 'Topshiriq',  workIcon: 'clipboard-list' , tabs: [HOME('Ishlar'), WORK('Topshiriq', 'clipboard-list'), LIST('brigades', 'Brigada', 'hard-hat', 'brigades'), LIST('issues', 'Muammolar', 'triangle-alert', 'brig-issues'), MENU()] },
  LOGISTICS:   { group: '(erp-logistics)',   label: 'Logistika',        homeTitle: 'Asosiy',    homeIcon: 'house', listKey: 'trips',      workTitle: 'Reyslar',    workIcon: 'truck' , tabs: [HOME('Asosiy'), { route: 'xarita', title: 'Xarita', icon: 'map', screen: { kind: 'map' } }, WORK('Reyslar', 'truck'), { route: 'xabarlar', title: 'Xabarlar', icon: 'message-circle', screen: { kind: 'notifications' } }, MENU('user')] },
  WAREHOUSE:   { group: '(erp-warehouse)',   label: 'Sklad',            homeTitle: 'Ombor',     homeIcon: 'house', listKey: 'stock',      workTitle: 'Xomashyo',   workIcon: 'layers' , tabs: [HOME('Ombor'), WORK('Xomashyo', 'layers'), LIST('tayyor', 'Tayyor', 'package', 'production'), LIST('harakat', 'Harakat', 'route', 'receipts'), MENU()] },
  PROCUREMENT: { group: '(erp-procurement)', label: 'Snabjeniye',       homeTitle: 'Xaridlar',  homeIcon: 'house', listKey: 'receipts',   workTitle: 'Kirimlar',   workIcon: 'package' , tabs: [HOME('Xaridlar'), LIST('zayavka', 'Zayavka', 'clipboard-list', 'snabjeniye'), WORK('Kirimlar', 'package'), LIST('suppliers', 'Yetkazuv', 'users', 'suppliers'), MENU()] },
  ACCOUNTING:  { group: '(erp-accounting)',  label: 'Buxgalteriya',     homeTitle: 'Hisob',     homeIcon: 'house', listKey: 'invoices',   workTitle: 'Schyotlar',  workIcon: 'receipt' , tabs: [HOME('Hisob'), WORK('Schyotlar', 'receipt'), { route: 'hujjatlar', title: 'Hujjatlar', icon: 'file-text', screen: { kind: 'sections' } }, LIST('soliq', 'Soliq', 'calendar-days', 'cashflow'), MENU()] },
  FINANCE:     { group: '(erp-finance)',     label: 'Moliya',           homeTitle: 'Moliya',    homeIcon: 'house', listKey: 'cashflow',   workTitle: 'Oqim',       workIcon: 'trending-up' , tabs: [HOME('Moliya'), WORK('Oqim', 'trending-up'), LIST('qarzlar', 'Qarzlar', 'receipt', 'customers'), LIST('tolovlar', "To'lovlar", 'calendar-days', 'supply'), MENU()] },
  HR:          { group: '(erp-hr)',          label: 'Otdel kadr',       homeTitle: 'Kadrlar',   homeIcon: 'house', listKey: 'employees',  workTitle: 'Xodimlar',   workIcon: 'users' , tabs: [HOME('Kadrlar'), WORK('Xodimlar', 'users'), LIST('davomat', 'Davomat', 'clock', 'sex-emp'), LIST('tabel', 'Tabel', 'clipboard-list', 'brigades'), MENU()] },
  CASHIER:     { group: '(erp-cashier)',     label: 'Kassa / bank',     homeTitle: 'Kassa',     homeIcon: 'house', listKey: 'payments',   workTitle: "To'lovlar",  workIcon: 'banknote' , tabs: [HOME('Kassa'), WORK("To'lovlar", 'banknote'), LIST('bank', 'Bank', 'layers', 'cashflow'), LIST('chek', 'Chek', 'receipt', 'invoices'), MENU()] },
  MECHANIC:    { group: '(erp-mechanic)',    label: 'Mexanik',          homeTitle: 'Nazorat',   homeIcon: 'house', listKey: 'trips',      workTitle: 'Reyslar',    workIcon: 'route' , tabs: [HOME('Nazorat'), LIST('texnika', 'Texnika', 'truck', 'drivers'), LIST('xizmat', 'Xizmat', 'wrench', 'stock'), WORK('Reyslar', 'route'), MENU()] },
  DRIVER:      { group: '(erp-driver)',      label: 'Haydovchi',        homeTitle: 'Bugun',     homeIcon: 'house', listKey: 'trips',      workTitle: 'Reyslarim',  workIcon: 'truck' , tabs: [HOME('Bugun'), WORK('Reyslarim', 'truck'), { route: 'yol', title: "Yo'l", icon: 'navigation', screen: { kind: 'road' } }, MENU('user')] },
  BRIGADIER:   { group: '(erp-brigadier)',   label: 'Brigadir',         homeTitle: 'Brigadam',  homeIcon: 'house', listKey: 'tasks',      workTitle: 'Topshiriq',  workIcon: 'clipboard-list' , tabs: [HOME('Brigadam'), WORK('Topshiriq', 'clipboard-list'), LIST('issues', 'Muammolar', 'triangle-alert', 'brig-issues'), LIST('shifts', 'Smenalar', 'calendar-days', 'brig-shifts'), MENU()] },
};

/**
 * Rol sozlamasi — jadvalda yo'q rol uchun ham javob qaytaradi.
 * Serverda yangi rol qo'shilib, ilova hali yangilanmagan bo'lsa, oq ekran o'rniga
 * direktor bo'limi ochiladi (ma'lumotni baribir server rolga qarab beradi).
 */
export const erpRoleConfig = (role: ErpRole): ErpRoleConfig => ERP_ROLES[role] ?? ERP_ROLES.DIRECTOR;

/** Gate shu jadval bo'yicha yo'naltiradi. */
export const ERP_GROUPS = Object.values(ERP_ROLES).map((r) => r.group);
