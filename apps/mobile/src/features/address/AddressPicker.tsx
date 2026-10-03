import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Linking, Pressable, View } from 'react-native';
import * as Location from 'expo-location';
import { Callout, IconButton, Input, Txt } from '@/design/primitives';
import { Icon, dialog, toast } from '@/design/ui';
import { haptic } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { radius, shadow, size, space } from '@/design/tokens';
import { config } from '@/core/config';
import { MapUnavailable, MapView, type MapHandle } from '@/core/map';
import { currentFix, ensureForegroundLocation } from '@/core/location';
import { geocodeText, resolvePlace, reverseGeocode, searchSource, suggestPlaces, type PlaceSuggestion } from './geocode';

/**
 * "Obyekt manzili" — yozish paytida takliflar, ostida xarita va markaziy pin.
 *
 *  - Yozing → 0.35 s dan keyin Yandex takliflari (MapKit Full yoki HTTP Geosuggest, `geocode.ts`).
 *  - Taklifni tanlang → xarita o'sha nuqtaga uchadi.
 *  - Xaritani suring → pin ostidagi nuqta olinadi va manzil matni avtomatik yoziladi.
 *  - "Joylashuvim" → telefon GPS'i (obyektda turgan bo'lsangiz eng aniq yo'l).
 *
 * Natija har doim `{ address, lat, lng }`; nuqta topilmagan bo'lsa `lat/lng = null` —
 * forma "joylashuvni aniqlang" deb so'raydi, soxta koordinata yuborilmaydi.
 * Kalitsiz build: matn + GPS tugmasi + aniq izoh (xarita va takliflar o'chiq), yiqilmaydi.
 */

export interface AddressValue { address: string; lat: number | null; lng: number | null }

const DEBOUNCE_MS = 350;
/** Toshkent — boshqa hech narsa ma'lum bo'lmaganda xarita shu yerdan ochiladi. */
const FALLBACK = { lat: 41.3111, lng: 69.2797 };
const ZOOM_DELTA = 0.01;

