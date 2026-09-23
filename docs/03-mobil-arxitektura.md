# 03 · Mobil ilova arxitekturasi (iOS + Android)

## 1. Nega Expo (React Native), Flutter emas?

Ikkalasi ham to'g'ri tanlov. Bu loyiha uchun Expo tanlandi, chunki:

1. Backend TypeScript — `packages/shared` dagi zod sxemalar mobil formalarda **o'sha kod** bo'lib ishlaydi (validatsiya, enumlar, tiplar). Flutterda bu ikki marta yoziladi.
2. Expo EAS: iOS va Android build/OTA-yangilash bitta buyruq bilan; kritik bagni App Store ko'rigisiz tuzatish mumkin (OTA).
3. Fon GPS, push, secure store, xarita — Expo modullarida tayyor va barqaror.
4. Jamoa topish (O'zbekiston): TS/React dasturchilar ko'proq.

Flutterga o'tish kerak bo'lsa — backend va contracts o'zgarmaydi (ADR-0002).

## 2. Stack

| Ehtiyoj | Kutubxona |
|---|---|
| Framework | Expo SDK 52, React Native 0.76 (New Architecture), TypeScript strict |
| Navigatsiya | Expo Router (fayl asosida, deep-link tayyor) |
| Server holati | TanStack Query v5 (kesh, retry, offline persist) |
| Lokal holat | Zustand (sessiya, faol rol, UI) |
| Saqlash | expo-secure-store (tokenlar), MMKV (kesh, offline navbat) |
| Formalar | react-hook-form + zod (`@insof/shared`) |
| Xarita | react-native-maps (Apple Maps iOS / Google Maps Android) |
| Joylashuv | expo-location (foreground + background task) |
| Push | expo-notifications |
| Tarmoq | ky/fetch + interceptorlar (token refresh, Idempotency-Key, X-Org-Id) |
| Realtime | socket.io-client |
| Tarjima | i18next: `uz` (lotin), `uz-Cyrl`, `ru` |
| UI | O'z dizayn tizimi (tokens + primitives), platformaga moslashuvchi |

## 3. Tuzilma (feature-first)

```
apps/mobile
├── app/                         Expo Router marshrutlar
│   ├── _layout.tsx              providers, auth gate, rol yo'naltirish
│   ├── (auth)/phone.tsx  otp.tsx  select-role.tsx
│   ├── (tadbirkor)/_layout.tsx  tabs: Bosh · Buyurtmalar · Dispetcher · Moliya · Ko'proq
│   ├── (quruvchi)/_layout.tsx   tabs: Bosh · Buyurtmalar · Obyektlar · Moliya · Profil
│   ├── (haydovchi)/_layout.tsx  stack: Bugungi reyslar → Reys (katta tugmalar)
│   └── delivery/[id].tsx        umumiy: reys tafsiloti + jonli xarita
├── src/
│   ├── core/                    api client, auth session, storage, config, i18n
│   ├── design/                  tokens, theme, primitives (Button, Card, Sheet, ListItem…)
│   ├── features/
│   │   ├── auth/  orders/  deliveries/  dispatch/  sites/  billing/  tracking/
│   │   └── <feature>/ { api.ts, hooks.ts, components/, screens/ }
│   └── shared/                  utils, hooks (useOnline, useRole)
└── app.config.ts
```

## 4. Rolga qarab UI

Kirishdan keyin `memberships[]` keladi. Bitta bo'lsa — to'g'ri o'sha rol guruhiga; ko'p bo'lsa — "Kim sifatida kirasiz?" ekrani. Faol rol Zustand'da; `_layout.tsx` guruhlarga `Redirect` qiladi. Rol almashtirish — profil sahifasidan, ilovani qayta ochmasdan.

Har rol — o'z navigatsiya shakli:
- **Tadbirkor:** 5 tab, ma'lumotga boy, jadvallar/kartalar, filtrlar.
- **Quruvchi:** 5 tab, "Buyurtma berish" — FAB/asosiy tugma, 3 qadamli wizard.
- **Haydovchi:** tab yo'q. Bitta stack. Katta (56 dp) tugmalar, yuqori kontrast, qo'lqopda ishlaydigan, matn 18 sp+. Ekran o'chmaydi (`expo-keep-awake`) faol reysda.

## 5. Apple va Samsung uchun moslashuv

Bitta kod, ammo platforma odatlari hurmat qilinadi:

| Element | iOS (Apple HIG) | Android (Material 3, Samsung One UI) |
|---|---|---|
| Header | Native large title, orqaga "chevron" chapda | Markazlashgan/chapda sarlavha, orqaga strelka, elevation |
| Tab bar | Pastda, blur fon, SF Symbols uslubi | Pastda, Material icons, indikator pill |
| Asosiy tugma | To'liq kenglik, 12 radius, bosilganda opacity | 20 radius (M3), ripple effekti |
| Tanlash | Bottom sheet + wheel picker | Bottom sheet + radio |
| Sana/vaqt | Native `UIDatePicker` (inline) | Material date/time dialog |
| Xabar | Alert (2 tugma) | Snackbar / Material dialog |
| Shrift | SF Pro (tizim) | Roboto / Samsung One UI (tizim) — `fontFamily` berilmaydi, tizimniki |
| Orqaga | Swipe-back | Hardware/gesture back — `BackHandler` bilan wizard'da tasdiq |
| Xarita | Apple Maps | Google Maps |
| Push ruxsat | Birinchi reysdan oldin so'raladi (kontekst bilan) | Android 13+: `POST_NOTIFICATIONS` runtime |
| Fon GPS | "Always" ruxsat — tushuntirish ekrani keyin so'rov | Foreground Service + bildirishnoma (majburiy) |
| Samsung xususiyati | – | Batareya optimizatsiyasidan chiqarish bo'yicha yo'riqnoma (One UI agressiv o'chiradi) |

Amalga oshirish: `Platform.select` tokenlar darajasida (`radius.button`, `elevation`), primitivlar ichida; ekran kodi platformani bilmaydi.

## 6. Offline strategiyasi

- **Ko'rish:** TanStack Query persist (MMKV) — ro'yxatlar internetsiz ochiladi, "yangilangan: 5 daq oldin" ko'rsatiladi.
- **Yozish (Haydovchi):** holat o'zgarishi → lokal `outbox` (MMKV) → optimistik UI → fon sinxron (`Idempotency-Key` = outbox item ID). Tartib saqlanadi (FIFO), xato bo'lsa foydalanuvchiga ko'rsatiladi.
- **GPS:** fon vazifa nuqtalarni lokal buferga yozadi; har 15 s yoki 20 nuqta bo'lganda WS/HTTP orqali yuboradi; ulanish yo'q bo'lsa saqlanadi.
- **Konflikt:** server — haqiqat manbai. Reys holati serverda oldinga o'tib ketgan bo'lsa (dispetcher override), mobil o'z eventini `409` bilan oladi va UI yangilanadi.

## 7. Sifat

- Typecheck + ESLint + Prettier (CI).
- Unit: biznes hooklar (vitest). Komponent: RN Testing Library. E2E: Maestro (iOS sim + Android emu) — "buyurtma → reys → imzo" oqimi.
- Sentry (crash + performance), Expo Updates kanallari: `preview` (ichki), `production`.
- Accessibility: `accessibilityLabel` har interaktiv elementda, dinamik shrift, kontrast ≥ 4.5:1 (haydovchi ekranlarida ≥ 7:1).
