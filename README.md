# Insof ECO — Beton zavodi va Qishloq qurilishi platformasi

Uch rol (Tadbirkor · Quruvchi · Haydovchi), bitta mobil ilova (iOS + Android), bitta backend.

## Tuzilma

```
apps/api        NestJS + Prisma + PostgreSQL/PostGIS + Redis    — REST /v1, WS /tracking
apps/mobile     Expo (React Native) + Expo Router               — rolga qarab UI
packages/shared zod sxemalar, enumlar, state machine, xato kodlari — ikkala tomonda bitta manba
infra/          docker-compose (Postgres+PostGIS, Redis, MinIO)
docs/           arxitektura hujjatlari va ADR'lar
```

## Hujjatlar

1. [Biznes arxitekturasi](docs/01-biznes-arxitektura.md) — rollar, domen, jarayonlar, qoidalar, ruxsatlar
2. [Backend arxitekturasi](docs/02-backend-arxitektura.md) — modullar, API, xavfsizlik, deploy
3. [Mobil arxitekturasi](docs/03-mobil-arxitektura.md) — Expo, offline, iOS/Android moslashuv
4. [UI dizayn tizimi](docs/04-ui-dizayn-tizimi.md) — tokenlar, primitivlar, ekranlar
5. [ECO System](docs/05-eco-system.md) — biznes modeli, rollar aro oqim, ruxsatlar
6. [ADR'lar](docs/adr/) — qarorlar va sabablari

## Ishga tushirish

```bash
yarn install
yarn infra:up                       # Postgres 5438, Redis 6382, MinIO 9010 (boshqa loyihalar bilan to'qnashmasligi uchun)
cp apps/api/.env.example apps/api/.env
yarn workspace @insof/shared build
yarn workspace @insof/api prisma:generate
yarn workspace @insof/api prisma:deploy && yarn db:seed
yarn dev:api                        # http://localhost:3010/docs (Swagger)
yarn dev:mobile                     # Expo: iOS simulator / Android emulator
```

End-to-end tekshiruv (buyurtma → tasdiq → reyslar → haydovchi → geofence → imzo → faktura):

```bash
./infra/smoke.sh
```

Eslatmalar:
- `node_modules` ni **sudo bilan** o'rnatmang — root egaligidagi fayllar keyin `yarn install` ni buzadi (`sudo chown -R $USER node_modules` bilan tuzatiladi).
- `prisma migrate dev` interaktiv; CI/skriptlarda `prisma:deploy` ishlatiladi. Yangi migratsiya: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<vaqt>_<nom>/migration.sql`.
- Mobil ilova real qurilmada ishlashi uchun `EXPO_PUBLIC_API_URL=http://<kompyuter-IP>:3010` bering.

Seed foydalanuvchilar (OTP dev rejimida har doim `000000`):

| Rol | Telefon |
|---|---|
| Tadbirkor | +998901110001 |
| Quruvchi | +998901110002 |
| Haydovchi | +998901110003 |
