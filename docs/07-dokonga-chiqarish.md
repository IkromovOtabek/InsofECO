# Insof ECO — relizlar va do'konlarga chiqarish

Yangilangan: 2026-10-05. Joriy versiya: **1.0.1** (`app.config.ts`), `runtimeVersion: appVersion` — 1.0.1 buildlari
faqat 1.0.1 OTA'larini oladi, 1.0.0 o'rnatilgan telefonlar yangi APK/build'siz 1.0.1 JS'ini OLMAYDI.
Holat: production API (`https://api.insof-erp.uz/v1/health`) va `/maxfiylik`, `/maxfiylik/hisobni-ochirish` 200.
Android 1.0.0 APK xodimlarda; iOS build hali yo'q (Apple Developer hisobi kutilmoqda).

## ⛔ Do'konga chiqishdan oldin yopilishi shart (bloklovchi)

| # | Muammo | Kim |
|---|---|---|
| 1 | **Google Play targetSdk.** Expo SDK 52 (RN 0.76) `targetSdkVersion 34` beradi. Play yangi ilova/yangilanish uchun API 35 (2025-08-31 dan), 2026-08-31 dan **API 36** talab qiladi; Android 15+ uchun 16 KB sahifa o'lchami ham shart. APK (ERP orqali) va TestFlight'ga ta'siri yo'q. Yechim: Expo SDK 54+ ga ko'tarish (RN 0.81, Yandex MapKit 16 KB mos versiya), keyin `expo-build-properties` bilan target 36. | Dasturchi |
| 2 | **Android push.** `google-services.json` yo'q → Android'da Expo push token olinmaydi, bildirishnoma kelmaydi. Firebase → `uz.insofeco.app` → faylni EAS'ga `eas env:create --environment production --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json`, FCM V1 kalitini `eas credentials` ga. `app.config.ts` uni o'zi ulaydi. Keyin yangi build. | Siz |
| 3 | **Demo hisoblar** production bazada: mijoz (telefon + parol, SMS'siz kiradi) va ERP xodim (haydovchi, reys bilan). `08-app-store-matnlari.md` dagi `<…>` joylarini to'ldiring. | Siz |
| 4 | **Play fon joylashuv deklaratsiyasi** + 30 s video ("Yo'lga chiqdim" → tushuntirish oynasi `src/core/bg-disclosure.ts` → "Har doim ruxsat" → xarita). | Siz |
| 5 | Skrinshotlar: iPhone 6.9"/6.7" (1290×2796) va Android telefon, 4–6 ta. | Siz |

## 1.0.1 reliz tartibi (har relizda shu ketma-ketlik)

**Tartib: ECO API → ERP → ilova.** Server avval yangi va eski ilovani birga qabul qiladi, keyin ilova chiqadi.
`scripts/deploy.sh` (ERP repo) ERP'ni OLDIN, ECO'ni KEYIN yangilaydi — shuning uchun ECO'ni alohida birinchi qiling:

```bash
# 1) ECO API (serverda, deploy foydalanuvchisi)
cd /var/www/insof-eco && git pull --ff-only
yarn install --frozen-lockfile && yarn workspace @insof/shared build
cd apps/api && npx prisma migrate deploy && npx prisma generate && npx nest build   # migratsiya restartdan OLDIN
sudo systemctl restart insof-eco
for i in $(seq 1 30); do curl -fsS -o /dev/null http://127.0.0.1:3010/v1/health && break; sleep 2; done   # 60 s gacha
bash /var/www/insof-eco/infra/smoke.sh   # ixtiyoriy

# 2) ERP (ECO'ga qayta tegmaydi)
cd /var/www/insof-erp && SKIP_ECO=1 bash scripts/deploy.sh

# 3) Ilova — pastdagi "Ilovani tarqatish"
```

ECO uchun avtomatik rollback yo'q: `nest build` joyida (`dist/`) yoziladi. Qaytarish: `git checkout <oldingi sha>` →
build → restart. Migratsiyalar orqaga qaytmaydi — faqat kengaytiruvchi migratsiya (ustun qo'shish) yozing.

### Koordinata bayroqlari (geofence) — bosqichma-bosqich

| Bayroq | Qayerda | Hozir |
|---|---|---|
| `SITE_COORDS_REQUIRED` | ECO `apps/api/.env` | `false` |
| `MOBILE_SITE_COORDS_REQUIRED` | ERP `tenants/*.env` | `false` |

1. Server `false` bilan chiqadi: 1.0.1 koordinata yuboradi (300 m tekshiriladi), 1.0.0 koordinatasiz ham reysni yopadi.
2. 1.0.1 APK/build HAMMA haydovchida o'rnatilgach (logist ro'yxat bo'yicha tekshiradi) — avval ERP'da
   `MOBILE_SITE_COORDS_REQUIRED=true` (restart), bir kun kuzating, keyin ECO'da `SITE_COORDS_REQUIRED=true`.
3. Eski ilova shundan keyin "yetkazdim" da xato oladi (ERP 426, ECO 4xx) — ilovada majburiy yangilash ekrani yo'q,
   shuning uchun 2-qadamni shoshirmang. Muammo bo'lsa bayroqni `false` ga qaytarish yetarli (restart).

## Ilovani tarqatish

**Muhit o'zgaruvchilari (EAS → production):** `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ERP_URL`,
`EXPO_PUBLIC_YANDEX_MAPKIT_KEY`, `EXPO_PUBLIC_YANDEX_GEOSUGGEST_KEY`, `EXPO_PUBLIC_YANDEX_GEOCODER_KEY` — bor
(2026-10-05, `eas env:list --environment production`). Qo'shish kerak: `GOOGLE_SERVICES_JSON` (file).
`preview` profili ham `environment: production` ni oladi. Namuna: `apps/mobile/.env.example`.

| Kanal | Buyruq | Kimga |
|---|---|---|
| Android APK (ERP orqali) | `eas build -p android --profile preview` → APK'ni serverga `…/uploads/app/insof-eco.apk` (yoki `tenants/insof.env` → `APK_PATH`) | Xodimlar: ERP → `/api/app/android`; taklif SMS'idagi `ECO_APP_URL` |
| TestFlight | `eas build -p ios --profile production --auto-submit` | Xodimlar, sinovchilar |
| Play internal | `eas build -p android --profile production` → `eas submit -p android --profile production` (track `internal`, `draft`) | Ichki sinov (targetSdk bloklovchisi yopilgach) |
| OTA (faqat JS) | `eas update --channel production --environment production --message "..."` | 1.0.1 o'rnatilganlar |

- ⚠️ `eas update` ni **har doim `--environment production`** bilan: busiz lokal `apps/mobile/.env` (Wi-Fi IP) to'plamga
  yoziladi va production ilova LAN manzilga ulanadi.
- Native o'zgarish (kutubxona, ruxsat, plugin, ikonka, ovoz) → `version` ni oshiring (1.0.2) va yangi build; OTA emas.
- Android keystore: EAS'da (remote, `appVersionSource: remote`, `autoIncrement`). `eas credentials -p android` →
  keystore'ni yuklab, parol menejerida saqlang — yo'qolsa Play'ga yangilanish chiqmaydi.
- iOS push: birinchi `eas build -p ios` da "Push Notifications key" — *Yes* (APNs .p8 kalit EAS'da saqlanadi;
  `aps-environment` entitlement `expo-notifications` plugini qo'shadi).
- Play `submit` uchun `apps/mobile/google-play-service-account.json` (git'da yo'q) kerak.

## Reliz oldi tekshiruv ro'yxati (1.0.1)

- [x] `version` 1.0.1, `runtimeVersion: appVersion`, bundle/package `uz.insofeco.app`, `ITSAppUsesNonExemptEncryption=false`.
- [x] Ruxsat matnlari o'zbekcha va haqiqiy: kamera, galereya, joylashuv (when-in-use / always). Mikrofon so'ralmaydi
  (`microphonePermission: false`), Face ID yo'q.
- [x] iOS `PrivacyInfo.xcprivacy` (`ios.privacyManifests`): UserDefaults, FileTimestamp, SystemBootTime, DiskSpace.
- [x] Android: `ACCESS_BACKGROUND_LOCATION` + `FOREGROUND_SERVICE_LOCATION` (Android 14), `POST_NOTIFICATIONS`,
  navigator `<queries>`; bildirishnoma ikonkasi — oq siluet (`adaptive-icon.png`), rang `#0b4fd6`.
- [x] Fon joylashuv tushuntirish oynasi tizim so'rovidan OLDIN (`src/core/bg-disclosure.ts`, ECO va ERP haydovchi).
- [x] Hisobni o'chirish: ECO — Sozlamalar/Profil → "Hisobni o'chirish" (mijoz darhol, haydovchi — direktor tasdig'i);
  ERP xodim — Menyu → "Hisobni o'chirish" (so'rov direktorga). Veb: `/maxfiylik/hisobni-ochirish`.
- [x] Maxfiylik siyosati ilovadan ochiladi: Sozlamalar → "Maxfiylik siyosati", ro'yxatdan o'tishda rozilik havolasi.
- [ ] Demo hisoblar (bloklovchi #3), Play deklaratsiya (#4), skrinshotlar (#5).
- [ ] Haqiqiy telefonda: kirish (ECO va ERP), reys "Yo'lga chiqdim" → fon joylashuv → "Yetkazdim", push (Android ham), foto yuklash, hisobni o'chirish.
- [ ] Server: `infra/backup.sh` cron'da (pastda), ECO health ERP `health-watch.sh` ga qo'shilgan.

## Server: zaxira, loglar, kuzatuv

- **Zaxira:** ERP `server-backup.sh` ECO bazasini OLMAYDI. ECO uchun `infra/backup.sh` (pg_dump + avatarlar + MinIO,
  14 kun): `45 2 * * * /var/www/insof-eco/infra/backup.sh >> /var/log/insof-eco-backup.log 2>&1`. Server tashqarisiga
  nusxa — ERP backup'ining rclone/restic manziliga `/var/backups/insof-eco` ni qo'shing. Oyda bir marta tiklashni sinang.
- **Loglar:** API — journald (`journalctl -u insof-eco`); docker xizmatlari — `json-file` 20 MB × 5
  (`infra/docker-compose.prod.yml`, `up -d` bilan qayta yaratilganda kuchga kiradi).
- **Kuzatuv:** ERP `health-watch.sh` faqat ERP'ni tekshiradi — ECO `http://127.0.0.1:3010/v1/health` ni ham qo'shing.
  Crash hisobotlari (Sentry yoki muqobil) mobil va API'da yo'q — ilova yiqilishi faqat foydalanuvchi aytganda ma'lum bo'ladi.

## iOS TestFlight — qadamma-qadam

**1. Apple Developer Program (foydalanuvchi, 1–2 kun).** developer.apple.com/programs/enroll — Apple ID'da
ikki bosqichli himoya yoqilgan bo'lishi shart, 99 $/yil.
- *Shaxsiy (Individual)* — eng tez. Do'konda sotuvchi sifatida shaxsiy ism ko'rinadi.
- *Tashkilot (Organization)* — do'konda "INSOF ..." ko'rinadi, lekin D-U-N-S raqami kerak (bepul, 5–30 kun).
  Shaxsiy hisobni keyin tashkilotga o'tkazish mumkin (Apple Support orqali), shuning uchun TestFlight uchun
  shaxsiydan boshlab, D-U-N-S ni parallel so'rash mumkin.

**Qaror (2026-10-02): hozir Shaxsiy hisob → TestFlight; D-U-N-S parallel; kelgach o'sha hisobni tashkilotga o'tkazish.**
- D-U-N-S: developer.apple.com/enroll/duns-lookup — bepul, yuridik nom ro'yxatdagidek lotincha.
- O'tkazish: developer.apple.com/contact → Membership → "migrate account" so'rovi. Talab: so'rovchi tashkilot
  asoschisi/hammuassisi bo'lishi; biznes hujjatlari so'ralishi mumkin.
- ⚠️ **Alohida yangi tashkilot hisobi OCHMANG.** Ilovani boshqa hisobga ko'chirish (App Transfer) faqat App Store'da
  kamida bitta versiyasi chiqqan ilova uchun ishlaydi — faqat TestFlight'dagi ilova ko'chmaydi va
  `uz.insofeco.app` bundle ID shaxsiy hisobda qolib ketadi.
- TestFlight buildi 90 kun yashaydi — D-U-N-S kechiksa, yangi build yuboriladi (OTA yangilanishlar ham yetadi).

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

**5. Keyingi relizlar.** JS o'zgarishi — `eas update --channel production --environment production` (TestFlight buildiga ham yetadi).
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

To'liq inglizcha matn va demo hisob maydonlari — `08-app-store-matnlari.md` → "App Review Information".
Mijoz demo hisobi telefon + parol bilan kiradi (SMS kod kerak emas); xodim — login/parol ("Login va parol bilan kirish").
Fon joylashuv faqat haydovchi rolida, reys ochiq paytda.

## Buyruqlar

```bash
cd apps/mobile
# Android — xodimlar uchun APK (do'konsiz, ERP orqali tarqatiladi)
eas build -p android --profile preview

# Do'kon buildlari
eas build -p android --profile production
eas build -p ios --profile production --auto-submit

# Yuborish
eas submit -p android --profile production
eas submit -p ios --profile production

# JS o'zgarishi (buildsiz) — --environment SHART
eas update --channel production --environment production --message "..."
```
