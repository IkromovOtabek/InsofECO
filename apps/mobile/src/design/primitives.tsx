import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { DeliveryStatus, OrderStatus } from '@insof/shared';
import { useTheme } from './theme';
import { elevation, hit, onColor, space, type } from './tokens';

// ───────── Typography ─────────
type Variant = keyof typeof type;
export function Txt({ v = 'body', color, style, ...p }: TextProps & { v?: Variant; color?: 'primary' | 'secondary' | 'onBrand' | 'danger' | 'success' | 'warning' | 'brand' }) {
  const { c } = useTheme();
  const col = { primary: c.textPrimary, secondary: c.textSecondary, onBrand: c.textOnBrand, danger: c.danger, success: c.success, warning: c.warning, brand: c.brandPrimary }[color ?? 'primary'];
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  /**
   * O'z shriftimiz berilgan bo'lsa (`erpText.*`), variantning `fontWeight` va
   * `lineHeight` i olib tashlanadi.
   *
   * Nega: "IBMPlexSans_600SemiBold" allaqachon yarim qalin shrift. Ustiga yana
   * `fontWeight: '400'` qo'shilsa, Android harflarni sun'iy o'zgartirib chizadi —
   * lekin matn kengligi O'LCHANGANDA bu hisobga olinmaydi. Natijada bemalol
   * sig'adigan yozuv ham qirqilib qoladi ("Yetkazildi" → "Yetkazil…").
   * `lineHeight` ham variantniki (17 px matn uchun) bo'lib, 10 px chip ichida
   * ortiqcha joy egallardi — pastdagi `auto` uni o'lchamga qarab qayta hisoblaydi.
   */
  const base = flat?.fontFamily ? { ...type[v], fontWeight: undefined, lineHeight: undefined } : type[v];
  // Maxsus fontSize berilsa (lineHeight'siz) — shkala lineHeight'i kesib qo'ymasligi uchun avtomatik hisoblanadi
  const auto = flat?.fontSize && !flat.lineHeight ? { lineHeight: Math.round(flat.fontSize * 1.25) } : null;
  return <Text {...p} style={[base, { color: col }, style, auto]} maxFontSizeMultiplier={1.4} />;
}

// ───────── Layout ─────────
export function Screen({ children, style, padded = true, ...p }: ViewProps & { padded?: boolean }) {
  const { c } = useTheme();
  return (
    <View {...p} style={[{ flex: 1, backgroundColor: c.bgCanvas }, padded && { padding: space.lg }, style]}>
      {children}
    </View>
  );
}

export function Card({ children, style, ...p }: ViewProps) {
  const { c, shape } = useTheme();
  return (
    <View {...p} style={[{ backgroundColor: c.bgSurface, borderRadius: shape.card, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border }, elevation.card, style]}>
      {children}
    </View>
  );
}

export const Row = ({ style, ...p }: ViewProps) => <View {...p} style={[{ flexDirection: 'row', alignItems: 'center' }, style]} />;
export const Gap = ({ h = space.md }: { h?: number }) => <View style={{ height: h, width: h }} />;

