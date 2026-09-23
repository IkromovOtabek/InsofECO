# ADR-0002 · Mobil: Expo (React Native), Flutter emas

**Holat:** qabul qilindi · 2026-09-17

**Kontekst.** iOS + Android, kichik jamoa, backend TS. Flutter ham kuchli nomzod.

**Qaror.** Expo SDK 52 + Expo Router. Sabablar: umumiy tiplar/validatsiya, EAS OTA, O'zbekistonda TS dasturchilar ko'proq, fon GPS/push modullari tayyor.

**Qachon qayta ko'rish.** Agar murakkab custom-render (masalan, 3D beton hisoblagich) yoki 60 fps animatsiyaga bog'liq UI kerak bo'lsa. Backend va contracts o'zgarmaydi — faqat `apps/mobile` almashadi.