export function AddressPicker({ value, onChange, label = 'Obyekt manzili', required, error, placeholder = "Ko'cha, uy, mo'ljal", mapHeight = 220 }: {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  label?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  mapHeight?: number;
}) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [busyPin, setBusyPin] = useState(false);
  const [source, setSource] = useState(searchSource());
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const map = useRef<MapHandle | null>(null);
  const seq = useRef(0);
  /** Oxirgi qiymat — kechikkan javoblar eski matnni qaytarib yozmasin. */
  const latest = useRef(value);
  latest.current = value;
  /** Taklif tanlangandan keyin matn o'zgaradi — shu o'zgarish uchun qayta qidirilmaydi. */
  const skipNext = useRef(false);

  const hasPoint = value.lat != null && value.lng != null;

  // Takliflar yaqin joydan boshlansin — ruxsat allaqachon berilgan bo'lsa, so'ramasdan oxirgi nuqta
  useEffect(() => {
    void (async () => {
      try {
        if ((await Location.getForegroundPermissionsAsync()).status !== 'granted') return;
        const l = await Location.getLastKnownPositionAsync();
        if (l) setNear({ lat: l.coords.latitude, lng: l.coords.longitude });
      } catch { /* yaqinlik — ixtiyoriy */ }
    })();
  }, []);

  // Yozish paytida takliflar (debounce + eskirgan javoblarni tashlab yuborish)
  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    const q = value.address.trim();
    if (!focused || q.length < 3 || source === 'none') { setItems([]); setLoading(false); return; }
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      suggestPlaces(q, hasPoint ? { lat: value.lat!, lng: value.lng! } : near)
        .then((r) => { if (my === seq.current) { setItems(r); setFailed(false); } })
        .catch(() => { if (my === seq.current) { setItems([]); setFailed(true); } })
        .finally(() => { if (my === seq.current) { setLoading(false); setSource(searchSource()); } });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value.address, focused, source]); // eslint-disable-line react-hooks/exhaustive-deps

  const flyTo = (lat: number, lng: number) =>
    map.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: ZOOM_DELTA, longitudeDelta: ZOOM_DELTA }, 500);

  const pick = async (s: PlaceSuggestion) => {
    haptic.selection();
    Keyboard.dismiss();
    setItems([]);
    const text = [s.title, s.subtitle].filter(Boolean).join(', ');
    skipNext.current = true;
    onChange({ address: text, lat: null, lng: null });
    setBusyPin(true);
    try {
      const r = await resolvePlace(s);
      if (r) {
        skipNext.current = true;
        onChange({ address: text, lat: r.lat, lng: r.lng });
        flyTo(r.lat, r.lng);
      } else {
        toast.warning(config.mapsEnabled ? "Bu manzilning nuqtasi topilmadi — xaritani surib pinni obyektga qo'ying" : "Bu manzilning nuqtasi topilmadi — obyektda bo'lsangiz «Joylashuvim»ni bosing", 'Manzil');
      }
    } finally {
      setBusyPin(false);
    }
  };

  /** Nuqta tanlandi (GPS yoki xarita) — manzil matnini shu nuqtadan to'ldiramiz. */
  const setPoint = async (lat: number, lng: number) => {
    onChange({ ...latest.current, lat, lng });
    setBusyPin(true);
    try {
      const text = await reverseGeocode(lat, lng);
      // Javob kelguncha foydalanuvchi pinni yana surgan bo'lsa — eski manzilni yozmaymiz
      const cur = latest.current;
      if (text && cur.lat === lat && cur.lng === lng) { skipNext.current = true; onChange({ address: text, lat, lng }); }
    } finally {
      setBusyPin(false);
    }
  };

  const locate = async () => {
    setLocating(true);
    try {
      const access = await ensureForegroundLocation();
      if (access === 'services-off') { toast.warning('Telefonda joylashuv (GPS) o\'chiq — yoqib, qayta bosing', 'GPS'); return; }
      if (access === 'blocked') {
        dialog('Joylashuvga ruxsat yo\'q', 'Ilova joylashuvni so\'ray olmaydi. Sozlamalar → Joylashuv → «Ilova ishlatilganda» ni yoqing yoki manzilni yozib, xaritada belgilang.', [
          { text: 'Sozlamalarni ochish', onPress: () => void Linking.openSettings() },
          { text: 'Yopish', style: 'cancel' },
        ]);
        return;
      }
      if (access !== 'granted') { toast.warning('Joylashuvga ruxsat berilmadi — manzilni yozib tanlang', 'GPS'); return; }
      const fix = await currentFix();
      if (!fix) { toast.error('GPS javob bermadi — ochiq joyga chiqib qayta urinib ko\'ring', 'GPS'); return; }
      haptic.success();
      setNear({ lat: fix.lat, lng: fix.lng });
      flyTo(fix.lat, fix.lng);
      await setPoint(fix.lat, fix.lng);
    } finally {
      setLocating(false);
    }
  };

  /** Faqat matn yozilgan, nuqta yo'q — taxminiy nuqtani topib qo'yamiz (xaritada tuzatsa bo'ladi). */
  const onBlur = async () => {
    setFocused(false);
    // Taklif bosilganda klaviatura yopiladi — ro'yxat bosish ulguradigan qilib biroz kutamiz
    setTimeout(() => setItems([]), 150);
    const v = latest.current;
    if (v.lat != null || v.address.trim().length < 5) return;
    const g = await geocodeText(v.address);
    const cur = latest.current;
    if (g && cur.lat == null && cur.address === v.address) { onChange({ ...cur, lat: g.lat, lng: g.lng }); flyTo(g.lat, g.lng); }
  };

  const center = hasPoint ? { lat: value.lat!, lng: value.lng! } : near ?? FALLBACK;
  const showList = focused && (items.length > 0 || loading || failed) && value.address.trim().length >= 3;

  return (
    <View>
      <Input
        label={label} required={required} error={error}
        value={value.address}
        onChangeText={(t) => onChange({ ...latest.current, address: t })}
        onFocus={() => setFocused(true)}
        onBlur={() => void onBlur()}
        placeholder={placeholder} left="map-pin"
        autoCorrect={false} returnKeyType="search"
        containerStyle={{ marginBottom: showList ? space.xs : space.md }}
        right={loading ? <ActivityIndicator size="small" color={c.textMuted} /> : value.address ? (
          <IconButton icon="x" label="Tozalash" size={size.iconTileSm} onPress={() => { onChange({ address: '', lat: null, lng: null }); setItems([]); }} />
        ) : null}
      />

      {showList ? (
        <View style={[{ backgroundColor: c.bgSurface, borderRadius: radius.sm, borderWidth: size.hairline, borderColor: c.borderSubtle, marginBottom: space.md, overflow: 'hidden' }, shadow.card]} accessibilityRole="list">
          {items.map((s, i) => (
            <Pressable
              key={s.id} onPress={() => void pick(s)}
              accessibilityRole="button" accessibilityLabel={[s.title, s.subtitle].filter(Boolean).join(', ')}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm + space.xs, minHeight: size.touch, borderTopWidth: i ? size.hairline : 0, borderTopColor: c.borderSubtle }, pressed && { backgroundColor: c.bgMuted }]}
            >
              <Icon name="map-pin" tone="muted" size={size.iconMd} />
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong" numberOfLines={1}>{s.title}</Txt>
                {s.subtitle ? <Txt v="caption" color="muted" numberOfLines={1}>{s.subtitle}</Txt> : null}
              </View>
            </Pressable>
          ))}
          {!items.length && loading ? <Txt v="caption" color="muted" style={{ padding: space.md }}>Qidirilmoqda…</Txt> : null}
          {!items.length && !loading && failed ? <Txt v="caption" color="muted" style={{ padding: space.md }}>Takliflar yuklanmadi — internetni tekshiring yoki manzilni to&apos;liq yozing</Txt> : null}
        </View>
      ) : null}

      {config.mapsEnabled ? (
        <View style={{ height: mapHeight, borderRadius: radius.card, overflow: 'hidden', borderWidth: size.hairline, borderColor: c.borderDefault }}>
          <MapView
            ref={(r) => { map.current = r; }}
            style={{ flex: 1 }}
            initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: hasPoint || near ? ZOOM_DELTA : 0.12, longitudeDelta: hasPoint || near ? ZOOM_DELTA : 0.12 }}
            rotateEnabled={false} pitchEnabled={false} showsUserLocation
            onRegionChangeComplete={(p, byUser) => { if (byUser) void setPoint(p.latitude, p.longitude); }}
          />
          {/* Markaziy pin: xarita uning ostida suriladi — pin uchi aynan tanlangan nuqta */}
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ marginBottom: size.iconXl + space.xs, alignItems: 'center' }}>
              {busyPin ? <ActivityIndicator size="small" color={c.brand} style={{ marginBottom: space.xs }} /> : null}
              <Icon name="map-pin" size={size.iconXl + space.sm} color={hasPoint ? c.brand : c.textMuted} strokeWidth={2} />
            </View>
          </View>
          <View style={{ position: 'absolute', right: space.md, bottom: space.md }}>
            <IconButton
              icon={locating ? 'locate' : 'locate-fixed'} label="Joylashuvim" variant="secondary" tone="brand"
              size={size.iconTile + space.xs} disabled={locating} onPress={() => void locate()}
              style={[{ borderRadius: radius.pill }, shadow.card]}
            />
          </View>
          {!hasPoint ? (
            <View pointerEvents="none" style={{ position: 'absolute', left: space.md, top: space.md, right: space.md }}>
              <Txt v="caption" style={{ alignSelf: 'flex-start', backgroundColor: c.bgSurface, color: c.textMuted, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill, overflow: 'hidden' }}>
                Xaritani surib, pinni obyektga qo&apos;ying
              </Txt>
            </View>
          ) : null}
        </View>
      ) : (
        <MapUnavailable compact title="Xarita va manzil takliflari o'chiq" hint="Ilovaga Yandex xarita kaliti hali ulanmagan. Manzilni to'liq yozing; obyektda bo'lsangiz «Joylashuvim» — haydovchi aynan shu nuqtaga keladi.">
          <IconButton icon={locating ? 'locate' : 'locate-fixed'} label="Joylashuvim" variant="secondary" tone="brand" disabled={locating} onPress={() => void locate()} style={{ borderRadius: radius.pill, marginTop: space.xs }} />
        </MapUnavailable>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }} accessibilityLiveRegion="polite">
        <Icon name={hasPoint ? 'circle-check' : 'circle-alert'} size={size.iconSm} tone={hasPoint ? 'success' : 'muted'} />
        <Txt v="caption" color={hasPoint ? 'success' : 'muted'} style={{ flex: 1 }}>
          {hasPoint
            ? `Nuqta belgilandi (${value.lat!.toFixed(5)}, ${value.lng!.toFixed(5)}) — haydovchi shu joyga keladi`
            : locating ? 'Joylashuv aniqlanmoqda…' : 'Obyekt nuqtasi hali belgilanmagan'}
        </Txt>
      </View>
      {config.mapsEnabled && source === 'none' ? (
        <Callout tone="info" style={{ marginTop: space.sm }}>Manzil takliflari bu ilova versiyasida ishlamaydi — manzilni yozib, pinni xaritada qo&apos;ying.</Callout>
      ) : null}
    </View>
  );
}
