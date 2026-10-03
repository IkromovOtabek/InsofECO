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
}

/** Oxirgi tab — profil va bo'limlar menyusi (spekdagi "Menyu"). */
export const MENU_TAB = { title: 'Menyu', icon: 'menu' } as const;
/** Direktorning AI tabi. */
export const AI_TAB = { title: 'AI', icon: 'sparkles' } as const;

export const ERP_ROLES: Record<ErpRole, ErpRoleConfig> = {
  // Tab yorliqlari va ikonkalar — `docs/redesign/roles/<ROLE>.json` dagi `tabs` (mavjud ekranlarga mos keladiganlari)
  // Ikkinchi tab — direktor qarorini kutayotganlar (bloklangan zayavka, ta'minot tasdig'i/to'lovi); zayavkalar "Bo'limlar"da
  DIRECTOR:    { group: '(erp-director)',    label: 'Direktor',         homeTitle: 'Asosiy',    homeIcon: 'house', listKey: 'approvals',  workTitle: 'Tasdiqlar',  workIcon: 'circle-check', ai: true },
  SALES:       { group: '(erp-sales)',       label: 'Sotuv',            homeTitle: 'Bugun',     homeIcon: 'house', listKey: 'orders',     workTitle: 'Zayavka',    workIcon: 'file-text' },
  PRODUCTION:  { group: '(erp-production)',  label: 'Ishlab chiqarish', homeTitle: 'Sex',       homeIcon: 'house', listKey: 'production', workTitle: 'Zameslar',   workIcon: 'package' },
  SUPERVISOR:  { group: '(erp-supervisor)',  label: 'Ish boshqaruvchi', homeTitle: 'Ishlar',    homeIcon: 'house', listKey: 'tasks',      workTitle: 'Topshiriq',  workIcon: 'clipboard-list' },
  LOGISTICS:   { group: '(erp-logistics)',   label: 'Logistika',        homeTitle: 'Asosiy',    homeIcon: 'house', listKey: 'trips',      workTitle: 'Reyslar',    workIcon: 'truck' },
  WAREHOUSE:   { group: '(erp-warehouse)',   label: 'Sklad',            homeTitle: 'Ombor',     homeIcon: 'house', listKey: 'stock',      workTitle: 'Xomashyo',   workIcon: 'layers' },
  PROCUREMENT: { group: '(erp-procurement)', label: 'Snabjeniye',       homeTitle: 'Xaridlar',  homeIcon: 'house', listKey: 'receipts',   workTitle: 'Kirimlar',   workIcon: 'package' },
  ACCOUNTING:  { group: '(erp-accounting)',  label: 'Buxgalteriya',     homeTitle: 'Hisob',     homeIcon: 'house', listKey: 'invoices',   workTitle: 'Schyotlar',  workIcon: 'receipt' },
  FINANCE:     { group: '(erp-finance)',     label: 'Moliya',           homeTitle: 'Moliya',    homeIcon: 'house', listKey: 'cashflow',   workTitle: 'Oqim',       workIcon: 'trending-up' },
  HR:          { group: '(erp-hr)',          label: 'Otdel kadr',       homeTitle: 'Kadrlar',   homeIcon: 'house', listKey: 'employees',  workTitle: 'Xodimlar',   workIcon: 'users' },
  CASHIER:     { group: '(erp-cashier)',     label: 'Kassa / bank',     homeTitle: 'Kassa',     homeIcon: 'house', listKey: 'payments',   workTitle: "To'lovlar",  workIcon: 'banknote' },
  MECHANIC:    { group: '(erp-mechanic)',    label: 'Mexanik',          homeTitle: 'Nazorat',   homeIcon: 'house', listKey: 'trips',      workTitle: 'Reyslar',    workIcon: 'route' },
  DRIVER:      { group: '(erp-driver)',      label: 'Haydovchi',        homeTitle: 'Bugun',     homeIcon: 'house', listKey: 'trips',      workTitle: 'Reyslarim',  workIcon: 'truck' },
  BRIGADIER:   { group: '(erp-brigadier)',   label: 'Brigadir',         homeTitle: 'Brigadam',  homeIcon: 'house', listKey: 'tasks',      workTitle: 'Topshiriq',  workIcon: 'clipboard-list' },
};

/**
 * Rol sozlamasi — jadvalda yo'q rol uchun ham javob qaytaradi.
 * Serverda yangi rol qo'shilib, ilova hali yangilanmagan bo'lsa, oq ekran o'rniga
 * direktor bo'limi ochiladi (ma'lumotni baribir server rolga qarab beradi).
 */
export const erpRoleConfig = (role: ErpRole): ErpRoleConfig => ERP_ROLES[role] ?? ERP_ROLES.DIRECTOR;

/** Gate shu jadval bo'yicha yo'naltiradi. */
export const ERP_GROUPS = Object.values(ERP_ROLES).map((r) => r.group);
