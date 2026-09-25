import type { ErpRole } from '@/core/erp';
import type { IconName } from '@/design/ui';

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
  homeIconActive: IconName;
  /** Ikkinchi tab — rolning ishchi ro'yxati (`/api/mobile/list?key=...`). */
  listKey: string;
  workTitle: string;
  workIcon: IconName;
  workIconActive: IconName;
}

export const ERP_ROLES: Record<ErpRole, ErpRoleConfig> = {
  DIRECTOR:    { group: '(erp-director)',    label: 'Direktor',         homeTitle: 'Boshqaruv',  homeIcon: 'speedometer-outline',   homeIconActive: 'speedometer',   listKey: 'orders',     workTitle: 'Zayavkalar', workIcon: 'document-text-outline', workIconActive: 'document-text' },
  SALES:       { group: '(erp-sales)',       label: 'Sotuv',            homeTitle: 'Bugun',      homeIcon: 'trending-up-outline',   homeIconActive: 'trending-up',   listKey: 'orders',     workTitle: 'Zayavkalar', workIcon: 'document-text-outline', workIconActive: 'document-text' },
  PRODUCTION:  { group: '(erp-production)',  label: 'Ishlab chiqarish', homeTitle: 'Sex',        homeIcon: 'construct-outline',     homeIconActive: 'construct',     listKey: 'production', workTitle: 'Zameslar',   workIcon: 'cube-outline',          workIconActive: 'cube' },
  SUPERVISOR:  { group: '(erp-supervisor)',  label: 'Ish boshqaruvchi', homeTitle: 'Ishlar',     homeIcon: 'clipboard-outline',     homeIconActive: 'clipboard',     listKey: 'tasks',      workTitle: 'Topshiriqlar', workIcon: 'checkbox-outline',    workIconActive: 'checkbox' },
  LOGISTICS:   { group: '(erp-logistics)',   label: 'Logistika',        homeTitle: 'Dispetcher', homeIcon: 'navigate-circle-outline', homeIconActive: 'navigate-circle', listKey: 'trips',  workTitle: 'Reyslar',    workIcon: 'bus-outline',           workIconActive: 'bus' },
  WAREHOUSE:   { group: '(erp-warehouse)',   label: 'Sklad',            homeTitle: 'Ombor',      homeIcon: 'file-tray-stacked-outline', homeIconActive: 'file-tray-stacked', listKey: 'stock', workTitle: 'Xomashyo', workIcon: 'layers-outline',      workIconActive: 'layers' },
  PROCUREMENT: { group: '(erp-procurement)', label: 'Snabjeniye',       homeTitle: 'Xaridlar',   homeIcon: 'cart-outline',          homeIconActive: 'cart',          listKey: 'receipts',   workTitle: 'Kirimlar',   workIcon: 'download-outline',      workIconActive: 'download' },
  ACCOUNTING:  { group: '(erp-accounting)',  label: 'Buxgalteriya',     homeTitle: 'Hisob',      homeIcon: 'calculator-outline',    homeIconActive: 'calculator',    listKey: 'invoices',   workTitle: 'Schyotlar',  workIcon: 'receipt-outline',       workIconActive: 'receipt' },
  FINANCE:     { group: '(erp-finance)',     label: 'Moliya',           homeTitle: 'Moliya',     homeIcon: 'pie-chart-outline',     homeIconActive: 'pie-chart',     listKey: 'cashflow',   workTitle: 'Kirim-chiqim', workIcon: 'swap-vertical-outline', workIconActive: 'swap-vertical' },
  HR:          { group: '(erp-hr)',          label: 'Otdel kadr',       homeTitle: 'Kadrlar',    homeIcon: 'people-outline',        homeIconActive: 'people',        listKey: 'employees',  workTitle: 'Xodimlar',   workIcon: 'id-card-outline',       workIconActive: 'id-card' },
  CASHIER:     { group: '(erp-cashier)',     label: 'Kassa / bank',     homeTitle: 'Kassa',      homeIcon: 'wallet-outline',        homeIconActive: 'wallet',        listKey: 'payments',   workTitle: "To'lovlar",  workIcon: 'cash-outline',          workIconActive: 'cash' },
  DRIVER:      { group: '(erp-driver)',      label: 'Haydovchi',        homeTitle: 'Bugun',      homeIcon: 'today-outline',         homeIconActive: 'today',         listKey: 'trips',      workTitle: 'Reyslarim',  workIcon: 'bus-outline',           workIconActive: 'bus' },
  BRIGADIER:   { group: '(erp-brigadier)',   label: 'Brigadir',         homeTitle: 'Brigadam',   homeIcon: 'hammer-outline',        homeIconActive: 'hammer',        listKey: 'tasks',      workTitle: 'Topshiriqlar', workIcon: 'checkbox-outline',    workIconActive: 'checkbox' },
};

/**
 * Rol sozlamasi — jadvalda yo'q rol uchun ham javob qaytaradi.
 * Serverda yangi rol qo'shilib, ilova hali yangilanmagan bo'lsa, oq ekran o'rniga
 * direktor bo'limi ochiladi (ma'lumotni baribir server rolga qarab beradi).
 */
export const erpRoleConfig = (role: ErpRole): ErpRoleConfig => ERP_ROLES[role] ?? ERP_ROLES.DIRECTOR;

/** Gate shu jadval bo'yicha yo'naltiradi. */
export const ERP_GROUPS = Object.values(ERP_ROLES).map((r) => r.group);
