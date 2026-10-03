import React from 'react';
import { View } from 'react-native';
import { Badge, Card, KPICard, ListGroup, ListItem, SectionHead, Skeleton, Txt, statusLabel } from '@/design/primitives';
import type { IconName } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { LIST_MODULE, ModuleTone, Tone, radius, size, space, toneColors } from '@/design/tokens';
import { Appear, stagger } from '@/design/motion';
import type { ErpCard, ErpRow } from '@/core/erp';

/**
 * ERP bo'limlarining umumiy bo'laklari — dizayn tizimi bloklari ustida.
 * Nima ko'rsatilishini server hal qiladi; bu yerda faqat chizish.
 */

export { statusLabel, SectionHead };

/** Ro'yxat kaliti → modul toni (ikonka plitkasi foni). */
export const listModule = (key?: string | null): ModuleTone => (key ? LIST_MODULE[key] ?? 'brand' : 'brand');

/** Karta bosilganda qayerga borishi — server `open` beradi (batafsil kartochka yoki ro'yxat). */
export const cardHref = (card: ErpCard) => (card.open ? (card.open.id ? `/erp/${card.open.key}/${card.open.id}` : `/erp/list/${card.open.key}`) : null);

/** Ro'yxat kaliti → qator ikoni. */
export const ROW_ICON: Record<string, IconName> = {
  orders: 'file-text', sales: 'trending-up', customers: 'users', leads: 'inbox', invoices: 'receipt',
  production: 'package', recipes: 'droplets', tasks: 'square-check', brigades: 'hard-hat', 'prod-report': 'file-text', 'sex-emp': 'user',
  'brig-issues': 'triangle-alert', 'brig-issue': 'triangle-alert', 'brig-shifts': 'clipboard-check', 'brig-shift': 'clipboard-check',
  trips: 'truck', drivers: 'id-card',
  stock: 'layers', snabjeniye: 'shopping-cart', supply: 'clipboard-list', receipts: 'download', suppliers: 'store',
  cashflow: 'arrow-up-down', payments: 'banknote', employees: 'user',
  approvals: 'circle-check', activity: 'activity',
};

// ───────────────────────── Raqam matnlari ─────────────────────────

/** Oshishi yomon bo'lgan ko'rsatkichlar — o'zgarish rangi teskari (chiqim, kechikish, brak). */
const INVERSE = new Set(['out', 'expense', 'expenses', 'fuel', 'cost', 'payable', 'late', 'overdue', 'defect', 'issues', 'absent', 'low', 't-problem', 'problems', 'receivable', 'blocked']);

export interface ParsedHint {
  /** Oldingi davr bilan taqqoslash: "o'tgan oydan ▲ 12%" → `+12%`. */
  delta?: { text: string; long: string; dir: 'up' | 'down'; tone: Tone };
  /** Qolgan izoh. */
  rest?: string;
}

/** Server izohidan (`hint`) taqqoslash qismini ajratib oladi. */
export function parseHint(hint: string | undefined, key?: string): ParsedHint {
  if (!hint) return {};
  const parts = hint.split(' · ');
  const i = parts.findIndex((p) => /[▲▼]\s*\d/.test(p));
  if (i < 0) return { rest: hint };
  const m = /^(.*?)\s*([▲▼])\s*(\d+(?:[.,]\d+)?%)/.exec(parts[i]!);
  if (!m) return { rest: hint };
  const dir = m[2] === '▲' ? 'up' : 'down';
  const good = (dir === 'up') !== INVERSE.has(key ?? '');
  const sign = dir === 'up' ? '+' : '−';
  const rest = parts.filter((_, j) => j !== i).join(' · ');
  return {
    delta: { text: `${sign}${m[3]}`, long: `${sign}${m[3]}${m[1] ? ` ${m[1]}` : ''}`, dir, tone: good ? 'success' : 'danger' },
    rest: rest || undefined,
  };
}

/** "1 240 m³" → { num: "1 240", unit: "m³" }; raqam bilan boshlanmasa — butunicha. */
export function splitValue(v: string): { num: string; unit?: string } {
  const m = /^([-−+]?\d[\d\s.,]*)\s+(\S.*)$/.exec(v.trim());
  return m ? { num: m[1]!.trim(), unit: m[2] } : { num: v };
}

/** Qiymat "nol"mi (0, 0 ta, —) — e'tibor ro'yxatiga tushmaydi. */
export const isZero = (v: string) => /^(0([.,]0+)?|—|-)(\s|$)/.test(v.trim()) || v.trim() === '0%';

// ───────────────────────── KPI to'ri ─────────────────────────

export interface ErpKpi { card: ErpCard; module?: ModuleTone; onPress?: () => void }

/**
 * 2 ustunli ixcham KPI plitkalari (ikonka chapda, yorliq + qiymat, o'zgarish va izoh) —
 * server kartalari uchun: qiymat tayyor matn bo'lib keladi, izoh (`hint`) yo'qolmaydi.
 */
