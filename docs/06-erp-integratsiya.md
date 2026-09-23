# Insof ERP ↔ Insof ECO integratsiyasi

**Muammo.** Zavod ofisida nakladnoy, sklad va buxgalteriya Insof ERP'da yuritiladi. Haydovchi esa
telefonida Insof ECO ilovasini ishlatadi (reysni qabul qilish, GPS, obyektda mijoz imzosi).
Ikki tizim bir-birini bilmasa, logist ikki joyga yozadi, holatlar farqlanadi.

**Yechim.** ERP — nakladnoy *manbai*; ECO — haydovchi *ijrosi*. Ikkalasi bitta kalit bilan bog'lanadi:
`Delivery.externalRef = ERP nakladnoy raqami` (masalan `N-2026-00012`), `Order.externalRef = ERP zayavka raqami`.

```
ERP (Next.js)                                   ECO API (NestJS)                    Haydovchi ilovasi
─────────────                                   ────────────────                    ─────────────────
Reys yaratildi ──PUT /v1/erp/trips/:ref──────▶  Order+Delivery (ASSIGNED) ──push──▶ "Yangi reys"
"Yuklandi"     ──POST …/status {LOADING}────▶  ACCEPTED→LOADING (avtomatik)        
                                                ◀── Haydovchi: EN_ROUTE, ARRIVED… ◀── tugma bosdi
/api/eco/webhook ◀──POST (HMAC imzo)──────────  delivery.status_changed
Trip: LOADED / ON_ROAD / DELIVERED               COMPLETED (imzo/SMS-kod)
```

## Kirish: integratsiya kaliti (IntegrationClient)

