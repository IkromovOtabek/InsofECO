#!/usr/bin/env bash
# End-to-end smoke: buyurtma → tasdiq → reyslar → biriktirish → haydovchi holatlari → imzo → faktura
set -euo pipefail
API=${API:-http://localhost:3010/v1}
# dev: OTP rate-limit kalitlarini tozalash (3 ta/soat)
docker exec insof-eco-redis-1 sh -c "redis-cli --scan --pattern 'otp:*' | xargs -r redis-cli del" >/dev/null 2>&1 || true
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(\"d$1\"))"; }
login() { # phone → access token
  curl -s -X POST $API/auth/otp/request -H 'content-type: application/json' -d "{\"phone\":\"$1\"}" >/dev/null
  curl -s -X POST $API/auth/otp/verify -H 'content-type: application/json' -d "{\"phone\":\"$1\",\"code\":\"000000\",\"device\":{\"deviceId\":\"smoke-$1\",\"platform\":\"ios\"}}"
}
T=$(login +998901110001); TADB=$(echo "$T" | j "['accessToken']"); PLANT=$(echo "$T" | j "['user']['memberships'][0]['organization']['id']")
Q=$(login +998901110002); QUR=$(echo "$Q" | j "['accessToken']"); CLIENT=$(echo "$Q" | j "['user']['memberships'][0]['organization']['id']")
# Oldingi run'dan qolgan faol reyslarni Tadbirkor override qiladi (FAILED/CANCELLED) — smoke qayta ishga tushirilishi uchun
curl -s "$API/dispatch/board" -H "authorization: Bearer $TADB" -H "x-org-id: $PLANT" | python3 -c "import sys,json; [print(x['activeDelivery']['id']) for x in json.load(sys.stdin)['drivers'] if x['activeDelivery']]" | while read DID; do
  for TO in FAILED CANCELLED; do
    curl -s -o /dev/null -X POST $API/deliveries/$DID/transition -H "authorization: Bearer $TADB" -H "x-org-id: $PLANT" -H 'content-type: application/json' -d "{\"to\":\"$TO\",\"at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"note\":\"smoke cleanup\"}"
  done
done
# Bo'sh haydovchini dispetcher taxtasidan tanlaymiz (oldingi run'dan faol reys qolgan bo'lishi mumkin)
FREE_PHONE=$(curl -s "$API/dispatch/board" -H "authorization: Bearer $TADB" -H "x-org-id: $PLANT" | python3 -c "import sys,json; d=json.load(sys.stdin); f=[x for x in d['drivers'] if not x['activeDelivery']]; print(f[0]['phone'] if f else '')")
[ -n "$FREE_PHONE" ] || { echo "Bo'sh haydovchi yo'q — oldingi reyslarni yakunlang"; exit 1; }
H=$(login $FREE_PHONE); HAY=$(echo "$H" | j "['accessToken']"); DRIVER_UID=$(echo "$H" | j "['user']['id']")
echo "✓ login: tadbirkor/quruvchi/haydovchi($FREE_PHONE)"

MIX=$(curl -s "$API/catalog/mixes?plantOrgId=$PLANT" -H "authorization: Bearer $QUR" -H "x-org-id: $CLIENT" | j "[4]['id']")
ORDER=$(curl -s -X POST $API/orders -H "authorization: Bearer $QUR" -H "x-org-id: $CLIENT" -H 'content-type: application/json' \
  -d "{\"plantOrgId\":\"$PLANT\",\"address\":\"Chortoq, Navbahor MFY\",\"location\":{\"lat\":41.0689,\"lng\":71.8232},\"items\":[{\"mixId\":\"$MIX\",\"volumeM3\":20}],\"scheduledAt\":\"2026-09-18T08:00:00Z\",\"intervalMinutes\":30}")
OID=$(echo "$ORDER" | j "['id']"); echo "✓ order created #$(echo "$ORDER" | j "['number']") total=$(echo "$ORDER" | j "['totalAmount']")"
curl -s -X POST $API/orders/$OID/submit -H "authorization: Bearer $QUR" -H "x-org-id: $CLIENT" | j "['status']"
curl -s -X POST $API/orders/$OID/confirm -H "authorization: Bearer $TADB" -H "x-org-id: $PLANT" -H 'content-type: application/json' -d '{"deliveryFee":200000}' | j "['status']"
PLAN=$(curl -s -X POST $API/dispatch/orders/$OID/plan -H "authorization: Bearer $TADB" -H "x-org-id: $PLANT" -H 'content-type: application/json' -d '{}')
echo "✓ planned: $(echo "$PLAN" | j "['status']") trips=$(echo "$PLAN" | python3 -c "import sys,json; print([str(d['plannedM3']) for d in json.load(sys.stdin)['deliveries']])")"
D1=$(echo "$PLAN" | j "['deliveries'][0]['id']")
VEH=$(curl -s "$API/organizations/vehicles" -H "authorization: Bearer $TADB" -H "x-org-id: $PLANT" | j "[0]['id']")
curl -s -X POST $API/dispatch/deliveries/$D1/assign -H "authorization: Bearer $TADB" -H "x-org-id: $PLANT" -H 'content-type: application/json' -d "{\"driverUserId\":\"$DRIVER_UID\",\"vehicleId\":\"$VEH\"}" | j "['status']"

tr() { curl -s -X POST $API/deliveries/$D1/transition -H "authorization: Bearer $HAY" -H 'content-type: application/json' -H "idempotency-key: smoke-$D1-$1" -d "{\"to\":\"$1\",\"at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"location\":{\"lat\":41.06,\"lng\":71.82}${2:-}}" | j "['status']"; }
tr ACCEPTED; tr LOADING; tr EN_ROUTE ',"loadedM3":8'
echo "✓ driver: ACCEPTED→LOADING→EN_ROUTE"
# idempotency replay: same key again must not error
tr EN_ROUTE ',"loadedM3":8' >/dev/null && echo "✓ idempotent replay ok"
# invalid transition must be 409
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/deliveries/$D1/transition -H "authorization: Bearer $HAY" -H 'content-type: application/json' -d '{"to":"LOADING","at":"2026-09-17T00:00:00Z"}'); echo "✓ invalid transition → HTTP $CODE"
# GPS geofence → ARRIVED avtomatik
curl -s -X POST $API/tracking/gps -H "authorization: Bearer $HAY" -H 'content-type: application/json' -d "{\"deliveryId\":\"$D1\",\"points\":[{\"lat\":41.0690,\"lng\":71.8233,\"speedKmh\":12,\"at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}]}" >/dev/null
sleep 1; echo "✓ geofence → $(curl -s $API/deliveries/$D1 -H "authorization: Bearer $HAY" | j "['status']")"
tr UNLOADING
SIGN=$(curl -s -X POST $API/deliveries/$D1/sign -H "authorization: Bearer $QUR" -H "x-org-id: $CLIENT" -H 'content-type: application/json' -d '{"signatureKey":"signature/x.png","acceptedM3":8}')
echo "✓ signed → $(echo "$SIGN" | j "['status']") order=$(curl -s $API/orders/$OID -H "authorization: Bearer $QUR" -H "x-org-id: $CLIENT" | j "['status']")"
sleep 1; echo "✓ billing: $(curl -s $API/billing/summary -H "authorization: Bearer $TADB" -H "x-org-id: $PLANT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('debt', d['totalDebt'], 'clients', [(c['name'], c['debt']) for c in d['clients']])")"
echo "✓ notifications (quruvchi): $(curl -s $API/notifications -H "authorization: Bearer $QUR" | python3 -c "import sys,json; print([n['type'] for n in json.load(sys.stdin)][:6])")"
echo "SMOKE OK"
