import type { ErpRole } from '@/core/erp';
import type { IconName } from '@/design/icons';

/**
 * Rol dashboardlari — `docs/redesign/roles/<ROLE>.json` speklarining ilovadagi xaritasi.
 *
 * Raqamlarni server beradi (`/api/mobile/home` → `cards`, `sections`); bu jadval faqat
 * qaysi karta qaysi blokka tushishini, tezkor amallar va sarlavhalarni aytadi.
 * Spekdagi ko'rsatkichning serverda manbasi bo'lmasa — u shu yerda YO'Q (raqam o'ylab topilmaydi),
 * `missing` ro'yxatida qayd etiladi (backend uchun).
 *
 * Karta kalitlari — `lib/mobile/home.ts` va `lib/mobile/dashboard.ts` (ERP server) dagi `key` lar.
 */

/** Tezkor amal manzili. */
export type QuickTarget =
  /** Yangi hujjat formasi (`/erp/new/<key>`) — faqat rol ocha olsa (server `quick` da `new`). */
  | { kind: 'new'; key: string }
  /** Ro'yxat (`/erp/list/<key>`) — faqat rolga ruxsat bo'lsa (server `quick` da `list`). */
  | { kind: 'list'; key: string }
  /** Shu bo'limning tabi. */
  | { kind: 'tab'; tab: 'work' | 'ai' | 'menu' }
  /** Bosh sahifadagi karta ochadigan joy (`card.open`) — karta bo'lmasa amal ko'rinmaydi. */
  | { kind: 'card'; key: string | RegExp }
  /** Bo'limning birinchi qatori: kartochka yoki marshrut ekrani. */
  | { kind: 'row'; section: RegExp; open: 'detail' | 'route' };

export interface QuickSpec {
  label: string; icon: IconName; to: QuickTarget;
  /** `to` rolga ochiq bo'lmasa (masalan eski server formani bermasa) — shu manzil, o'z yorlig'i bilan. */
  orElse?: { label: string; icon: IconName; to: QuickTarget };
}

/** Davr kalitlari — server `?period=` (direktorda `?revenue=`) qabul qiladi. */
export type PeriodKey = 'day' | 'week' | 'month' | 'year';

export interface RoleDashboard {
  /** Sahifa sarlavhasi (PageHeader). */
  title: string;
  /** Davr chiplari. Bo'sh — chip yo'q, ekran `fixedPeriod` bo'yicha ishlaydi. */
  periods: PeriodKey[];
  /** Chip yo'q yoki spekda "Oy" yo'q bo'lsa — boshlang'ich davr (server standarti — oy). */
  fixedPeriod?: PeriodKey;
  /** Bosh ko'rsatkich: shu kalitlardan birinchisi topilgani; topilmasa — serverning birinchi kartasi. */
  hero?: string[];
  /** Hero sparkline'i: asosiy grafikning shu seriyasi (indeks). Yo'q — sparkline chizilmaydi. */
  spark?: number;
  /** 4 ta KPI — ustuvorlik tartibida; yetmasa qolgan kartalardan to'ldiriladi. */
  kpis: string[];
  /** Asosiy grafik: `bars` — davr ustunlari (yoki direktorda oylar), `hbars` — ulush bo'limidan reyting. */
  chart?: { kind: 'bars' | 'hbars'; section: RegExp; title?: string; /** Ko'rsatiladigan seriyalar (birlik bir xil bo'lsa ikkita). */ series?: number[] } | null;
  /** Taqsimot kartasi (donut bo'limi). */
  breakdown?: RegExp | null;
  /** Plan/fakt kartasi: bo'lim va (ixtiyoriy) qator nomi. */
  progress?: { section: RegExp; item?: RegExp } | null;
  /** "E'tibor talab qiladi" — shu bo'limlar qatorlari (bo'lim pastda takrorlanmaydi). */
  attention: RegExp[];
  /** Doim ogohlantirish rangida keladigan, lekin "e'tibor" emas kartalar (chiqim, yoqilg'i). */
  calm?: string[];
  /** Direktor: tasdiq kutayotganlar soni (ro'yxatdan). */
  countList?: { key: string; title: string; sub: string; icon: IconName };
  /** Bosh sahifada ko'rsatilmaydigan bo'limlar (spek bo'yicha ortiqcha). */
  hide?: RegExp[];
  quick: QuickSpec[];
  /** Spekdagi, lekin API'da manbasi yo'q ko'rsatkichlar — backend uchun. */
  missing: string[];
}

