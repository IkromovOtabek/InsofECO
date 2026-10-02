# Insof ECO — App Store va Google Play'ga chiqarish yo'l xaritasi

Yangilangan: 2026-10-02. Holat: EAS loyihasi tayyor, production env o'zgaruvchilari bor, OTA ulangan,
`/maxfiylik` sahifasi ochiq, hisobni o'chirish ilovada bor. Android `preview` APK buildlari chiqqan (1.0.0).
**iOS build hali yo'q — Apple Developer hisobi ochilishi kutilmoqda** (pastda "iOS TestFlight" bo'limi).

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

- [x] Hisobni ilova ichida o'chirish (Apple 5.1.1(v), Play siyosati) — Profil → "Hisobni o'chirish".
- [x] Kamera/galereya ruxsat matnlari haqiqiy ishlatilishga mos: profil rasmi, nakladnoy, yetkazish fotosi, davomat selfisi.
- [ ] Fon joylashuv uchun Play deklaratsiyasi + 30 s video (haydovchi reysi: "Yo'lga chiqdim" → xarita).
- [ ] Skrinshotlar: iPhone 6.7" (1290×2796) va Android telefon, 4–6 ta: do'kon, mahsulot, haydovchi reysi, xarita, bildirishnoma.
- [x] `version` 1.0.0 (`app.config.ts`), runtimeVersion shunga bog'liq.
- [x] Production API sinovi (2026-10-02): `/v1/health` 200, `/v1/auth/login` 422 (validatsiya), `/api/public/shop` 200, `/maxfiylik` 200.
- [ ] App Review uchun demo hisoblar production bazada (mijoz va `reviewer` xodim) — TestFlight tashqi sinovidan oldin.

## iOS TestFlight — qadamma-qadam

**1. Apple Developer Program (foydalanuvchi, 1–2 kun).** developer.apple.com/programs/enroll — Apple ID'da
ikki bosqichli himoya yoqilgan bo'lishi shart, 99 $/yil.
- *Shaxsiy (Individual)* — eng tez. Do'konda sotuvchi sifatida shaxsiy ism ko'rinadi.
- *Tashkilot (Organization)* — do'konda "INSOF ..." ko'rinadi, lekin D-U-N-S raqami kerak (bepul, 5–30 kun).
  Shaxsiy hisobni keyin tashkilotga o'tkazish mumkin (Apple Support orqali), shuning uchun TestFlight uchun
  shaxsiydan boshlab, D-U-N-S ni parallel so'rash mumkin.

**2. Birinchi iOS build (interaktiv, ~20–30 daqiqa).** Apple ID paroli va 2FA kodini foydalanuvchi o'zi kiritadi:
```bash
cd apps/mobile
eas build -p ios --profile production
```
Savollarga javob: Apple hisobiga kirish — *Yes*; Distribution Certificate va Provisioning Profile yaratish — *Yes*
(EAS saqlaydi); **Push Notifications key — *Yes*** (busiz iOS'ga push bormaydi). Bundle ID `uz.insofeco.app`
Apple portalida avtomatik ro'yxatdan o'tadi, Push va Background Modes capability'lari ham.

**3. TestFlight'ga yuborish.**
```bash
eas submit -p ios --latest
```
Birinchi marta App Store Connect'da "Insof ECO" ilova yozuvini yaratishni taklif qiladi — *Yes*. Nom band bo'lsa
"Insof ECO — Beton" kabi boshqa nom so'raladi (do'kondagi nomni keyin o'zgartirsa bo'ladi). Yuborilgach
`ascAppId` ni `eas.json` → `submit.production.ios` ga yozib qo'ying — keyingi submitlar savolsiz o'tadi.

**4. App Store Connect → TestFlight.** Build 10–30 daqiqada "Processing" dan chiqadi. Eksport muvofiqligi
savoli chiqmaydi (`usesNonExemptEncryption: false`).
- *Ichki sinovchilar* (100 tagacha, App Store Connect foydalanuvchilari) — review'siz, darhol.
- *Tashqi sinovchilar* (10 000 tagacha, ommaviy havola bilan) — Beta App Review (odatda 1 kun). Kerak:
  sinov tavsifi, fikr-mulohaza emaili, demo hisob (pastdagi "Review uchun izohlar"), maxfiylik siyosati URL.

**5. Keyingi relizlar.** JS o'zgarishi — `eas update --channel production` (TestFlight buildiga ham yetadi).
Native o'zgarish — `eas build -p ios --profile production --auto-submit` (buildNumber o'zi oshadi).
Ommaviy TestFlight havolasini ERP'dagi `ECO_APP_URL` ga qo'yish mumkin (taklif SMS'idagi havola).

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
