#!/usr/bin/env bash
# Insof ECO — kunlik zaxira nusxa (prod serverda, `deploy` foydalanuvchisi ostida).
#
# Nega alohida: ERP'ning scripts/server-backup.sh faqat ERP bazalarini (tenants/*.env, control.env) oladi —
# ECO bazasi (docker, 127.0.0.1:5438), avatarlar (apps/api/uploads) va MinIO unga kirmaydi.
#
# Nima qiladi:
#   1. ECO Postgres → pg_dump -Fc (konteyner ichida, parol so'ramaydi)
#   2. apps/api/uploads (avatarlar) → tar.gz
#   3. MinIO ma'lumotlari (fotolar) → tar.gz (volume'dan, faqat o'qish)
#   4. SHA256SUMS, KEEP_DAYS (standart 14) dan eskilarini o'chirish
#   5. Server TASHQARISIGA: rclone → ECO_RCLONE_REMOTE/<sana> (ECO_RCLONE_KEEP_DAYS, standart 10 kun);
#      berilmagan yoki xato bo'lsa — exit 1 + ogohlantirish (mahalliy nusxa baribir qoladi)
#   6. Xato bo'lsa — Telegram ogohlantirish (ERP bilan umumiy /etc/insof/backup.env: ALERT_TG_BOT_TOKEN, ALERT_TG_CHAT_ID)
# Tiklash: docker exec -i insof-eco-prod-postgres-1 pg_restore -U insof -d insof --clean --if-exists < eco.dump
#
# Cron (deploy ostida, `crontab -e`) — ERP backup'idan keyin:
#   45 2 * * * /var/www/insof-eco/infra/backup.sh >> /var/log/insof-eco-backup.log 2>&1
set -Eeuo pipefail
umask 077

ECO_DIR="${ECO_DIR:-/var/www/insof-eco}"
OUT_DIR="${OUT_DIR:-/var/backups/insof-eco}"
KEEP_DAYS="${KEEP_DAYS:-14}"
PG_CONTAINER="${PG_CONTAINER:-insof-eco-prod-postgres-1}"
MINIO_VOLUME="${MINIO_VOLUME:-insof-eco-prod_miniodata}"
BACKUP_ENV="${BACKUP_ENV:-/etc/insof/backup.env}"

env_get() { grep -E "^[[:space:]]*$2[[:space:]]*=" "$1" 2>/dev/null | tail -n1 | sed -E 's/^[^=]*=[[:space:]]*//; s/[[:space:]]+#.*$//; s/^"(.*)"$/\1/; s/[[:space:]]+$//' || true; }
TG_TOKEN="${ALERT_TG_BOT_TOKEN:-$(env_get "$BACKUP_ENV" ALERT_TG_BOT_TOKEN)}"
TG_CHAT="${ALERT_TG_CHAT_ID:-$(env_get "$BACKUP_ENV" ALERT_TG_CHAT_ID)}"
PG_USER="$(env_get "$ECO_DIR/apps/api/.env" POSTGRES_USER)"; PG_USER="${PG_USER:-insof}"
PG_DB="$(env_get "$ECO_DIR/apps/api/.env" POSTGRES_DB)"; PG_DB="${PG_DB:-insof}"

STEP="boshlanish"
log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }
alert() {
  [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ] || return 0
  curl -fsS -m 10 -o /dev/null "https://api.telegram.org/bot$TG_TOKEN/sendMessage" \
    --data-urlencode "chat_id=$TG_CHAT" --data-urlencode "text=⚠️ Insof ECO backup xato ($(hostname)): $1" || true
}
trap 'log "XATO: $STEP"; alert "$STEP"; rm -rf "${DEST:-/nonexistent}.partial"' ERR

DEST="$OUT_DIR/$(date +%F)"
mkdir -p "$DEST.partial"

STEP="pg_dump $PG_DB"
log "→ $STEP"
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" -Fc --no-owner --no-acl > "$DEST.partial/eco.dump"
[ -s "$DEST.partial/eco.dump" ]   # bo'sh dump — xato (ERR trap)

STEP="uploads (avatarlar)"
if [ -d "$ECO_DIR/apps/api/uploads" ]; then
  log "→ $STEP"
  tar -czf "$DEST.partial/eco-uploads.tar.gz" -C "$ECO_DIR/apps/api" uploads
fi

STEP="MinIO ($MINIO_VOLUME)"
if docker volume inspect "$MINIO_VOLUME" >/dev/null 2>&1; then
  log "→ $STEP"
  docker run --rm -v "$MINIO_VOLUME:/data:ro" -v "$DEST.partial:/out" alpine:3 tar -czf /out/eco-minio.tar.gz -C /data .
fi

STEP="SHA256SUMS"
( cd "$DEST.partial" && sha256sum -- * > SHA256SUMS )
rm -rf "$DEST" && mv "$DEST.partial" "$DEST"
log "✓ $(du -sh "$DEST" | cut -f1) → $DEST"

# ── Server tashqarisiga (rclone). Sozlama ERP bilan umumiy backup.env da: ECO_RCLONE_REMOTE, ECO_RCLONE_KEEP_DAYS ──
STEP="server tashqarisiga (rclone)"
RC_REMOTE="${ECO_RCLONE_REMOTE:-$(env_get "$BACKUP_ENV" ECO_RCLONE_REMOTE)}"
RC_KEEP="${ECO_RCLONE_KEEP_DAYS:-$(env_get "$BACKUP_ENV" ECO_RCLONE_KEEP_DAYS)}"; RC_KEEP="${RC_KEEP:-10}"
RC_CFG="${RCLONE_CONFIG:-$(env_get "$BACKUP_ENV" RCLONE_CONFIG)}"
if [ -n "$RC_CFG" ]; then export RCLONE_CONFIG="$RC_CFG"; fi
OFFSITE_ERR=""
if [ -z "$RC_REMOTE" ]; then
  OFFSITE_ERR="ECO_RCLONE_REMOTE berilmagan ($BACKUP_ENV) — nusxa faqat shu serverda"
elif ! command -v rclone >/dev/null; then
  OFFSITE_ERR="rclone o'rnatilmagan"
else
  # ERP server-backup.sh bilan bir xil: eskilar yuklashdan OLDIN va savatsiz o'chiriladi (Drive kvotasi qotib qolmasin)
  if ! { rclone delete "$RC_REMOTE" --min-age "${RC_KEEP}d" --drive-use-trash=false \
      && rclone rmdirs "$RC_REMOTE" --leave-root --drive-use-trash=false; }; then
    log "⚠ rclone: eskilarni tozalashda xato"
  fi
  log "→ rclone: $RC_REMOTE/$(basename "$DEST")"
  if rclone copy "$DEST" "$RC_REMOTE/$(basename "$DEST")" --transfers 2 --retries 3 \
    && rclone check "$DEST" "$RC_REMOTE/$(basename "$DEST")" --one-way; then
    log "  ok"
  else
    OFFSITE_ERR="rclone: yuklash yoki tekshiruv xato"
  fi
fi

STEP="eski nusxalarni tozalash"
find "$OUT_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +"$KEEP_DAYS" -exec rm -rf {} +

if [ -n "$OFFSITE_ERR" ]; then
  log "✗ $OFFSITE_ERR"
  alert "$OFFSITE_ERR"
  exit 1
fi
