import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/** MVP: uz (lotin). uz-Cyrl va ru — shu tuzilmaga qo'shiladi. */
const uz = {
  common: { next: 'Davom etish', back: 'Orqaga', save: 'Saqlash', cancel: 'Bekor qilish', retry: 'Qayta urinish', loading: 'Yuklanmoqda…', offline: 'Internet yo\'q — o\'zgarishlar ulanganda yuboriladi' },
  auth: { phoneTitle: 'Telefon raqamingiz', phoneHint: 'SMS orqali kod yuboramiz', otpTitle: 'SMS kodni kiriting', otpHint: '{{phone}} raqamiga yuborildi', roleTitle: 'Kim sifatida kirasiz?' },
  roles: { TADBIRKOR: 'Tadbirkor', QURUVCHI: 'Quruvchi', HAYDOVCHI: 'Haydovchi' },
  /** Umumiy komponentlar matni (src/design) — ekranlar kalit orqali oladi, matn kodga yozilmaydi. */
  ui: {
    back: 'Orqaga', close: 'Yopish', clear: 'Tozalash', all: 'Hammasi', confirm: 'Tasdiqlash', cancel: 'Bekor qilish',
    select: 'Tanlang…', search: 'Qidirish…', notFound: 'Topilmadi', noOptions: 'Variant yo\'q', noData: 'Ma\'lumot yo\'q',
    or: 'YOKI', other: 'Boshqa', loading: 'Yuklanmoqda…', checking: 'Tekshirilmoqda…',
  },
  driver: { today: 'Bugungi reyslar', accept: 'Reysni qabul qilish', ACCEPTED: 'Yuklashni boshladim', LOADING: 'Yo\'lga chiqdim', EN_ROUTE: 'Yetib keldim', ARRIVED: 'Tushirishni boshladim', UNLOADING: 'Yakunlash (imzo)', problem: 'Muammo', call: 'Qo\'ng\'iroq', navigate: 'Navigatsiya' },
};

// Hermes'da Intl.PluralRules yo'q — v3 JSON formati Intl API'ga bog'liq emas.
void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources: { uz: { translation: uz } },
  lng: 'uz',
  fallbackLng: 'uz',
  interpolation: { escapeValue: false },
});
export default i18n;
