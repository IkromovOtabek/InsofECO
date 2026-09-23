# ADR-0005 · PostgreSQL + PostGIS + Prisma

**Holat:** qabul qilindi · 2026-09-17

**Qaror.** Bitta Postgres 16 (PostGIS kengaytmasi geofence uchun). Prisma — asosiy CRUD/migratsiya; geo va agregat so'rovlar — `$queryRaw` (tipizatsiya `packages/shared` da). `GpsPoint` — oylik partitsiya, 90 kun saqlash.

**Rad etilganlar.** MongoDB (tranzaksiyalar/hisobotlar uchun noqulay), TimescaleDB (hozircha ortiqcha; GPS hajmi oshsa qo'shiladi — Postgres kengaytmasi, migratsiya oson).