const CALM = ['out', 'expense', 'fuel', 'payable', 'cost'];

export const ROLE_DASHBOARDS: Record<ErpRole, RoleDashboard> = {
  DIRECTOR: {
    title: 'Bosh sahifa',
    periods: ['day', 'week', 'month'],
    hero: ['profit'], spark: 1,
    kpis: ['revenue', 'receivable', 'production', 'shipment'],
    chart: { kind: 'bars', section: /^Dinamika/, title: 'Tushum va xarajat', series: [0, 2] },
    breakdown: null,
    progress: { section: /^Direktor nazorati/ },
    attention: [/^Egasi qarori/],
    countList: { key: 'approvals', title: 'Tasdiq kutmoqda', sub: "Bloklangan zayavka va ta'minot to'lovlari", icon: 'circle-check' },
    quick: [
      { label: 'Tasdiqlash', icon: 'circle-check', to: { kind: 'tab', tab: 'work' } },
      { label: 'Pul oqimi', icon: 'wallet', to: { kind: 'list', key: 'cashflow' } },
      { label: 'Qarzdorlar', icon: 'receipt', to: { kind: 'card', key: 'receivable' } },
      { label: "AI so'rov", icon: 'sparkles', to: { kind: 'tab', tab: 'ai' } },
    ],
    missing: ['Sotuv ulushi (mahsulot bo\'yicha, direktor uchun)', 'Debitorlik yoshi (60+ kun)', 'Sement zaxirasi kunlarda'],
  },
  SALES: {
    title: 'Sotuv',
    periods: ['day', 'week', 'month'],
    spark: 0,
    kpis: ['volume', 'mine', 'blocked', 'leads'],
    chart: { kind: 'bars', section: /^Sotuv dinamikasi/, series: [0, 1] },
    breakdown: /^Mahsulotlar bo'yicha/,
    progress: { section: /^Sotuv plani/ },
    attention: [/^Ta'minot — tasdiq/, /^Saytdan yangi arizalar/],
    quick: [
      { label: 'Yangi zayavka', icon: 'plus', to: { kind: 'new', key: 'orders' } },
      { label: 'Mijozlar', icon: 'users', to: { kind: 'list', key: 'customers' } },
      { label: 'Schyotlar', icon: 'receipt', to: { kind: 'list', key: 'invoices' } },
      { label: 'Arizalar', icon: 'inbox', to: { kind: 'list', key: 'leads' } },
    ],
    missing: ["O'rtacha chek", "Muddati o'tgan nasiya (sotuvchi kesimida)", 'Limitdan oshgan mijozlar', 'Narx-navo ro\'yxati'],
  },
  PRODUCTION: {
    title: 'Sex',
    periods: ['day', 'week', 'month'],
    spark: 0,
    kpis: ['plan', 'defect', 'stock', 'attendance'],
    chart: { kind: 'bars', section: /^Ishlab chiqarish dinamikasi/ },
    breakdown: /^Mahsulotlar ulushi/,
    progress: { section: /^Plan \/ fakt/ },
    attention: [/^Sklad — .* kam/],
    quick: [
      { label: 'Zameslar', icon: 'package', to: { kind: 'tab', tab: 'work' } },
      { label: 'Topshiriqlar', icon: 'clipboard-list', to: { kind: 'list', key: 'tasks' } },
      { label: 'Kunlik hisobot', icon: 'file-text', to: { kind: 'list', key: 'prod-report' } },
      { label: "Ta'minot so'rash", icon: 'shopping-cart', to: { kind: 'new', key: 'supply' } },
    ],
    missing: ['Sement sarfi (davr)', "Uskuna to'xtash vaqti", 'Zames qayd formasi (mobil create)'],
  },
  SUPERVISOR: {
    title: 'Ishlar',
    periods: ['day', 'week'], fixedPeriod: 'day',
    spark: 0,
    kpis: ['open', 'overdue', 'defect', 'closed'],
    chart: { kind: 'hbars', section: /^Brigadalar ulushi/, title: 'Brigadalar bajarilishi' },
    breakdown: null,
    progress: { section: /^(Topshiriqlar bajarilishi|Brigadalar — ochiq)/ },
    attention: [],
    quick: [
      { label: 'Topshiriqlar', icon: 'clipboard-list', to: { kind: 'tab', tab: 'work' } },
      { label: 'Brigadalar', icon: 'hard-hat', to: { kind: 'list', key: 'brigades' } },
      { label: 'Muammolar', icon: 'triangle-alert', to: { kind: 'list', key: 'brig-issues' } },
      { label: 'Smena hisobotlari', icon: 'clipboard-check', to: { kind: 'list', key: 'brig-shifts' } },
    ],
    missing: ['Davomat (ish boshqaruvchi kesimida)', 'Davomat belgilanmagan brigadalar'],
  },
  LOGISTICS: {
    title: 'Dispetcherlik',
    periods: ['day', 'week', 'month'],
    spark: 1,
    kpis: ['late', 'avg', 'onroad', 'fuel'],
    chart: { kind: 'bars', section: /^Reyslar dinamikasi/, series: [0] },
    breakdown: /^Transport holati/,
    progress: null,
    attention: [/^Ogohlantirishlar/, /^Transport kutayotgan/],
    calm: CALM,
    quick: [
      { label: 'Reys ochish', icon: 'plus', to: { kind: 'new', key: 'trips' } },
      { label: 'Reyslar', icon: 'truck', to: { kind: 'tab', tab: 'work' } },
      { label: 'Haydovchilar', icon: 'id-card', to: { kind: 'list', key: 'drivers' } },
      { label: 'Zayavkalar', icon: 'file-text', to: { kind: 'list', key: 'orders' } },
    ],
    missing: ["Soatlik reja (reys rejasi)", 'Beton yoshi (yuklangandan beri daqiqa)', 'Bugungi hajm rejasi'],
  },
  WAREHOUSE: {
    title: 'Ombor',
    periods: ['day', 'week'], fixedPeriod: 'day',
    spark: 0,
    kpis: ['low', 'consume', 'brigade', 'adjust'],
    chart: { kind: 'hbars', section: /^Yetkazuvchilar bo'yicha/ },
    breakdown: /^Harakat turlari/,
    progress: { section: /^Qoldiq \/ minimum/, item: /sement/i },
    attention: [/^Kam qolgan xomashyo/],
    quick: [
      { label: 'Kirimlar', icon: 'download', to: { kind: 'list', key: 'receipts' } },
      { label: "Xarid so'rovi", icon: 'shopping-cart', to: { kind: 'new', key: 'supply' } },
      { label: 'Xomashyo', icon: 'layers', to: { kind: 'tab', tab: 'work' } },
      { label: 'Snabjeniye', icon: 'clipboard-list', to: { kind: 'list', key: 'snabjeniye' } },
    ],
    missing: ['Zaxira kunlari (material kesimida)', 'Tayyor mahsulot (gazoblok) qoldig\'i', "Silos to'lishi", 'Inventarizatsiya farqi'],
  },
  PROCUREMENT: {
    title: 'Xaridlar',
    periods: ['day', 'week', 'month'],
    spark: 0,
    kpis: ['open', 'transit', 'urgent', 'late'],
    chart: { kind: 'hbars', section: /^Materiallar bo'yicha/, title: "Xarajat materiallar bo'yicha" },
    breakdown: /^So'rovlar holati/,
    progress: null,
    attention: [/^Bildirishnomalar/, /^Shoshilinch talablar/],
    quick: [
      { label: "Xarid so'rovi", icon: 'plus', to: { kind: 'new', key: 'supply' } },
      { label: 'Kirimlar', icon: 'download', to: { kind: 'tab', tab: 'work' } },
      { label: 'Snabjeniye', icon: 'receipt', to: { kind: 'list', key: 'snabjeniye' } },
      { label: 'Yetkazuvchilar', icon: 'store', to: { kind: 'list', key: 'suppliers' } },
    ],
    missing: ['Oylik xarid budjeti', 'Sement narxi dinamikasi', 'Yetkazuvchiga qarz (kreditorka)'],
  },
  ACCOUNTING: {
    title: 'Hisob',
    periods: ['week', 'month'],
    hero: ['invoiced'],
    kpis: ['payments', 'receivable', 'payable', 'expense'],
    chart: { kind: 'bars', section: /^Kirim \/ chiqim/, series: [0, 1] },
    breakdown: /^Schyotlar holati/,
    progress: null,
    attention: [/^Ta'minot to'lovlari/],
    calm: CALM,
    quick: [
      { label: 'Schyotlar', icon: 'receipt', to: { kind: 'tab', tab: 'work' } },
      { label: 'Mijozlar', icon: 'users', to: { kind: 'list', key: 'customers' } },
      { label: 'Kirim-chiqim', icon: 'arrow-up-down', to: { kind: 'list', key: 'cashflow' } },
      { label: "To'lovlar", icon: 'banknote', to: { kind: 'list', key: 'payments' } },
    ],
    missing: ['Yozilmagan faktura', 'Imzosiz / rad etilgan e-faktura', "QQS to'lovi muddati", 'Akt-sverka', 'Oy yopilishi', 'Chorak davri'],
  },
  FINANCE: {
    title: 'Pul oqimi',
    periods: ['day', 'week', 'month'],
    hero: ['balance'],
    kpis: ['net', 'in', 'out', 'budget'],
    chart: { kind: 'bars', section: /^Pul oqimi/, series: [0, 1] },
    breakdown: /^Xarajat kategoriyalari/,
    progress: { section: /^Byudjet/ },
    attention: [/^Ta'minot to'lovlari/],
    calm: CALM,
    quick: [
      { label: "Ta'minot to'lovi", icon: 'calendar-days', to: { kind: 'list', key: 'supply' } },
      { label: 'Qarzdorlar', icon: 'receipt', to: { kind: 'list', key: 'customers' } },
      { label: 'Kirim-chiqim', icon: 'arrow-up-down', to: { kind: 'tab', tab: 'work' } },
      { label: 'Schyotlar', icon: 'file-text', to: { kind: 'list', key: 'invoices' } },
    ],
    missing: ['Debitorlik va yoshi (moliya bosh sahifasida)', 'Kreditorlik', 'Olingan avans', 'Marja', '14 kunlik pul prognozi', 'Inkassatsiya rejasi'],
  },
  HR: {
    title: 'Kadrlar',
    periods: ['day', 'week', 'month'],
    kpis: ['absent', 'sick', 'hired', 'active'],
    chart: { kind: 'hbars', section: /^Lavozimlar bo'yicha/, title: "Lavozimlar bo'yicha" },
    breakdown: /^Davomat tarkibi/,
    progress: null,
    attention: [],
    quick: [
      { label: 'Xodimlar', icon: 'users', to: { kind: 'tab', tab: 'work' } },
      { label: 'Yangi brigada', icon: 'plus', to: { kind: 'new', key: 'brigades' } },
      { label: 'Haydovchilar', icon: 'id-card', to: { kind: 'list', key: 'drivers' } },
      { label: 'Brigadalar', icon: 'hard-hat', to: { kind: 'list', key: 'brigades' } },
    ],
    missing: ['Kechikkanlar', 'Ochiq vakansiyalar', 'Davomat bo\'limlar kesimida', 'Selfi tekshiruvi navbati', 'Hujjat muddati', "Ta'til arizalari", 'Oylik tabel'],
  },
  CASHIER: {
    title: 'Kassa',
    periods: [], fixedPeriod: 'day',
    hero: ['balance'],
    kpis: ['payments', 'out', 'count'],
    chart: { kind: 'bars', section: /^Kirim \/ chiqim/, series: [0, 1] },
    breakdown: /^Hisoblar bo'yicha qoldiq/,
    progress: null,
    attention: [/^Ta'minot to'lovlari/],
    calm: CALM,
    // Kassir ilovadan to'lov qabul qiladi va kirim/chiqim yozadi (server `quick` da `new: payments/cashflow/transfer`).
    // Eski server formani bermasa — avvalgi ro'yxatlar (schyotlar, kirim-chiqim, ta'minot to'lovi).
    quick: [
      { label: "To'lov qabul qilish", icon: 'plus', to: { kind: 'new', key: 'payments' }, orElse: { label: "To'lov qabul", icon: 'plus', to: { kind: 'list', key: 'invoices' } } },
      { label: 'Kirim / chiqim', icon: 'arrow-up-down', to: { kind: 'new', key: 'cashflow' }, orElse: { label: 'Kirim-chiqim', icon: 'arrow-up-down', to: { kind: 'list', key: 'cashflow' } } },
      { label: "To'lovlar", icon: 'banknote', to: { kind: 'tab', tab: 'work' } },
      { label: 'Kassa ⇄ bank', icon: 'arrow-left-right', to: { kind: 'new', key: 'transfer' }, orElse: { label: "Ta'minot to'lovi", icon: 'clipboard-list', to: { kind: 'list', key: 'supply' } } },
    ],
    missing: ["Naqd / bank qoldig'i alohida", 'Click / Payme tushumi', 'Kirim usuli taqsimoti', 'Kassa limiti', 'Haydovchi topshirmagan pul'],
  },
  MECHANIC: {
    title: 'Nazorat',
    periods: ['day', 'week', 'month'],
    spark: 0,
    kpis: ['t-problem', 't-left', 'n-trucks', 'n-short'],
    chart: { kind: 'bars', section: /^Jo'natish dinamikasi/, series: [0] },
    breakdown: null,
    progress: { section: /^Ish jarayoni/ },
    attention: [/^Avtomatik ogohlantirish/],
    quick: [
      { label: 'Reyslar', icon: 'truck', to: { kind: 'tab', tab: 'work' } },
      { label: 'Sklad', icon: 'package', to: { kind: 'list', key: 'stock' } },
      { label: 'Muammolar', icon: 'triangle-alert', to: { kind: 'card', key: 't-problem' } },
      { label: 'Ertangi transport', icon: 'calendar-days', to: { kind: 'card', key: 'n-trucks' } },
    ],
    missing: ['Texnik tayyorlik (park %)', "Ta'mirdagi texnika", "Muddati o'tgan TO", "Yoqilg'i normadan oshishi", "Ta'mir xarajati", "Ko'rik va sug'urta muddatlari"],
  },
  DRIVER: {
    title: 'Bugun',
    periods: [], fixedPeriod: 'day',
    hero: ['trips'],
    kpis: ['km', 'delivered', 'fuel', 'issues'],
    chart: null,
    breakdown: null,
    progress: null,
    attention: [],
    calm: CALM,
    hide: [/^Reyslar dinamikasi/, /^Mijozlar bo'yicha/],
    quick: [
      { label: 'Joriy reys', icon: 'circle-check', to: { kind: 'row', section: /^Ochiq reyslarim/, open: 'detail' } },
      { label: 'Marshrut', icon: 'navigation', to: { kind: 'row', section: /^Ochiq reyslarim/, open: 'route' } },
      { label: 'Reyslarim', icon: 'truck', to: { kind: 'tab', tab: 'work' } },
    ],
    missing: ['Oylik bonus', "Yoqilg'i limiti", "Texnik ko'rik eslatmasi", "Dispetcher telefoni", 'Joriy reys bajarilishi (%)'],
  },
  BRIGADIER: {
    title: 'Brigadam',
    periods: [], fixedPeriod: 'day',
    spark: 1,
    kpis: ['inwork', 'issues', 'defect', 'pct'],
    chart: { kind: 'bars', section: /^Reja \/ fakt/, series: [0, 1] },
    breakdown: /^Muammo turlari/,
    progress: { section: /^(Bugungi reja|Topshiriqlar bajarilishi)/ },
    attention: [/^Muammolar va ogohlantirishlar/],
    quick: [
      { label: 'Smena', icon: 'clock', to: { kind: 'card', key: /^shift-/ } },
      { label: 'Topshiriqlar', icon: 'clipboard-list', to: { kind: 'tab', tab: 'work' } },
      { label: 'Muammolar', icon: 'triangle-alert', to: { kind: 'list', key: 'brig-issues' } },
      { label: 'Smena hisobotlari', icon: 'clipboard-check', to: { kind: 'list', key: 'brig-shifts' } },
    ],
    missing: ['Smena soatma-soat (kunlik davrda)', 'Davomat KPI (hozir faqat smena kartasi izohida)'],
  },
};

export const roleDashboard = (role: ErpRole): RoleDashboard => ROLE_DASHBOARDS[role] ?? ROLE_DASHBOARDS.DIRECTOR;

export const PERIOD_LABEL: Record<PeriodKey | 'custom', string> = { day: 'Bugun', week: 'Hafta', month: 'Oy', year: 'Yil', custom: 'Kalendar' };
