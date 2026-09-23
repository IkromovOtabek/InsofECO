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

## Serverga o'rnatish (VPS)

Ubuntu 22/24. ERP allaqachon o'sha serverda bo'lsa ham to'qnashmaydi: ECO **3010**-portda,
yordamchi xizmatlari esa Docker ichida va faqat `127.0.0.1` ga ochiladi.

Kerak bo'ladi: **PostGIS** (oddiy Postgres yetmaydi — `schema.prisma` da `extensions = [postgis]`),
**Redis** (navbatlar) va **S3/MinIO** (fotolar, imzolar). Shuning uchun Docker.

```bash
# 1. Docker va Yarn
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker      # shundan keyin sudo'siz ishlaydi
sudo npm i -g yarn

# 2. Kod
sudo git clone https://github.com/IkromovOtabek/InsofECO.git /var/www/insof-eco
sudo chown -R $USER:$USER /var/www/insof-eco && cd /var/www/insof-eco

# 3. .env — parollar va JWT kalitlari
cp apps/api/.env.example apps/api/.env
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out /tmp/jwt.key 2>/dev/null
openssl rsa -pubout -in /tmp/jwt.key -out /tmp/jwt.pub 2>/dev/null
PGPASS=$(openssl rand -hex 16); S3KEY=$(openssl rand -hex 8); S3SEC=$(openssl rand -hex 24)
cat >> apps/api/.env <<EOF
NODE_ENV=production
PORT=3010
POSTGRES_USER=insof
POSTGRES_PASSWORD=$PGPASS
POSTGRES_DB=insof
DATABASE_URL=postgresql://insof:$PGPASS@localhost:5438/insof?schema=public
REDIS_URL=redis://localhost:6382
S3_ENDPOINT=http://localhost:9010
S3_BUCKET=insof
S3_ACCESS_KEY=$S3KEY
S3_SECRET_KEY=$S3SEC
JWT_PRIVATE_KEY=$(awk 'BEGIN{ORS="\\n"}1' /tmp/jwt.key)
JWT_PUBLIC_KEY=$(awk 'BEGIN{ORS="\\n"}1' /tmp/jwt.pub)
EOF
rm -f /tmp/jwt.key /tmp/jwt.pub && chmod 600 apps/api/.env
# Eski qatorlar ikki marta yozilgan bo'lishi mumkin — oxirgisi kuchga kiradi, lekin tekshirib chiqing:
grep -n "DATABASE_URL\|JWT_PRIVATE_KEY" apps/api/.env

# 4. Postgres+PostGIS, Redis, MinIO
docker compose --env-file apps/api/.env -f infra/docker-compose.prod.yml up -d
docker compose -f infra/docker-compose.prod.yml ps

# 5. Qurish va baza
yarn install
yarn workspace @insof/shared build
yarn workspace @insof/api prisma:generate
yarn workspace @insof/api prisma:deploy
yarn workspace @insof/api build

# 6. systemd — API va fon ishchisi (navbatlar) alohida
sudo tee /etc/systemd/system/insof-eco.service >/dev/null <<'EOF'
[Unit]
Description=Insof ECO API
After=network.target docker.service

[Service]
WorkingDirectory=/var/www/insof-eco/apps/api
EnvironmentFile=/var/www/insof-eco/apps/api/.env
ExecStart=/usr/bin/node dist/main.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo tee /etc/systemd/system/insof-eco-worker.service >/dev/null <<'EOF'
[Unit]
Description=Insof ECO worker
After=insof-eco.service

[Service]
WorkingDirectory=/var/www/insof-eco/apps/api
EnvironmentFile=/var/www/insof-eco/apps/api/.env
ExecStart=/usr/bin/node dist/worker.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload && sudo systemctl enable --now insof-eco insof-eco-worker
sudo systemctl status insof-eco --no-pager | head -5
```

Nginx — WebSocket muhim: haydovchi joylashuvi va xabarlar shu orqali keladi, `Upgrade`
sarlavhalarisiz ulanish uzilib qoladi.

```bash
sudo tee /etc/nginx/sites-available/insof-eco >/dev/null <<'EOF'
server {
    listen 80;
    server_name api.insof-erp.uz;
    client_max_body_size 25m;          # nakladnoy va yetkazish fotolari
    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/insof-eco /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.insof-erp.uz          # DNS A-yozuvi shu serverga qaragan bo'lsin
```

| Ish | Buyruq |
| --- | --- |
| Loglar | `journalctl -u insof-eco -f` |
| Keyingi deploylar | `cd /var/www/insof-eco && git pull && yarn install && yarn workspace @insof/shared build && yarn workspace @insof/api prisma:deploy && yarn workspace @insof/api build && sudo systemctl restart insof-eco insof-eco-worker` |
| Baza nusxasi | `docker exec insof-eco-prod-postgres-1 pg_dump -U insof insof > nusxa.sql` |

`JWT_PRIVATE_KEY` bo'lmasa server **ataylab ko'tarilmaydi** (`auth.module.ts`) — kalitsiz ishga
tushsa tokenlar koddagi ochiq matnli parol bilan imzolanardi.
