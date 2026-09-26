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
}

export const ERP_ROLES: Record<ErpRole, ErpRoleConfig> = {
  DIRECTOR:    { group: '(erp-director)',    label: 'Direktor',         homeTitle: 'Boshqaruv',  homeIcon: 'gauge',   listKey: 'orders',     workTitle: 'Zayavkalar', workIcon: 'file-text' },
  SALES:       { group: '(erp-sales)',       label: 'Sotuv',            homeTitle: 'Bugun',      homeIcon: 'trending-up',   listKey: 'orders',     workTitle: 'Zayavkalar', workIcon: 'file-text' },
  PRODUCTION:  { group: '(erp-production)',  label: 'Ishlab chiqarish', homeTitle: 'Sex',        homeIcon: 'factory',     listKey: 'production', workTitle: 'Zameslar',   workIcon: 'package' },
  SUPERVISOR:  { group: '(erp-supervisor)',  label: 'Ish boshqaruvchi', homeTitle: 'Ishlar',     homeIcon: 'clipboard-list',     listKey: 'tasks',      workTitle: 'Topshiriqlar', workIcon: 'square-check' },
  LOGISTICS:   { group: '(erp-logistics)',   label: 'Logistika',        homeTitle: 'Dispetcher', homeIcon: 'navigation', listKey: 'trips',  workTitle: 'Reyslar',    workIcon: 'truck' },
  WAREHOUSE:   { group: '(erp-warehouse)',   label: 'Sklad',            homeTitle: 'Ombor',      homeIcon: 'warehouse', listKey: 'stock', workTitle: 'Xomashyo', workIcon: 'layers' },
  PROCUREMENT: { group: '(erp-procurement)', label: 'Snabjeniye',       homeTitle: 'Xaridlar',   homeIcon: 'shopping-cart',          listKey: 'receipts',   workTitle: 'Kirimlar',   workIcon: 'download' },
  ACCOUNTING:  { group: '(erp-accounting)',  label: 'Buxgalteriya',     homeTitle: 'Hisob',      homeIcon: 'calculator',    listKey: 'invoices',   workTitle: 'Schyotlar',  workIcon: 'receipt' },
  FINANCE:     { group: '(erp-finance)',     label: 'Moliya',           homeTitle: 'Moliya',     homeIcon: 'chart-pie',     listKey: 'cashflow',   workTitle: 'Kirim-chiqim', workIcon: 'arrow-up-down' },
  HR:          { group: '(erp-hr)',          label: 'Otdel kadr',       homeTitle: 'Kadrlar',    homeIcon: 'users',        listKey: 'employees',  workTitle: 'Xodimlar',   workIcon: 'id-card' },
  CASHIER:     { group: '(erp-cashier)',     label: 'Kassa / bank',     homeTitle: 'Kassa',      homeIcon: 'wallet',        listKey: 'payments',   workTitle: "To'lovlar",  workIcon: 'banknote' },
  DRIVER:      { group: '(erp-driver)',      label: 'Haydovchi',        homeTitle: 'Bugun',      homeIcon: 'calendar-days',         listKey: 'trips',      workTitle: 'Reyslarim',  workIcon: 'truck' },
  BRIGADIER:   { group: '(erp-brigadier)',   label: 'Brigadir',         homeTitle: 'Brigadam',   homeIcon: 'hard-hat',        listKey: 'tasks',      workTitle: 'Topshiriqlar', workIcon: 'square-check' },
};

/**
 * Rol sozlamasi — jadvalda yo'q rol uchun ham javob qaytaradi.
 * Serverda yangi rol qo'shilib, ilova hali yangilanmagan bo'lsa, oq ekran o'rniga
 * direktor bo'limi ochiladi (ma'lumotni baribir server rolga qarab beradi).
 */
export const erpRoleConfig = (role: ErpRole): ErpRoleConfig => ERP_ROLES[role] ?? ERP_ROLES.DIRECTOR;

/** Gate shu jadval bo'yicha yo'naltiradi. */
export const ERP_GROUPS = Object.values(ERP_ROLES).map((r) => r.group);
