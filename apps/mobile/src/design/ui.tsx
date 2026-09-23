/**
 * ECO System UI — yuqori darajali komponentlar (primitives ustida).
 * Ionicons (@expo/vector-icons, Expo bilan keladi), View-asosli grafiklar (qo'shimcha native modul yo'q).
 */
import React from 'react';
import { Platform, Pressable, ScrollView, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from './theme';
import { elevation, space, type } from './tokens';
import { Card, Txt, fmtSum } from './primitives';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const Icon = ({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) => {
  const { c } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? c.textSecondary} />;
};

/** Tab navigatorlarda push qilingan "yashirin" ekranlar uchun qo'lda header orqaga tugmasi (Tabs o'zi bermaydi). */
export function HeaderBack() {
  const router = useRouter();
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('..'))}
      hitSlop={12}
      style={{ flexDirection: 'row', alignItems: 'center', marginLeft: Platform.OS === 'android' ? 0 : -8, paddingRight: 8 }}
    >
      <Ionicons name={Platform.OS === 'android' ? 'arrow-back' : 'chevron-back'} size={Platform.OS === 'android' ? 24 : 28} color={c.brandPrimary} />
      {Platform.OS === 'ios' ? <Txt style={{ color: c.brandPrimary, fontSize: 17, marginLeft: -2 }}>Orqaga</Txt> : null}
    </Pressable>
  );
}

/** KPI plitka — kichik yorliq, katta raqam, ixtiyoriy delta/ikon. */
export function Kpi({ label, value, icon, tone = 'primary', onPress, style }: { label: string; value: string; icon?: IconName; tone?: 'primary' | 'brand' | 'success' | 'warning' | 'danger' | 'info'; onPress?: () => void; style?: ViewStyle }) {
  const { c, shape } = useTheme();
  const col = { primary: c.textPrimary, brand: c.brandPrimary, success: c.success, warning: c.warning, danger: c.danger, info: c.info }[tone];
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [{ flex: 1, minWidth: '46%', backgroundColor: c.bgSurface, borderRadius: shape.card, padding: 14, borderWidth: Platform.OS === 'android' ? 1 : 0, borderColor: c.border }, elevation.card, pressed && { opacity: 0.85 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="caption" color="secondary" numberOfLines={1} style={{ flex: 1 }}>{label}</Txt>
        {icon ? <Ionicons name={icon} size={16} color={col} /> : null}
      </View>
      <Txt v="subtitle" style={{ color: col, marginTop: 6 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Txt>
    </Pressable>
  );
}

export function ProgressBar({ value, tone, height = 8 }: { value: number; tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info'; height?: number }) {
  const { c } = useTheme();
  const col = { brand: c.brandPrimary, success: c.success, warning: c.warning, danger: c.danger, info: c.info }[tone ?? (value >= 100 ? 'success' : 'brand')];
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: c.bgSurfaceMuted, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height, borderRadius: height / 2, backgroundColor: col }} />
    </View>
  );
}

/** Oylik daromad/xarajat — juft ustunli grafik (View bilan). */
export function BarChart({ data, height = 140 }: { data: { label: string; a: number; b?: number }[]; height?: number }) {
  const { c } = useTheme();
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b ?? 0]));
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 8 }}>
        {data.map((d) => (
          <View key={d.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: height - 18 }}>
              <View style={{ width: d.b === undefined ? 18 : 10, height: Math.max(3, ((height - 18) * d.a) / max), borderRadius: 4, backgroundColor: c.brandPrimary }} />
              {d.b !== undefined ? <View style={{ width: 10, height: Math.max(3, ((height - 18) * d.b) / max), borderRadius: 4, backgroundColor: c.brandAccent }} /> : null}
            </View>
            <Txt v="caption" color="secondary" style={{ marginTop: 4 }}>{d.label}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Legend({ items }: { items: { label: string; tone: 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted' }[] }) {
  const { c } = useTheme();
  const col = { brand: c.brandPrimary, accent: c.brandAccent, success: c.success, warning: c.warning, danger: c.danger, info: c.info, muted: c.textSecondary };
  return (
    <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
      {items.map((i) => <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: col[i.tone] }} /><Txt v="caption" color="secondary">{i.label}</Txt></View>)}
    </View>
  );
}

/** Gorizontal taqsimot (kategoriya bo'yicha xarajat). */
export function Breakdown({ rows, total }: { rows: { label: string; value: number }[]; total?: number }) {
  const { c } = useTheme();
  const sum = (total ?? rows.reduce((s, r) => s + r.value, 0)) || 1;
  const palette = [c.brandPrimary, c.brandAccent, c.info, c.success, c.warning, c.danger, c.textSecondary];
  return (
    <View>
      <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: c.bgSurfaceMuted }}>
        {rows.map((r, i) => <View key={r.label} style={{ width: `${(r.value / sum) * 100}%`, backgroundColor: palette[i % palette.length] }} />)}
      </View>
      {rows.map((r, i) => (
        <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette[i % palette.length], marginRight: 10 }} />
          <Txt v="callout" style={{ flex: 1 }}>{r.label}</Txt>
          <Txt v="callout" color="secondary" style={{ marginRight: 10 }}>{Math.round((r.value / sum) * 100)}%</Txt>
          <Txt v="bodyStrong">{fmtSum(r.value)}</Txt>
        </View>
      ))}
    </View>
  );
}

