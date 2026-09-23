# 05 · ECO System — biznes modeli va rollar aro oqim

```
                        ECO SYSTEM
        ┌───────────────┼────────────────┐
    TADBIRKOR         QURUVCHI         HAYDOVCHI
   Biznesni         Ishlarni          Tashish
   boshqarish       bajarish          xizmatlari
        └───────────────┼────────────────┘
                 BUYURTMA / LOYIHA
          ┌─────────────┼─────────────┐
       Material      Quruvchi      Haydovchi
          └─────────────┼─────────────┘
                  HISOB-KITOB
```

## 1. Asosiy entity'lar (Prisma)

| Guruh | Modellar |
|---|---|
| Identity | User, Organization, Membership (rol), WorkerProfile, DriverProfile |
| Loyiha | Project (budget, spent, progress, deadline), ProjectMember, Task, Document |
| Buyurtma | WorkOrder (Tadbirkor → Quruvchi, narx/muddat), Order (beton — 1-bosqich) |
| Material | Material, Warehouse, InventoryItem, MaterialRequest |
| Logistika | Shipment (yuk), Vehicle, Delivery (beton mikser) |
| Moliya | Expense, Income (isExpected), Payout (quruvchi/haydovchi daromadi), Invoice/Payment (beton) |
| Aloqa | Conversation (DIRECT/GROUP/PROJECT), Message, Notification |
| Sifat | Review (scoreOverall/time/manner) |

Keyingi bosqich: Supplier, Subcontractor, PurchaseOrder, Quotation, Attendance, Salary, Equipment, Maintenance, SafetyReport, QualityControl.

## 2. Holat zanjirlari

**Ish buyurtmasi:** `NEW → ACCEPTED → WORKER_ASSIGNED → IN_PROGRESS → REVIEW → DONE → PAID` (`CANCELLED` — NEW/ACCEPTED/WORKER_ASSIGNED dan).
**Material so'rovi:** `PENDING → APPROVED → LOADING → DELIVERED → CONFIRMED` (`REJECTED`).
**Yuk:** `NEW → ACCEPTED → LOADING → EN_ROUTE → DELIVERED → CONFIRMED`.
**Vazifa:** `TODO → IN_PROGRESS → REVIEW → DONE` (progress = DONE / jami).

## 3. "Sement kerak" — bitta amal, to'rt tizim

```
Quruvchi   POST /material-requests {project, material, 20 qop}         → PENDING   · push Tadbirkorga
Tadbirkor  POST /material-requests/:id/approve {driver, vehicle}       → APPROVED  · Shipment NEW/ASSIGNED · push Quruvchi+Haydovchi
Haydovchi  POST /shipments/:id/transition ACCEPTED → LOADING → EN_ROUTE → DELIVERED (foto, joylashuv, qabul qiluvchi)
Quruvchi   POST /shipments/:id/transition CONFIRMED
System     bitta tranzaksiya:  Inventory −20 · MaterialRequest CONFIRMED · Expense(MATERIAL) +X
                               Project.spent +X · Payout(haydovchi) · Expense(DRIVER) · push hammaga
```

Xuddi shu tamoyil ish buyurtmasida: `REVIEW → DONE` bitta tranzaksiyada Payout + Expense(WORKER) + Project.spent + Review/reyting.

## 4. Ruxsatlar (backend `@Roles` + resurs egaligi)

| Resurs | Tadbirkor | Quruvchi | Haydovchi |
|---|---|---|---|
| Loyihalar | CRUD | READ (a'zo bo'lganlar) | – |
| Ish buyurtmalari | CRUD, accept/assign/review/pay | READ, start/submit (o'ziniki) | – |
| Vazifalar | CRUD | READ/UPDATE (o'ziniki) | – |
| Quruvchilar / Haydovchilar | CRUD, approve | READ | READ (o'z transporti) |
| Materiallar / Ombor | CRUD, adjust | READ, REQUEST | READ (ombor) |
| Yuklar | CRUD | READ, CONFIRM | READ, transition (o'ziniki) |
| Moliya | CRUD | READ (o'z daromadi) | READ (o'z daromadi) |
| Xabarlar | C/R | C/R | C/R |

Frontendda tugmani yashirish yetarli emas — har endpoint `PolicyGuard` (a'zolik + rol) va servisdagi `organizationId`/egalik filtri orqali tekshiriladi.

## 5. Navigatsiya (mobil)

- **Tadbirkor:** Bosh · Loyihalar · Buyurtmalar · Moliya · Menyu → Quruvchilar, Haydovchilar, Materiallar, Transport, Xabarlar, Bildirishnomalar, Xodimlar, Profil
- **Quruvchi:** Bosh · Buyurtmalar · Vazifalar · Materiallar · Menyu → Daromad, Ishlarim, Xabarlar, Profil
- **Haydovchi:** Bosh · Yetkazish · Transport · Daromad · Menyu → Tarix, Xabarlar, Profil

Umumiy sahifalar: `/project/:id` (7 bo'lim), `/work-order/:id`, `/shipment/:id` (xarita, marshrut), `/chat/:id`, `/worker/:id`.

## 6. Dashboard KPI (Tadbirkor) — `GET /dashboard/tadbirkor`

Faol loyihalar · Faol buyurtmalar · Quruvchilar · Haydovchilar · Bugungi xarajat · Umumiy daromad · Kutilayotgan daromad · Ochiq buyurtmalar · Tugallanayotgan ishlar · Material so'rovlari; holat satrlari (🟢🟡🔴🚚👷); 6 oylik daromad/xarajat; loyihalar progressi; xarajat tarkibi; past zaxira; oxirgi hodisalar.

## 7. Kengayish

4-rol **Ta'minotchi** (material sotadi → PurchaseOrder), 5-rol **Subpudratchi** (katta ishlarni oladi → Contract), 6-rol **Mijoz** (o'z loyihasini kuzatadi → read-only Project). Membership modeli va `Roles` dekoratorlari shu rollarni qo'shishga tayyor.