export function ErpKpiGrid({ items, offset = 0 }: { items: ErpKpi[]; offset?: number }) {
  const rows: ErpKpi[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={{ gap: space.grid }}>
      {rows.map((r, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: space.grid }}>
          {r.map((it, ci) => {
            const h = parseHint(it.card.hint, it.card.key);
            const tone = it.card.tone === 'danger' || it.card.tone === 'warning' ? it.card.tone : undefined;
            return (
              <Appear key={it.card.key} delay={stagger(offset + ri * 2 + ci)} style={{ flex: 1 }}>
                <KPICard
                  layout="inline" label={it.card.label} value={it.card.value} caption={h.rest}
                  icon={it.card.icon ?? 'activity'} module={it.module} tone={tone}
                  delta={h.delta ? { text: h.delta.text, tone: h.delta.tone } : undefined}
                  onPress={it.onPress} style={{ flex: 1 }}
                />
              </Appear>
            );
          })}
          {r.length < 2 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── Qatorlar ─────────────────────────

/** O'ng ustun: summa/son (o'ngga tekislangan) va holat nishoni. */
function RowRight({ row }: { row: ErpRow }) {
  const { c } = useTheme();
  if (!row.right && !row.status) return null;
  // Pul qatori (+kirim / −chiqim) holat nishonisiz keladi — summa yashil/qizil
  const money = !!row.right && !row.status && (row.tone === 'success' || row.tone === 'danger');
  return (
    <View style={{ alignItems: 'flex-end', gap: space.xs, flexShrink: 0, maxWidth: '45%' }}>
      {row.right ? <Txt v="bodyStrong" numberOfLines={1} align="right" style={money ? { color: toneColors(c, row.tone).ink } : undefined}>{row.right}</Txt> : null}
      {row.status ? <Badge label={statusLabel(row.status)} tone={row.tone} /> : null}
    </View>
  );
}

/** Bitta qator — `ListGroup` ichida: ikonka plitkasi, sarlavha + izoh, o'ngda qiymat va holat. */
export function ErpRowItem({ row, icon, module: m = 'brand', onPress }: { row: ErpRow; icon: IconName | string; module?: ModuleTone; onPress?: () => void }) {
  // Holat nishoni bo'lmagan xavfli qator — plitka ton rangida (masalan kam qolgan xomashyo)
  const tone = !row.status && (row.tone === 'danger' || row.tone === 'warning') ? row.tone : undefined;
  return (
    <ListItem
      title={row.title} subtitle={row.subtitle} subtitleLines={2}
      icon={icon} module={m} tone={tone}
      right={<RowRight row={row} />}
      onPress={onPress}
    />
  );
}

/** Qatorlar guruhi (karta-qator o'rniga bitta yumshoq karta, ichki chiziqlar). */
export function RowsGroup({ rows, icon, module: m, onRow }: { rows: ErpRow[]; icon: IconName | string; module?: ModuleTone; onRow?: (r: ErpRow) => (() => void) | undefined }) {
  return (
    <ListGroup>
      {rows.map((r) => <ErpRowItem key={r.id} row={r} icon={icon} module={m} onPress={onRow?.(r)} />)}
    </ListGroup>
  );
}

/** Bo'limda hujjat yo'q — ayblamaydigan qisqa matn, yumshoq karta ichida. */
export function SectionEmpty({ text }: { text: string }) {
  return (
    <Card style={{ paddingVertical: space.xxl, alignItems: 'center' }}>
      <Txt v="bodySm" color="muted" align="center">{text || "Hozircha bo'sh"}</Txt>
    </Card>
  );
}

// ───────────────────────── Skeletonlar ─────────────────────────

/** Ro'yxat yuklanmoqda — qator shakllari. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ListGroup>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.card, paddingVertical: space.md, minHeight: size.row }}>
          <Skeleton width={size.iconTile} height={size.iconTile} radius={radius.lg} />
          <View style={{ flex: 1, gap: space.sm }}>
            <Skeleton width="70%" height={space.md + 2} />
            <Skeleton width="45%" height={space.sm + 2} />
          </View>
          <Skeleton width={space.x12 + space.lg} height={space.md + 2} />
        </View>
      ))}
    </ListGroup>
  );
}

/** Bosh sahifa yuklanmoqda — sarlavha, davr, hero, KPI va amallar shakli. */
export function DashSkeleton({ topInset }: { topInset: number }) {
  return (
    <View style={{ paddingTop: topInset + space.sm, paddingHorizontal: space.pageX, gap: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: space.sm }}>
          <Skeleton width="40%" height={space.md} />
          <Skeleton width="65%" height={space.xxl} />
        </View>
        <Skeleton width={size.touch} height={size.touch} radius={radius.pill} />
        <Skeleton width={size.avatar} height={size.avatar} radius={radius.pill} />
      </View>
      <Skeleton height={size.touch} radius={radius.pill} />
      <Skeleton height={space.x12 * 4} radius={radius.card} />
      {[0, 1].map((r) => (
        <View key={r} style={{ flexDirection: 'row', gap: space.grid }}>
          <View style={{ flex: 1 }}><Skeleton height={space.x12 + space.xxl} radius={radius.card} /></View>
          <View style={{ flex: 1 }}><Skeleton height={space.x12 + space.xxl} radius={radius.card} /></View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {[0, 1, 2, 3].map((i) => <View key={i} style={{ flex: 1 }}><Skeleton height={space.x12 * 2} radius={radius.card} /></View>)}
      </View>
      <ListSkeleton rows={3} />
    </View>
  );
}
