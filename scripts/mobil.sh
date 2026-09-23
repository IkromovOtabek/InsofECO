#!/usr/bin/env bash
#
# Mobil ilovani sinash uchun hamma narsani bitta buyruq bilan ko'taradi:
#   ECO API (3010) · Insof ERP (3000) · Metro (8081) · adb reverse
#
#   yarn mobil
#
# ERP boshqa joyda bo'lsa:  ERP_DIR="/yo'l/Insof ERP" yarn mobil
#
# To'xtatish: Ctrl+C — shu skript ko'targan serverlar ham birga to'xtaydi.
set -uo pipefail

ADB="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"
ECO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERP_DIR="${ERP_DIR:-$HOME/Desktop/Insof ERP}"
PORTS=(8081 3000 3010)

pids=()

cleanup() {
  echo ""
  echo "To'xtatilmoqda..."
  for p in "${pids[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null; done
  wait 2>/dev/null
  exit 0
}
trap cleanup INT TERM

busy() { lsof -iTCP:"$1" -sTCP:LISTEN -P -n >/dev/null 2>&1; }

# Portni band qilgan jarayonni o'ldirmaydi — ataylab. Bugun ikkita `next dev` bitta
# `.next` papkasiga yozib, butun API'ni 404 qilib qo'ygan edi; shuning uchun band port
# ko'rsak, o'zimiznikini ko'tarmaymiz va buni aytamiz.
start() {
  local nom="$1" port="$2" dir="$3"; shift 3
  if busy "$port"; then
    echo "  • $nom ($port) — allaqachon ishlayapti, tegilmadi"
    return
  fi
  if [ ! -d "$dir" ]; then
    echo "  ✗ $nom — papka topilmadi: $dir"
    return
  fi
  echo "  • $nom ($port) ishga tushirilmoqda"
  ( cd "$dir" && exec "$@" ) &
  pids+=("$!")
}

echo "Insof mobil — ishga tushirish"
echo ""
start "ECO API"  3010 "$ECO_DIR"              yarn dev:api
start "Insof ERP" 3000 "$ERP_DIR"             npm run dev
start "Metro"    8081 "$ECO_DIR/apps/mobile"  npx expo start --dev-client --port 8081

# ── Telefon ──
echo ""
if [ ! -x "$ADB" ]; then
  echo "  ✗ adb topilmadi: $ADB  (ADB=... bilan yo'lni ko'rsating)"
else
  echo "Telefon kutilmoqda (USB, developer options → USB debugging)..."
  for _ in $(seq 1 30); do
    holat="$("$ADB" devices | awk 'NR>1 && NF {print $2; exit}')"
    [ "$holat" = "device" ] && break
    [ "$holat" = "unauthorized" ] && echo "  ! Telefon ekranidagi 'Allow USB debugging' so'roviga ruxsat bering"
    sleep 2
  done
  if [ "$("$ADB" devices | awk 'NR>1 && NF {print $2; exit}')" = "device" ]; then
    for p in "${PORTS[@]}"; do "$ADB" reverse "tcp:$p" "tcp:$p" >/dev/null; done
    echo "  ✓ Telefon ulandi, portlar yo'naltirildi: ${PORTS[*]}"
    echo "    Endi telefonda 'Insof ECO' ilovasini oching."
  else
    echo "  ✗ Telefon ko'rinmadi. Kabelni ulab, keyin shu buyruqni qayta bajaring:"
    echo "      for p in ${PORTS[*]}; do $ADB reverse tcp:\$p tcp:\$p; done"
  fi
fi

echo ""
echo "Tayyor. To'xtatish uchun Ctrl+C."
wait