Mobil JWT o'rniga tashqi tizim `X-Api-Key` sarlavhasi bilan kiradi. Kalit **tashkilotga** (zavod) va
**xizmat foydalanuvchisiga** ("Insof ERP (integratsiya)", TADBIRKOR a'zoligi) bog'langan — shuning uchun
`X-Org-Id` kerak emas, hodisalar (DeliveryEvent) esa "Insof ERP" nomidan yoziladi.

- Bazada faqat `sha256(kalit)`; kalit yaratilganda bir marta chop etiladi.
- `JwtAuthGuard` `X-Api-Key` ni ko'rsa IntegrationClient'ni tekshiradi va `req.auth.integration` ni to'ldiradi.
- `/v1/erp/*` controller'i `IntegrationGuard` bilan — JWT sessiya (mobil) bu endpointlarga kira olmaydi.
- Rotatsiya: skript qayta ishga tushirilsa shu nomdagi eski kalit o'chadi.

```bash
yarn workspace @insof/api integration:create -- --org 300000001 --webhook http://erp.example.uz/api/eco/webhook
```

## Endpointlar (`/v1/erp`, X-Api-Key)

| Metod | Yo'l | Vazifa |
|---|---|---|
| GET | `/ping` | ulanish tekshiruvi: tashkilot, klient nomi |
| GET | `/drivers` | HAYDOVCHI a'zolar (tasdiqlangan/kutilayotgan, band/bo'sh, faol reys) |
| PUT | `/drivers` | `{phone, fullName}` — ERP xodimini haydovchi qilib ulash (User+Membership+DriverProfile) |
| GET/PUT | `/vehicles` | mashinalar; PUT — davlat raqami bo'yicha upsert |
| GET | `/trips?date=` | shu kungi + faol integratsiya reyslari |
| GET | `/trips/:ref` | bitta reys (hodisalar bilan) |
| PUT | `/trips/:ref` | reys yaratish/yangilash — idempotent (`ErpTripSchema`) |
| POST | `/trips/:ref/status` | `{to: ACCEPTED\|LOADING\|EN_ROUTE\|COMPLETED\|CANCELLED}` — oraliq bosqichlar avtomatik |
| GET | `/positions` | faol reyslar + oxirgi GPS nuqtasi va ETA (ERP xaritasi shu bo'yicha chiziladi) |
| GET | `/trips/:ref/track` | bitta reysning to'liq izi (polyline) |
| PUT | `/customers` | ERP mijoz kartasi → CONTRACTOR tashkilot + `CreditLimit` (`ErpCustomerSchema`) |
| PUT | `/mixes` | ERP mahsuloti (beton markasi) → `ConcreteMix` (`ErpMixSchema`) |
| PUT | `/materials` | ERP xomashyosi → `Material` (`ErpMaterialSchema`) |
| PUT | `/orders/:ref` | ERP zayavkasi → `Order` + qatorlar, `erpManaged` (`ErpOrderSchema`) |
| PUT | `/invoices/:ref` | ERP schyoti → `Invoice` (zayavka avval yuborilgan bo'lishi kerak) |
| PUT | `/payments/:ref` | ERP to'lovi → `Payment`, kalit `externalId` |

`PUT /trips/:ref` mijoz (CONTRACTOR tashkilot, INN yoki nom bo'yicha), marka (ConcreteMix, grade bo'yicha),
buyurtma (Order, `SCHEDULED`) va mashinani yo'q bo'lsa yaratadi; haydovchini telefon bo'yicha topadi,
topmasa taklif qiladi (birinchi kirishda rol tayyor). Reys boshlangan bo'lsa (ACCEPTED va keyin) —
o'zgartirilmaydi, faqat qaytariladi.

`POST …/status` ERP'dagi tugmalarni aks ettiradi: `LOADING` uchun avval haydovchi nomidan `ACCEPTED`
(faqat haydovchi qila oladigan o'tish) bajariladi. `CANCELLED` — ASSIGNED/ACCEPTED'dan; keyingi bosqichlarda `FAILED`.

## Spravochniklar: ERP — manba, ECO — ko'zgu

ERP mijoz, marka, xomashyo, zayavka, schyot va to'lov kartalarining yagona manbai. ECO ularni faqat
qabul qiladi va ko'rsatadi. Yo'nalish bir tomonlama; teskari tomonda faqat haydovchi harakati qaytadi.

| ERP yozuvi | ECO yozuvi | Kalit |
|---|---|---|
| Mijoz | `Organization` (CONTRACTOR) + `CreditLimit` | `Organization.externalRef` = ERP mijoz id |
| Mahsulot (marka) | `ConcreteMix` | `grade` (M300) |
| Xomashyo | `Material` | `Material.externalRef` = ERP xomashyo id |
| Zayavka | `Order` + `OrderItem` | `Order.externalRef` = zayavka raqami |
| Schyot | `Invoice` | buyurtma (ECO'da schyot buyurtmaga tegishli, `orderId` unique) |
| To'lov | `Payment` | `Payment.externalId` = ERP to'lov id |

Hammasi idempotent. Mijozni izlash tartibi: `externalRef` → INN → nom, shuning uchun ERP'da nom yoki INN
o'zgarsa ham dublikat yaratilmaydi. ERP'da arxivlangan mijoz o'chirilmaydi — `deletedAt` qo'yiladi va
qayta faollashtirilsa tiklanadi.

**`erpManaged`.** ERP'dan to'liq kelgan zayavka shu bayroq bilan belgilanadi: hajm va summa ERP'niki.
Bunday buyurtmada `PUT /trips/:ref` jamini qayta hisoblamaydi (aks holda ERP raqami ustiga qo'shilib ketardi).
Eski, faqat reyslardan yig'ilgan buyurtmalar o'zgarishsiz ishlayveradi (`erpManaged = false`).

## Kuzatuv: ECO → ERP

`GET /positions` faol reyslarni (`ACCEPTED`…`UNLOADING`) qaytaradi. Har birida haydovchi, davlat raqami,
mijoz, manzil va `position` — Redis'dagi oxirgi GPS nuqtasi (`pos:<deliveryId>`, 1 soat TTL) hamda `etaMin`.
Haydovchi ilovani yopsa `position` null bo'ladi, reys ro'yxatda qolaveradi.

## Webhook: ECO → ERP

`delivery.status_changed` hodisasi (faqat `externalRef`li reyslar) klientning `webhookUrl` iga POST qilinadi:

```
X-Eco-Event: delivery.status_changed
X-Eco-Timestamp: <ms>
X-Eco-Signature: sha256=HMAC_SHA256(webhookSecret, "<timestamp>.<body>")
{ externalRef, orderRef, deliveryId, from, to, at, driver, vehiclePlate, loadedM3, acceptedM3, note, location, signed, byIntegration }
```

- 3 urinish (1s/5s/15s); 4xx — qayta urinilmaydi. Yetib bormasa ERP `GET /trips/:ref` bilan o'zi oladi.
- `byIntegration=true` — o'zgarishni ERP'ning o'zi boshlagan (aks-sado); ERP uni faqat holat sifatida yozadi.

ERP tomonida mos: `LOADING→LOADED` (sklad chiqimi), `EN_ROUTE→ON_ROAD`, `COMPLETED→DELIVERED` (zayavka yopiladi),
`CANCELLED→CANCELLED`; `DECLINED/FAILED/DISPUTED` — ogohlantirish sifatida ko'rsatiladi.

## Nima uchun shunday (ADR qisqacha)

- **Kalit — tashkilotga, sessiya emas.** ERP odam emas; OTP/refresh oqimi unga mos emas. Xizmat foydalanuvchisi
  audit uchun kerak (DeliveryEvent.byUserId majburiy).
- **Ikki tomonlama, lekin egalik aniq.** Nakladnoyni faqat ERP yaratadi/bekor qiladi; holatni ikkala tomon
  suradi, ammo haydovchi bosgan bosqich ERP'da avtomatik aks etadi (logist qo'lda takrorlamaydi).
- **Idempotentlik.** `externalRef` unique; status o'tishlarida `clientEventId = erp:<ref>:<to>:<vaqt>`.
- **Koordinatalar.** ERP'da manzil matn; `location` berilmasa 0/0 yoziladi — geofence ishlamaydi,
  haydovchi manzil matni bo'yicha boradi. ERP zayavkasiga koordinata qo'shilsa avtomatik ishlaydi.
