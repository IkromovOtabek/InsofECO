# Insof ECO — App Store va Google Play'ga chiqarish yo'l xaritasi

Yangilangan: 2026-09-28. Holat: EAS loyihasi tayyor, production env o'zgaruvchilari bor, OTA ulangan,
`/maxfiylik` sahifasi ochiq. **Hali birorta EAS build qilinmagan.** Hisobni o'chirish funksiyasi yozilmoqda.

## Muddat (real baho)

| Yo'l | Kimga | Qachon qo'lda bo'ladi |
|---|---|---|
| Android APK (EAS `preview`) — do'konsiz, to'g'ridan-to'g'ri o'rnatish | Zavod xodimlari (haydovchi, brigadir, logist) | 1–2 kun |
| iOS TestFlight (Apple hisobi kerak) | Xodimlar va sinovchi mijozlar, 10 000 kishigacha | Apple hisobi tayyor bo'lgach 2–3 kun |
| Google Play — ochiq nashr | Mijozlar (do'kon) | Tashkilot hisobi: 1–2 hafta. Shaxsiy hisob: kamida 3–4 hafta (12 sinovchi × 14 kun yopiq test shart) |
| App Store — ochiq nashr | Mijozlar (do'kon) | Hisob bor bo'lsa 1 hafta. Shaxsiy hisob ochish +2–3 kun. Tashkilot (D-U-N-S) +2–4 hafta |

Xulosa: **xodimlar 1–2 kunda production'da ishlay oladi** (APK + TestFlight), do'konlar orqali mijozlar uchun
**2–4 hafta** — asosan hisob tekshiruvi va do'kon reviewiga ketadi, kodga emas.

## Foydalanuvchi qiladigan ishlar (kod bilan hal bo'lmaydi)

1. **Apple Developer Program** — developer.apple.com, 99 $/yil. Shaxsiy hisob 1–2 kunda ochiladi.
   Tashkilot nomidan bo'lsa D-U-N-S raqami kerak (bepul, 5–30 kun).
2. **Google Play Console** — play.google.com/console, 25 $ bir marta. Shaxsiy hisobda ID tekshiruvi 1–3 kun,
   lekin **12 sinovchi 14 kun uzluksiz** yopiq test shart. Tashkilot hisobi (D-U-N-S) bu talabdan ozod.
   Tavsiya: tashkilot hisobi.
3. **Firebase loyihasi** (Android push uchun): console.firebase.google.com → Android ilova `uz.insofeco.app` →
   `google-services.json` ni `apps/mobile/` ga qo'yish, FCM V1 xizmat hisobini `eas credentials` ga yuklash.
4. **Google Maps release SHA-1**: birinchi `eas build -p android --profile production` dan keyin
   `eas credentials` → SHA-1 → Google Cloud `insof-eco` → API kalit cheklovlariga qo'shish.
5. Birinchi build interaktiv: `eas build -p android --profile production` (keystore yaratadi),
   `eas build -p ios --profile production` (Apple ID bilan kiradi, sertifikat yaratadi).

## Kod tomonida qolgan ishlar

- [ ] Hisobni ilova ichida o'chirish (Apple 5.1.1(v), Play siyosati) — yozilmoqda (AccountDeletionRequest).
- [ ] `NSCameraUsageDescription` — kamera ishlatilmasa olib tashlash (review savol beradi).
- [ ] Fon joylashuv uchun Play deklaratsiyasi + 30 s video (haydovchi reysi: "Yo'lga chiqdim" → xarita).
- [ ] Skrinshotlar: iPhone 6.7" (1290×2796) va Android telefon, 4–6 ta: do'kon, mahsulot, haydovchi reysi, xarita, bildirishnoma.
- [ ] `version` 0.2.0 → 1.0.0 (`app.config.ts`), runtimeVersion shunga bog'liq.
- [ ] Production API sinovi: `https://api.insof-erp.uz` va `https://insof-erp.uz` ilova so'rovlariga javob berishi (`/v1/auth/login`, `/api/public/shop`).

## Do'kon ro'yxati matnlari (uz)

**Nomi:** Insof ECO
**Qisqa tavsif (80):** Beton zavodi do'koni, buyurtma va reysni jonli kuzatish

**To'liq tavsif:**
Insof ECO — tayyor beton va temir-beton mahsulotlarini buyurtma qilish va yetkazishni kuzatish ilovasi.

Mijozlar uchun:
• Zavod mahsulotlari va narxlari — ro'yxatdan o'tmasdan ko'ring
• Buyurtma bering — sotuv bo'limi qo'ng'iroq qiladi
• Zayavkalaringiz holati va mikserning xaritadagi joyi
• Yetkazilganda bildirishnoma

Zavod xodimlari uchun (login bilan):
• Haydovchi: reyslar, marshrut, "Yetkazdim" tasdig'i
• Sotuv, logistika, sklad, ishlab chiqarish — o'z bo'limi
• Push bildirishnomalar

Joylashuv faqat faol reys vaqtida, haydovchi "Yo'lga chiqdim" bosganidan "Yetkazdim" gacha ishlatiladi.

**Kategoriya:** Business. **Maxfiylik siyosati:** https://insof-erp.uz/maxfiylik
**Hisobni o'chirish URL:** https://insof-erp.uz/maxfiylik/hisobni-ochirish

## Review uchun izohlar (App Review Notes / Play "App access")

Demo hisob: mijoz — telefon +998 90 000 00 01 / parol (reviewer uchun alohida yaratiladi);
xodim — login `reviewer` (SALES). Fon joylashuv: faqat DRIVER roli, reys ochiq paytda.

## Buyruqlar

```bash
# Android — xodimlar uchun APK (do'konsiz)
eas build -p android --profile preview

# Do'kon buildlari (birinchi marta interaktiv)
eas build -p android --profile production
eas build -p ios --profile production

# Yuborish
eas submit -p android --profile production
eas submit -p ios --profile production

# JS o'zgarishi (buildsiz)
eas update --channel production --message "..."
```
