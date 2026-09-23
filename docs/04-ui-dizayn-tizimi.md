# 04 · UI dizayn tizimi va ekranlar

## 1. Tamoyillar

1. **Rolga qarab zichlik.** Tadbirkor — ma'lumot zich; Quruvchi — o'rtacha; Haydovchi — minimal, katta.
2. **Platforma odati > brend.** Tugma shakli, header, picker — foydalanuvchi telefoni qanday bo'lsa shunday. Brend rang va ohangda.
3. **Holat har doim ko'rinadi.** Buyurtma va reys holati — rangli "chip" bilan, matn + ikon (rangga qaramlik yo'q).
4. **Dala sharoiti.** Quyoshda o'qiladigan kontrast, qo'lqop bilan bosiladigan nishonlar (≥ 48 dp), bir qo'lda ishlash.
5. **Tarjima.** Lotin/Kirill/Rus. Matnlar uzun bo'lishini hisobga olib layout cho'ziluvchan.

## 2. Tokenlar

Rang (light):

| Token | Qiymat | Ishlatilishi |
|---|---|---|
| `brand.primary` | `#1B5E3F` (chuqur yashil — "ECO") | asosiy tugma, faol tab |
| `brand.accent` | `#F59E0B` (amber — beton/qurilish) | e'tibor, SLA ogohlantirish |
| `bg.canvas` | `#F6F7F5` | ekran foni |
| `bg.surface` | `#FFFFFF` | kartalar |
| `text.primary` | `#111827` | |
| `text.secondary` | `#6B7280` | |
| `border` | `#E5E7EB` | |
| `status.success` | `#16A34A` | COMPLETED |
| `status.warning` | `#D97706` | SLA / DISPUTED |
| `status.danger` | `#DC2626` | FAILED / REJECTED |
| `status.info` | `#2563EB` | EN_ROUTE |

Dark rejim: `bg.canvas #0F1412`, `bg.surface #1A211D`, matn teskari; brend rang bir tonga ochroq (`#2E8B5E`) — kontrast uchun.

Masshtab: spacing 4-lik (`4, 8, 12, 16, 20, 24, 32`), radius `sm 8 / md 12 / lg 16 / full`, tipografika `display 28 / title 22 / heading 17 / body 15 / caption 13` (iOS) — Android'da +1 sp. Haydovchi rejimi: body 18, tugma 20 semi-bold.

## 3. Primitivlar

`Button` (primary/secondary/ghost/danger; size md/lg/xl), `Card`, `ListItem` (leading/trailing, chevron platformaga qarab), `StatusChip`, `Sheet` (bottom sheet), `Field` (label + input + error, zod bilan), `Stepper` (wizard), `Stat` (KPI kartasi), `MapView` wrapper, `EmptyState`, `Skeleton`, `Toast/Snackbar` (platformaga qarab).

## 4. Ekranlar ro'yxati (MVP)

### Umumiy
- Splash → Telefon kiritish → OTP (6 katak, avto-o'qish SMS Android'da) → Rol tanlash (agar > 1) → Ruxsatlar onboarding (push; haydovchi: joylashuv)

### Tadbirkor
1. **Bosh** — 4 ta KPI (bugun m³, faol reyslar, tasdiq kutayotgan, qarzdorlik), mashinalar holati lentasi, oxirgi hodisalar.
2. **Buyurtmalar** — segment: Kutilmoqda / Bugun / Barchasi; karta: mijoz, marka, hajm, vaqt, holat; swipe: tasdiqlash/rad etish.
3. **Buyurtma tafsiloti** — narxni tahrirlash, vaqt belgilash, "Reyslarga bo'lish" tugmasi → reyslar ro'yxati → har biriga haydovchi/mashina biriktirish (sheet).
4. **Dispetcher** — xarita: barcha faol mashinalar; ro'yxat: bo'sh haydovchilar; drag emas — sheet orqali biriktirish.
5. **Moliya** — mijozlar bo'yicha qarz, to'lov qo'shish (naqd), fakturalar.
6. **Ko'proq** — katalog (markalar/narxlar), mashinalar, xodimlar, tashkilot, hisobotlar, sozlamalar.