// ───────── Button ─────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BtnSize = 'md' | 'lg' | 'xl';
export function Button({
  title, variant = 'primary', size = 'lg', loading, disabled, style, onPress, ...p
}: PressableProps & { title: string; variant?: BtnVariant; size?: BtnSize; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c, shape } = useTheme();
  const bg = { primary: c.brandPrimary, secondary: c.brandPrimarySoft, ghost: 'transparent', danger: c.danger }[variant];
  const fg = { primary: c.textOnBrand, secondary: c.brandPrimary, ghost: c.brandPrimary, danger: onColor(c.danger) }[variant];
  const height = { md: hit.minTarget, lg: 50, xl: hit.driverTarget }[size];
  const txt: TextStyle = size === 'xl' ? type.driverButton : type.bodyStrong;
  return (
    <Pressable
      {...p}
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={(e) => { if (Platform.OS === 'ios') void Haptics.selectionAsync(); onPress?.(e); }}
      android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
      style={({ pressed }) => [
        { height, borderRadius: shape.button, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, overflow: 'hidden' },
        (disabled || loading) && { opacity: 0.5 },
        Platform.OS === 'ios' && pressed && { opacity: 0.7 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[txt, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

// ───────── Field ─────────
export function Field({ label, error, style, ...p }: TextInputProps & { label?: string; error?: string }) {
  const { c, shape } = useTheme();
  return (
    <View style={{ marginBottom: space.lg }}>
      {label ? <Txt v="caption" color="secondary" style={{ marginBottom: space.xs }}>{label}</Txt> : null}
      <TextInput
        {...p}
        placeholderTextColor={c.textSecondary}
        style={[
          // iOS: inset-grouped uslub — chegara yo'q, yumshoq fon; Android: outlined
          Platform.OS === 'ios'
            ? { height: 50, borderRadius: shape.input, backgroundColor: c.bgSurface, borderWidth: error ? 1 : 0, borderColor: c.danger, paddingHorizontal: space.lg, color: c.textPrimary, ...type.body }
            : { height: 52, borderRadius: shape.input, borderWidth: 1, borderColor: error ? c.danger : c.border, backgroundColor: c.bgSurface, paddingHorizontal: space.lg, color: c.textPrimary, ...type.body },
          style,
        ]}
      />
      {error ? <Txt v="caption" color="danger" style={{ marginTop: space.xs }}>{error}</Txt> : null}
    </View>
  );
}

/** iOS "section header" — kichik, kulrang, katta harf. */
export function SectionLabel({ children }: { children: string }) {
  return <Txt v="caption" color="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: space.sm, marginLeft: space.xs }}>{children}</Txt>;
}

// ───────── Status chip ─────────
const STATUS_TONE: Record<string, 'neutral' | 'info' | 'brand' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral', SUBMITTED: 'neutral',
  CONFIRMED: 'info', SCHEDULED: 'info', ASSIGNED: 'info', ACCEPTED: 'info',
  IN_PROGRESS: 'brand', LOADING: 'brand', EN_ROUTE: 'brand', ARRIVED: 'brand', UNLOADING: 'brand',
  DELIVERED: 'success', COMPLETED: 'success',
  DISPUTED: 'warning',
  REJECTED: 'danger', FAILED: 'danger', CANCELLED: 'danger', DECLINED: 'danger',
  NEW: 'neutral', WORKER_ASSIGNED: 'info', REVIEW: 'warning', DONE: 'success', PAID: 'success', PENDING: 'warning', APPROVED: 'info',
  PLANNING: 'neutral', ACTIVE: 'brand', DELAYED: 'warning', ON_HOLD: 'neutral', TODO: 'neutral',
  // Insof ERP holatlari
  BLOCKED: 'danger', IN_PRODUCTION: 'brand', CLOSED: 'success', PLANNED: 'info', LOADED: 'warning', ON_ROAD: 'brand',
  OPEN: 'warning', PARTIAL: 'warning', Kam: 'danger', Faol: 'success', Nofaol: 'danger',
};
export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Qoralama', SUBMITTED: 'Yuborildi', CONFIRMED: 'Tasdiqlandi', SCHEDULED: 'Rejalashtirildi', IN_PROGRESS: 'Jarayonda',
  DELIVERED: 'Yetkazildi', COMPLETED: 'Yakunlandi', REJECTED: 'Rad etildi', CANCELLED: 'Bekor qilindi',
  ASSIGNED: 'Biriktirildi', ACCEPTED: 'Qabul qilindi', DECLINED: 'Rad etdi', LOADING: 'Yuklanmoqda', EN_ROUTE: 'Yo\'lda',
  ARRIVED: 'Yetib keldi', UNLOADING: 'Tushirilmoqda', DISPUTED: 'E\'tiroz', FAILED: 'Muvaffaqiyatsiz',
  // ECO
  NEW: 'Yangi', WORKER_ASSIGNED: 'Quruvchi biriktirildi', REVIEW: 'Tekshiruv', DONE: 'Tugallandi', PAID: "To'lov olindi",
  PENDING: 'Kutilmoqda', APPROVED: 'Tasdiqlandi', PLANNING: 'Reja', ACTIVE: 'Faol', DELAYED: 'Kechikmoqda', ON_HOLD: "To'xtatilgan",
  TODO: 'Bajarilmagan', LOW: 'Past', MEDIUM: "O'rta", HIGH: 'Yuqori',
  // Insof ERP
  BLOCKED: 'Bloklangan', IN_PRODUCTION: 'Ishlab chiqarishda', CLOSED: 'Yopildi', PLANNED: 'Rejada',
  LOADED: 'Yuklandi', ON_ROAD: "Yo'lda", OPEN: 'Ochiq', PARTIAL: 'Qisman',
};
export function StatusChip({ status }: { status: string }) {
  const { c, shape } = useTheme();
  const tone = STATUS_TONE[status] ?? 'neutral';
  const col = { neutral: c.textSecondary, info: c.info, brand: c.brandPrimary, success: c.success, warning: c.warning, danger: c.danger }[tone];
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: shape.chip, backgroundColor: col + '1A' }}>
      <Text style={[type.caption, { color: col, fontWeight: '600' }]}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
}

// ───────── List item ─────────
export function ListItem({ title, subtitle, right, onPress }: { title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} android_ripple={{ color: c.border }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, minHeight: hit.minTarget }, Platform.OS === 'ios' && pressed && { opacity: 0.6 }]}>
      <View style={{ flex: 1 }}>
        <Txt v="bodyStrong">{title}</Txt>
        {subtitle ? <Txt v="caption" color="secondary">{subtitle}</Txt> : null}
      </View>
      {right}
      {onPress ? <Txt color="secondary" style={{ marginLeft: space.sm }}>{Platform.OS === 'ios' ? '›' : '→'}</Txt> : null}
    </Pressable>
  );
}

// ───────── Stat (KPI) ─────────
export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'brand' | 'warning' | 'danger' }) {
  return (
    <Card style={{ flex: 1, padding: space.md }}>
      <Txt v="caption" color="secondary">{label}</Txt>
      <Txt v="title" color={tone ?? 'primary'} style={{ marginTop: space.xs }}>{value}</Txt>
    </Card>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xxxl }}>
      <Txt v="heading" style={{ textAlign: 'center' }}>{title}</Txt>
      {hint ? <Txt color="secondary" style={{ textAlign: 'center', marginTop: space.sm }}>{hint}</Txt> : null}
    </View>
  );
}

export const fmtSum = (n: number | string) => `${Math.round(Number(n)).toLocaleString('ru-RU')} so'm`;
export const fmtM3 = (n: number | string) => `${Number(n)} m³`;
export const fmtTime = (d: string | Date) => new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
