/**
 * Superadmin bo'limi uchun kichik bloklar: holat kartasi (yashil/sariq/qizil + kechikish + sparkline),
 * sabab so'raydigan tasdiq oynasi, qidiruv uchun debounce.
 * Hammasi dizayn tizimi tokenlari va primitivlaridan — hardcode rang/o'lcham yo'q.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Badge, Button, Card, IconTile, Input, Txt } from '@/design/primitives';
import { Modal } from '@/design/ui';
import { IconName } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { size, space, toneColors } from '@/design/tokens';
import { HEALTH_LABEL, Health, healthTone } from './api';

/** Qidiruv kiritilishi tugagach (350 ms) so'raladi — har harfda serverga bormaydi. */
export function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

/** Kichik sparkline (kechikish tarixi) — chiziq holat rangida. Kamida 2 nuqta kerak. */
export function MiniSpark({ data, tone, height = space.xxxl }: { data: number[]; tone: ReturnType<typeof healthTone>; height?: number }) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  const d = useMemo(() => {
    if (w <= 0 || data.length < 2) return null;
    const pad = 2;
    const mn = Math.min(...data), mx = Math.max(...data);
    const x = (i: number) => pad + (i * (w - 2 * pad)) / (data.length - 1);
    const y = (v: number) => height - pad - ((v - mn) / (mx - mn || 1)) * (height - 2 * pad);
    return data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  }, [w, data, height]);
  const color = toneColors(c, tone === 'neutral' ? 'brand' : tone).solid;
  return (
    <View onLayout={onLayout} style={{ height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {d ? <Svg width={w} height={height}><Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg> : null}
    </View>
  );
}

/** Komponent holat kartasi: plitka + nom + holat nishoni; katta kechikish raqami; ostida izoh va sparkline. */
export function StatusCard({ icon, title, status, metric, unit, caption, spark }: {
  icon: IconName; title: string; status: Health;
  /** Asosiy raqam (ms, ulanish soni …). */ metric?: string | number | null; unit?: string;
  caption?: string; spark?: number[];
}) {
  const tone = healthTone(status);
  return (
    <Card style={{ flex: 1, minWidth: 0, gap: space.sm }} accessible accessibilityLabel={`${title}: ${HEALTH_LABEL[status]}${metric != null ? `, ${metric} ${unit ?? ''}` : ''}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <IconTile icon={icon} tone={tone === 'neutral' ? undefined : tone} size={size.iconTileSm} />
        <Txt v="label" numberOfLines={1} style={{ flex: 1 }}>{title}</Txt>
      </View>
      <Badge label={HEALTH_LABEL[status]} tone={tone} icon={status === 'ok' ? 'circle-check' : status === 'down' ? 'circle-alert' : status === 'degraded' ? 'clock' : 'circle'} style={{ alignSelf: 'flex-start' }} />
      <Txt v="titleLg" numberOfLines={1}>
        {metric == null ? '—' : String(metric)}
        {metric != null && unit ? <Txt v="caption" color="muted">{` ${unit}`}</Txt> : null}
      </Txt>
      {caption ? <Txt v="caption" color="muted" numberOfLines={2}>{caption}</Txt> : null}
      {spark && spark.length > 1 ? <MiniSpark data={spark} tone={tone} /> : null}
    </Card>
  );
}

/**
 * Xavfli amal tasdig'i, sabab bilan (bloklash). Sabab jurnalga yoziladi va foydalanuvchiga
 * ko'rsatilishi mumkin — shuning uchun majburiy (kamida 3 belgi).
 */
export function ReasonConfirm({ open, onClose, onConfirm, title, message, confirmLabel, loading }: {
  open: boolean; onClose: () => void; onConfirm: (reason: string) => void; title: string; message?: string; confirmLabel: string; loading?: boolean;
}) {
  const [reason, setReason] = useState('');
  const ok = reason.trim().length >= 3;
  const close = () => { setReason(''); onClose(); };
  return (
    <Modal
      open={open} onClose={close} title={title} message={message} tone="danger" icon="triangle-alert"
      actions={<>
        <Button title={confirmLabel} size="lg" variant="danger" loading={loading} disabled={!ok} onPress={() => { onConfirm(reason.trim()); setReason(''); }} />
        <Button title="Bekor qilish" size="lg" variant="ghost" onPress={close} />
      </>}
    >
      <Input label="Sabab" required value={reason} onChangeText={setReason} placeholder="Masalan: firibgarlik shikoyati" maxLength={300} autoFocus />
    </Modal>
  );
}
