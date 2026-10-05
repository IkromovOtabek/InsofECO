import React, { useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { Button, IconButton, Txt, fmtTime } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { dialog, toast } from '@/design/ui';
import { Appear, haptic, stagger } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { DEMO_SCALE, elevation, radius, size, space } from '@/design/tokens';
import { api } from '@/core/api';
import { SignaturePad, SignaturePadHandle } from '@/components/signature-pad';
import { Delivery, useDispute, useSignDelivery } from './api';
import i18n from '@/core/i18n';

/**
 * Betonni qabul qilish — demo "Betonni qabul qilish" (docs/redesign/shots/27). Quruvchi/tadbirkor, reys `UNLOADING` da.
 *  - To'q hero: mikser raqami · kelgan vaqti, marka · hajm, zavoddan chiqqan vaqt va beton "yoshi";
 *  - qabul qilingan hajm (stepper, 0.5 m³ qadam, hujjatdagidan oshmaydi);
 *  - haqiqiy imzo maydoni → PNG → `POST /files/presign` (purpose: signature) → PUT → `signatureKey`;
 *  - pastda "Imzolash va qabul qilish" va "E'tiroz bildirish".
 * Nakladnoy fotosi bloki yo'q: imzo API'si (`/deliveries/:id/sign`) foto kalitini qabul qilmaydi.
 */

const STEP = 0.5;
const m3 = (v: number) => `${v.toFixed(1).replace('.', ',')} m³`;

/** Imzo PNG'sini presigned URL orqali omborga yuklaydi va kalitini qaytaradi. */
async function uploadSignature(base64: string): Promise<string> {
  const p = await api<{ key: string; url: string; method: 'PUT'; headers: Record<string, string> }>('/files/presign', {
    method: 'POST', body: { contentType: 'image/png', purpose: 'signature' },
  });
  const bin = globalThis.atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const r = await fetch(p.url, { method: p.method ?? 'PUT', headers: p.headers, body: bytes.buffer });
  if (!r.ok) throw new Error(`Imzo yuklanmadi (${r.status})`);
  return p.key;
}

/** Chizma palitrasidagi hero katagi — 14 css, textOnInverse 8%. */
function Grid({ color }: { color: string }) {
  const id = `ag${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const cell = Math.round(14 * DEMO_SCALE);
  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} width="100%" height="100%">
      <Defs>
        <Pattern id={id} x={0} y={0} width={cell} height={cell} patternUnits="userSpaceOnUse">
          <Path d={`M0,0.5 H${cell} M0.5,0 V${cell}`} stroke={color} strokeOpacity={0.08} strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Demo `.stepper`: bgMuted pill, 26 css yuza doiralar (sh1), o'rtada qiymat. */
function Stepper({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  const { c } = useTheme();
  const btn = Math.round(26 * DEMO_SCALE);
  const set = (v: number) => { const n = Math.min(max, Math.max(min, Math.round(v / STEP) * STEP)); if (n !== value) { haptic.selection(); onChange(n); } };
  const B = ({ icon, delta, label, off }: { icon: 'minus' | 'plus'; delta: number; label: string; off: boolean }) => (
    <Pressable
      onPress={() => set(value + delta)} disabled={off}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: off }} hitSlop={space.xs}
      style={({ pressed }) => [{ width: btn, height: btn, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgSurface }, elevation(c).sh1, (pressed || off) && { opacity: off ? 0.4 : 0.7 }]}
    >
      <Icon name={icon} size={size.iconMd} tone="strong" strokeWidth={2.5} />
    </Pressable>
  );
  return (
    <View accessibilityRole="adjustable" accessibilityValue={{ text: m3(value) }} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.xs, borderRadius: radius.pill, backgroundColor: c.bgMuted }}>
      <B icon="minus" delta={-STEP} label="Hajmni kamaytirish" off={value <= min} />
      <Txt v="listValue" align="center" style={{ minWidth: Math.round(40 * DEMO_SCALE) + space.md }}>{m3(value)}</Txt>
      <B icon="plus" delta={STEP} label="Hajmni oshirish" off={value >= max} />
    </View>
  );
}

export function AcceptDelivery({ d }: { d: Delivery }) {
  const { c, paletteName } = useTheme();
  const insets = useSafeAreaInsets();
  const sign = useSignDelivery(d.id);
  const dispute = useDispute(d.id);
  const doc = Number(d.loadedM3 ?? d.plannedM3) || 0;
  const [accepted, setAccepted] = useState(doc);
  const [signed, setSigned] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);

  const grade = d.order.items.map((i) => i.nameSnapshot || i.gradeSnapshot).filter(Boolean).join(' / ');
  const over = [d.vehicle?.plateNumber ? `Mikser ${d.vehicle.plateNumber}` : null, d.arrivedAt ? fmtTime(d.arrivedAt) : null].filter(Boolean).join(' · ');
  const age = d.departedAt ? Math.max(0, Math.round((Date.now() - new Date(d.departedAt).getTime()) / 60_000)) : null;
  const phone = d.driver?.user.phone;

  const submit = async () => {
    if (!signed || pad.current?.isEmpty()) { haptic.warning(); toast.warning("Avval pastdagi maydonga imzo qo'ying"); return; }
    setUploading(true);
    let key: string;
    try {
      const png = await pad.current!.toPng();
      key = await uploadSignature(png);
    } catch (e) {
      setUploading(false);
      haptic.error();
      toast.error((e as Error).message || "Imzo yuklanmadi — internetni tekshiring", 'Xato');
      return;
    }
    setUploading(false);
    sign.mutate({ signatureKey: key, acceptedM3: accepted }, {
      onSuccess: () => { haptic.success(); toast.success('Beton qabul qilindi'); },
      onError: (e) => { haptic.error(); toast.error(e.message, 'Xato'); },
    });
  };

  const raise = (reason: 'VOLUME' | 'QUALITY' | 'LATE') => dispute.mutate({ reason }, {
    onSuccess: () => toast.info("E'tiroz zavodga yuborildi"),
    onError: (e) => toast.error(e.message, 'Xato'),
  });
  const object = () => dialog("E'tiroz sababi", undefined, [
    { text: 'Hajm kam', onPress: () => raise('VOLUME') },
    { text: 'Sifat', onPress: () => raise('QUALITY') },
    { text: 'Kech keldi', onPress: () => raise('LATE') },
    { text: i18n.t('ui.cancel'), style: 'cancel' },
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <Stack.Screen options={{
        title: 'Qabul qilish',
        headerRight: phone ? () => <IconButton icon="phone" label="Haydovchiga qo'ng'iroq" tone="strong" onPress={() => void Linking.openURL(`tel:${phone}`)} /> : undefined,
      }} />
      <ScrollView scrollEnabled={!drawing} contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.xl, gap: space.stack }}>
        <Appear>
          <View style={[{ borderRadius: radius.hero, borderCurve: 'continuous', backgroundColor: c.bgInverse }, elevation(c).hero]}>
            <View style={{ borderRadius: radius.hero, borderCurve: 'continuous', overflow: 'hidden', padding: space.xl + space.xs, gap: space.sm }}>
              {paletteName === 'chizma' ? <Grid color={c.textOnInverse} /> : null}
              {over ? <Txt v="appbarOverline" numberOfLines={1} style={{ color: c.textOnInverseMuted }}>{over}</Txt> : null}
              <Txt v="titleLg" numberOfLines={2} style={{ color: c.textOnInverse }}>{[grade, m3(doc)].filter(Boolean).join(' · ')}</Txt>
              {d.departedAt ? (
                <Txt v="tSm" style={{ color: c.textOnInverseMuted }}>{`Zavoddan chiqdi ${fmtTime(d.departedAt)} · yoshi ${age} daq`}</Txt>
              ) : null}
            </View>
          </View>
        </Appear>

        <Appear delay={stagger(1)}>
          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', padding: space.md + 2, paddingLeft: space.lg + 2 }, elevation(c).sh1]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="listTitle" numberOfLines={1}>Qabul qilingan hajm</Txt>
              <Txt v="tSm" numberOfLines={1}>{`Hujjat bo'yicha ${m3(doc)}`}</Txt>
            </View>
            {/* 0 m³ server rad etadi (acceptedM3 > 0): umuman qabul qilinmagan bo'lsa — "E'tiroz" */}
            <Stepper value={accepted} onChange={setAccepted} min={Math.min(0.5, doc)} max={doc} />
          </View>
        </Appear>

        <Appear delay={stagger(2)}>
          <SignaturePad ref={pad} onDrawingChange={setDrawing} onChange={(empty) => setSigned(!empty)} />
        </Appear>
      </ScrollView>

      <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.lg) + space.xs }}>
        <Button
          title="Imzolash va qabul qilish" icon={signed ? 'check' : 'lock'} size="sticky"
          variant={signed ? 'primary' : 'secondary'}
          loading={uploading || sign.isPending}
          accessibilityHint={signed ? undefined : "Avval imzo qo'ying"}
          style={signed ? undefined : { opacity: 0.6 }}
          onPress={() => void submit()}
        />
        <Button title="E'tiroz bildirish" variant="secondary" size="lg" textColor={c.danger} loading={dispute.isPending} onPress={object} />
      </View>
    </View>
  );
}