### Quruvchi
1. **Bosh** — faol buyurtma kartasi (jonli: "Mashina 12 daq da"), "Beton buyurtma qilish" katta tugma, obyektlar qisqacha.
2. **Buyurtma wizard** — (1) Marka + hajm + nasos; (2) Obyekt (saqlanganlardan yoki xaritadan pin) + sana/vaqt + interval; (3) Ko'rib chiqish + taxminiy narx → Yuborish.
3. **Buyurtma tafsiloti** — timeline (holatlar), reyslar ro'yxati, har reysda: haydovchi, mashina, holat, xaritada ko'rish, **Qabul qilish** (imzo chizish + hajm tasdiqlash + foto).
4. **Obyektlar** — ro'yxat → obyekt: bosqichlar progress, kunlik hisobot qo'shish (foto + matn), material so'rovi.
5. **Moliya** — qarz, to'lash (Payme/Click deep-link), akt-sverka.

### Haydovchi
1. **Bugun** — reyslar ro'yxati (vaqt, obyekt, hajm, marka); navbatdagi reys ustida katta "Qabul qilish".
2. **Faol reys** — ekranning yarmi: xarita + "Navigatsiya" (Yandex/Google ga chiqadi) + "Qo'ng'iroq"; pastki yarmi: **bitta katta holat tugmasi** (keyingi holat nomi bilan: "Yo'lga chiqdim" → "Yetib keldim" → "Tushirishni boshladim" → "Tugatdim"). Kichik: "Muammo" (sheet: nosozlik / yo'l / boshqa + foto).
3. **Yakunlash** — nakladnoy foto, quruvchi imzosi (telefonni uzatadi) yoki SMS-kod, "Yuborish".
4. **Tarix** — o'tgan reyslar, kunlik jami m³.

## 5. Holat ranglari (chip)

| Holat | Rang | Ikon |
|---|---|---|
| DRAFT / SUBMITTED | neytral kulrang | clock |
| CONFIRMED / SCHEDULED / ASSIGNED | info ko'k | calendar |
| LOADING / EN_ROUTE / ARRIVED / UNLOADING | brend yashil | truck |
| COMPLETED / DELIVERED | success | check |
| DISPUTED / SLA_BREACH | warning | alert |
| REJECTED / FAILED / CANCELLED | danger | x |

## 6. Rol skinlari — 3 rol, 3 xil dizayn

Auth ekranlari ECO yashilida (`palette`). Rol tanlangach `ThemeProvider` (`src/design/theme.tsx`) sessiyadagi faol rolga qarab `skins[role]` (`src/design/tokens.ts`) beradi — ekranlar `useTheme().c` va `useTheme().shape` orqali oladi, rolni bilmaydi.

| | Tadbirkor — «Boshqaruv» | Quruvchi — «Qurilish» | Haydovchi — «Kabina» |
|---|---|---|---|
| Asosiy rang | to'q ko'k `#1E3A5F` + amber | terrakota `#C2410C` + teal | yorqin yashil `#22C55E` + sariq |
| Fon | salqin kulrang `#F3F5F9` | qum `#FAF6F0` | doim qorong'i `#070A0F` (`forceDark`) |
| Shakl (card/button/chip) | 10 / 10 / 6 — o'tkir | 22 / 26 / pill — yumaloq | 18 / 18 / 10 |
| Tab bar | ixcham, hairline, 11 pt | suzuvchi «pill» (`tabBarBackground`) | 3 tab, 14 pt qalin, 1.25× ikon |
| Bosh ekran | navy hero (Daromad/Xarajat/Foyda) → KPI | amal plitkalari (Beton · Material) → KPI | holat chirog'i → katta raqamlar → yashil nurli faol yuk |

Kontrast: yorqin fonlar (yashil, apelsin) ustida matn `onColor()` bilan qora tanlanadi; `textOnBrand` har skin uchun alohida. Haydovchi skinini kunduzgi rejimga o'tkazish — `skins.HAYDOVCHI.forceDark` ni olib tashlash (light palitra tayyor).
