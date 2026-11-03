# App Store matnlari (App Store Connect uchun)

App Store Connect tillari ro'yxatida o'zbek tili yo'q. Asosiy til — **Russian**, qo'shimcha — **English (U.S.)**.
O'zbekcha matn Google Play uchun `07-dokonga-chiqarish.md` da.

Belgilar soni tekshirilgan (limitlar qavsda).

**Holat (2026-11-03).** Review'ga yuboriladigan build — **1.1.0 (33)**, TestFlight'da VALID; undan keyin native o'zgarish
yo'q (`git diff 9daad3f..HEAD -- apps/mobile/app.config.ts package.json plugins` bo'sh), JS tuzatishlar OTA bilan yetadi.
Hisob — **Individual** (D-U-N-S'siz, 2026-10-02 qarori): do'konda sotuvchi sifatida shaxsiy ism chiqadi, "Insof" emas.
Shu sababli review 5.2.1 (brend egasi boshqa) bilan rad etmasligi uchun zavod ishonchnomasi biriktiriladi — pastda
"Ishonchnoma" bo'limi. iOS'da Telegram bot orqali kirish yo'q (4.8-band, `TELEGRAM_LOGIN` — `src/features/auth/telegram.ts`).

## Umumiy maydonlar

| Maydon | Qiymat |
|---|---|
| Name (30) | Insof ECO |
| Primary category | Business |
| Secondary category | Navigation (ixtiyoriy) |
| Support URL | https://insof-erp.uz |
| Marketing URL | https://insof-erp.uz |
| Privacy Policy URL | https://insof-erp.uz/maxfiylik |
| Copyright | 2026 Insof beton zavodi |
| Age rating | Yangi so'rovnoma: Messaging and Chat — **Yes**, User-Generated Content — **Yes** (ichki chat, izoh va baho — faqat bitta tashkilot a'zolari o'rtasida); Unrestricted Web Access, Advertising, Gambling, Medical — **No**; kontent savollari — **None**. Yosh chegarasini Apple o'zi hisoblaydi |
| Price | Free |

---

## Russian (asosiy)

**Subtitle (30):** Бетон: заказ и доставка

**Promotional text (170):**
Каталог бетона и ЖБИ завода без регистрации. Оформите заказ за минуту и следите за миксером на карте в реальном времени.

**Keywords (100):**
бетон,ЖБИ,миксер,доставка,завод,заказ,стройка,раствор,beton,zavod,qurilish,yetkazish,buyurtma

**Description (4000):**
Insof ECO — приложение бетонного завода Insof для заказа товарного бетона и железобетонных изделий и отслеживания доставки.

Для клиентов:
• Каталог продукции завода с ценами — без регистрации
• Заказ в пару нажатий — отдел продаж перезвонит и уточнит детали
• Статус ваших заявок в одном месте
• Миксер на карте в реальном времени — видно, когда он приедет
• Уведомление, когда бетон доставлен

Для сотрудников завода (вход по логину):
• Водитель: рейсы, маршрут на карте, подтверждение «Доставлено»
• Продажи, логистика, склад, производство — каждый видит свой раздел
• Учёт рабочего времени: отметка «Пришёл / Ушёл» со сканированием лица в приложении
• Push-уведомления о новых заявках и изменениях

Фоновая геолокация используется только во время активного рейса водителя — с момента «Выехал» до «Доставлено». При отметке «Пришёл / Ушёл» местоположение сотрудника фиксируется один раз. Сканирование лица применяется только для учёта рабочего времени сотрудников завода — у клиентов его не запрашивают.

Аккаунт можно удалить в любой момент: Профиль → «Удалить аккаунт».

**What's New:** первый выпуск в App Store — App Store Connect это поле не запрашивает.

---

## English (U.S.)

**Subtitle (30):** Concrete orders & delivery

**Promotional text (170):**
Browse the plant's concrete and precast catalog without signing up. Place an order in a minute and track the mixer truck live on the map.

**Keywords (100):**
concrete,ready-mix,precast,mixer,delivery,construction,order,plant,tracking,beton,qurilish

**Description:**
Insof ECO is the official app of the Insof concrete plant for ordering ready-mix concrete and precast products and tracking delivery.

For customers:
• Browse the plant's products and prices — no sign-up needed
• Order in a few taps — the sales team calls back to confirm details
• See the status of all your orders in one place
• Watch the mixer truck on the map in real time
• Get notified when your concrete is delivered

For plant staff (login required):
• Drivers: trips, route map, "Delivered" confirmation
• Sales, logistics, warehouse, production — each role sees its own section
• Attendance: check in / check out with an in-app face scan
• Push notifications about new orders and changes

Background location is used only during a driver's active trip — from "On my way" until "Delivered". When staff check in or out, their location is recorded once. Face scanning is used only for plant staff attendance — customers are never asked for it.

You can delete your account at any time: Profile → "Delete account".

**What's New:** first App Store release — App Store Connect does not ask for this field.

---

## App Review Information (inglizcha — reviewer shuni o'qiydi)

**Sign-in required:** Yes

**Demo account 1 — customer:**
User name: `<prod ECO'da yaratilgan mijoz telefoni>`  Password: `<parol>`

**Demo account 2 — plant staff (driver):** "Notes" ga yoziladi (ikkinchi hisob maydoni yo'q).

**Notes:**
```
Insof ECO is the customer and staff app of Insof concrete plant (Uzbekistan). The UI is in Uzbek.
The app is published under an individual developer account by the plant's developer, with the plant's written
permission to use the "Insof" name and to publish the app on its behalf — see the attached authorization letter.

1) Shop (no login): the app opens on the plant catalog. Tap a product -> "Buyurtma berish" (Order) to send an order request.

2) Customer account (credentials above): "Kirish" (Sign in) -> switch to the "Login va parol" (Login and password)
   tab -> enter the phone number and password. The "Telefon raqam" tab sends a one-time code to the user's
   Telegram, so please use the password tab. Tabs show orders ("Zayavkalar") and live delivery tracking on the map.

3) Staff account (driver role):
   Login: <login>   Password: <parol>
   Same "Login va parol" tab — a login that is not a phone number signs in to the plant staff system.
   The driver sees assigned trips. Background location is used ONLY while a trip is active:
   it starts when the driver taps "Yo'lga chiqdim" (On my way) and stops at "Yetkazdim" (Delivered).
   Before starting, the app shows an explanation screen. The customer and dispatcher see the truck on the map.

   Attendance ("Keldim / Ketdim" — check in / check out) uses an in-app camera face scan, for plant staff only.
   An employee's face is enrolled in person by the plant's HR department with the employee's consent, so the
   demo account has no enrolled face and the scan will answer "not recognized" — this is expected. The scan is
   not Face ID: the frame is compared on the plant's own server with the enrolled face template, used only for
   attendance and never for advertising. Customers are never asked for a face scan.

   Chat ("Xabarlar") is limited to members of the same organization; there is no public user-to-user content.

4) Account deletion: customer — Settings ("Sozlamalar") or Profile -> "Hisobni o'chirish" (Delete account), deleted
   immediately. Staff (login) — "Menyu" tab -> "Hisobni o'chirish": staff accounts are created by the plant director,
   so deletion sends a request that the director approves.
   Web form: https://insof-erp.uz/maxfiylik/hisobni-ochirish
```

## App Privacy (so'rovnoma)

Haqiqiy to'planadigan ma'lumot (kod bo'yicha tekshirilgan, 2026-11-03). Data Used to Track You: **No**.
Hammasi "Linked to you", maqsadi **App Functionality** (Apple'da firibgarlikka qarshi tekshiruv ham shu maqsadga
kiradi). Third-party SDK reklama/analitika yo'q (Sentry DSN hali berilmagan). Matn https://insof-erp.uz/maxfiylik
bilan bir xil bo'lsin.

| Tur | Nima uchun |
|---|---|
| Contact Info → Name, Phone Number | Hisob, buyurtma bo'yicha qo'ng'iroq |
| Location → Precise Location | Haydovchi reysi (faqat faol reys, fon rejimida ham), obyekt manzilini tanlash, "Keldim/Ketdim" da ish hududi tekshiruvi |
| Sensitive Info | Xodim yuzining 128 sonli raqamli namunasi (biometrik) — davomatni tasdiqlash. Faqat zavod xodimlari |
| User Content → Photos or Videos | Profil rasmi, nakladnoy/yetkazish/joy fotosi, davomat yuz kadri (xodim) |
| User Content → Other User Content | Buyurtma izohlari, ichki xabarlar |
| Identifiers → User ID, Device ID | Hisob (Telegram identifikatori ham, Android); qurilma ID — sessiya, push, davomat qurilmasi |
| Purchases → Purchase History | Buyurtmalar va to'lov qaydlari tarixi |

Uchinchi tomon xizmati: nakladnoy surati AI xizmatiga (Anthropic/OpenAI/Groq) matnni o'qish uchun ketadi — Apple
ta'rifida bu ilova nomidan ishlaydigan xizmat (service provider), "tracking" yoki "shared" emas. Prod'da
`FACE_AI_FALLBACK=true` bo'lsa, ro'yxatga olinmagan xodimning yuz kadri ham shu xizmatga ketadi — siyosat sahifasi
buni o'zi ko'rsatadi, so'rovnomada Photos qatori o'zgarmaydi.

Yig'ilmaydi: kontaktlar, mikrofon/audio, sog'liq, moliyaviy karta ma'lumoti (to'lov ilovada emas), brauzer tarixi,
reklama ID. Agar crash hisobotchi (Sentry) qo'shilsa — "Diagnostics → Crash Data" ni ham belgilang.

## Ishonchnoma (Guideline 5.2.1 — sotuvchi nomi brenddan farq qiladi)

Individual hisobda sotuvchi — shaxsiy ism, ilova esa "Insof" nomi va logotipi bilan. Review buni ko'pincha 5.2.1 bilan
qaytaradi. Oldini olish: zavod rahbari imzolagan va muhr bosilgan xatni PDF qilib **App Review Information →
Attachment** ga qo'yish. Matn inglizcha (reviewer o'qiydi), `<…>` joylarini to'ldiring:

```
<Kompaniyaning yuridik nomi, lotincha — masalan "INSOF BETON" MChJ>
<Yuridik manzil>   STIR (INN): <…>
<Sana>

To: Apple Inc., App Review

AUTHORIZATION LETTER

<Kompaniya nomi> ("the Company") owns the "Insof" trade name and logo and operates the Insof concrete plant
in Tashkent region, Uzbekistan.

The Company authorizes <Developer full name, as in the Apple Developer account>, the developer of the Company's
software, to publish and maintain the iOS application "Insof ECO" (bundle ID uz.insofeco.app) on the App Store
under his/her individual Apple Developer account, and to use the "Insof" name and logo in the application and its
App Store listing.

The application is the Company's official app for its customers and employees. All data collected by the app is
processed on the Company's servers in accordance with the privacy policy at https://insof-erp.uz/maxfiylik.

<Director full name>
Director, <Kompaniya nomi>
Signature: ____________        Stamp
Contact: <email>, <telefon>
```

Agar dasturchi kompaniyaning o'zi asoschisi bo'lsa, xat baribir kerak — Apple hujjat bilan tasdiqni so'raydi.
Keyinchalik hisob Organization'ga o'tkazilsa (D-U-N-S bilan), sotuvchi nomi kompaniya nomiga almashadi va bu xat
endi kerak bo'lmaydi.

## Google Play — Data safety

| Bo'lim | Javob |
|---|---|
| Ma'lumot to'planadimi / ulashiladimi | To'planadi; uchinchi tomonga **ulashilmaydi** (zavod — ilova egasi). Nakladnoy surati AI xizmatiga (Anthropic/OpenAI/Groq) ketadi — Play ta'rifida bu "service provider", ulashish emas |
| Shifrlash (in transit) | Ha (HTTPS) |
| O'chirish so'rovi | Ha — ilovada va https://insof-erp.uz/maxfiylik/hisobni-ochirish |
| Location → Precise, Approximate | App functionality; fon rejimida — faqat faol reys; "Keldim/Ketdim" da ish hududi tekshiruvi |
| Personal info → Name, Phone number, User IDs | Account management, App functionality (User IDs — Telegram identifikatori ham) |
| Personal info → Other info | Yuzning 128 sonli raqamli namunasi (biometrik) — App functionality, Fraud prevention (davomat). Majburiy, ixtiyoriy emas |
| Photos and videos → Photos | App functionality — profil, nakladnoy, yetkazish, joy rasmi; davomatdagi yuz kadri ham shu yerda. Ixtiyoriy belgilamang: yuz kadri davomat uchun majburiy |
| Messages → Other in-app messages | App functionality |
| Financial info → Purchase history | App functionality |
| App info → Crash logs | Yo'q (Sentry qo'shilsa — Ha) |
| Device or other IDs | App functionality (push, sessiya) |

Play Console → App content: **Location permissions** deklaratsiyasi (fon joylashuv, video), **Foreground service**
(`location` turi: "faol reysda haydovchi joylashuvini dispetcherga uzatish"), Target audience 18+, Ads — No.
Jadval https://insof-erp.uz/maxfiylik bilan bir xil bo'lsin — Play ikkalasini solishtiradi; siyosat o'zgarsa shu ham.