export function Avatar({ name, size = 40, tone }: { name?: string | null; size?: number; tone?: 'brand' | 'info' | 'warning' }) {
  const { c } = useTheme();
  const initials = (name ?? '?').split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const bg = { brand: c.brandPrimarySoft, info: c.info + '22', warning: c.warning + '22' }[tone ?? 'brand'];
  const fg = { brand: c.brandPrimary, info: c.info, warning: c.warning }[tone ?? 'brand'];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Txt style={{ color: fg, fontWeight: '700', fontSize: size * 0.4 }}>{initials}</Txt>
    </View>
  );
}

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'; icon?: IconName }) {
  const { c, shape } = useTheme();
  const col = { neutral: c.textSecondary, brand: c.brandPrimary, success: c.success, warning: c.warning, danger: c.danger, info: c.info }[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: shape.chip, backgroundColor: col + '1A', gap: 4 }}>
      {icon ? <Ionicons name={icon} size={12} color={col} /> : null}
      <Txt v="caption" style={{ color: col, fontWeight: '600' }}>{label}</Txt>
    </View>
  );
}

export function Segmented<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string }[] }) {
  const { c, shape } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {items.map((s) => (
        <Pressable key={s.key} onPress={() => onChange(s.key)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: shape.chip, backgroundColor: value === s.key ? c.brandPrimary : c.bgSurface, borderWidth: Platform.OS === 'android' ? 1 : 0, borderColor: c.border }}>
          <Txt v="caption" style={{ color: value === s.key ? c.textOnBrand : c.textPrimary, fontWeight: '600' }}>{s.label}</Txt>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Ro'yxat qatori: ikonli aylana + sarlavha + subtitr + o'ng tomon. */
export function Row({ icon, iconTone = 'brand', title, subtitle, right, onPress, avatarName, last }: { icon?: IconName; iconTone?: 'brand' | 'info' | 'warning' | 'danger' | 'success'; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; avatarName?: string | null; last?: boolean }) {
  const { c, shape } = useTheme();
  const col = { brand: c.brandPrimary, info: c.info, warning: c.warning, danger: c.danger, success: c.success }[iconTone];
  return (
    <Pressable onPress={onPress} disabled={!onPress} android_ripple={{ color: c.border }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: c.border }, Platform.OS === 'ios' && pressed && { opacity: 0.6 }]}>
      {avatarName !== undefined ? <Avatar name={avatarName} size={40} /> : icon ? <View style={{ width: 40, height: 40, borderRadius: Math.min(shape.card, 20), backgroundColor: col + '1A', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={20} color={col} /></View> : null}
      <View style={{ flex: 1, marginLeft: icon || avatarName !== undefined ? 12 : 0 }}>
        <Txt v="bodyStrong" numberOfLines={1}>{title}</Txt>
        {subtitle ? <Txt v="caption" color="secondary" numberOfLines={2}>{subtitle}</Txt> : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={c.textSecondary} style={{ marginLeft: 6 }} /> : null}
    </Pressable>
  );
}

export function Section({ title, action, onAction, children, style }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ marginTop: space.xl }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space.sm, paddingHorizontal: 2 }}>
        <Txt v="heading">{title}</Txt>
        {action ? <Pressable onPress={onAction} hitSlop={8}><Txt v="callout" color="brand" style={{ fontWeight: '600' }}>{action}</Txt></Pressable> : null}
      </View>
      <Card style={{ paddingVertical: 4 }}>{children}</Card>
    </View>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => <Ionicons key={i} name={value >= i - 0.25 ? 'star' : value >= i - 0.75 ? 'star-half' : 'star-outline'} size={size} color={c.brandAccent} />)}
      <Txt v="caption" color="secondary" style={{ marginLeft: 4 }}>{value.toFixed(1)}</Txt>
    </View>
  );
}

export function StatusLine({ icon, text }: { icon: string; text: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}><Txt style={{ fontSize: 16, marginRight: 10 }}>{icon}</Txt><Txt v="callout">{text}</Txt></View>;
}

/** Tab ikonlari (Ionicons) — rolga qarab. */
export const tabIcon = (name: IconName, focusedName?: IconName) => ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? (focusedName ?? name) : name} size={24} color={color} />;

export const fmtShort = (n: number | string) => { const v = Number(n); return v >= 1_000_000_000 ? `${(v / 1_000_000_000).toFixed(1)} mlrd` : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(v >= 100_000_000 ? 0 : 1)} mln` : v >= 1_000 ? `${Math.round(v / 1_000)} ming` : String(Math.round(v)); };
export const fmtRel = (d: string | Date) => { const ms = Date.now() - new Date(d).getTime(); const m = Math.round(ms / 60_000); if (m < 1) return 'hozir'; if (m < 60) return `${m} daq`; const h = Math.round(m / 60); if (h < 24) return `${h} soat`; const dd = Math.round(h / 24); return dd === 1 ? 'kecha' : `${dd} kun`; };
export const daysLeft = (d?: string | null) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000) : null);
export { type as typeScale };
