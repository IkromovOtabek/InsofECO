import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconTile, Input, Txt } from '@/design/primitives';
import { AttentionList, PageHeader, SectionHead, SegmentedControl, StickyActionBar } from '@/design/blocks';
import { Icon, type IconName } from '@/design/icons';
import { Sheet, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { haptic } from '@/design/motion';
import { ApiException } from '@/core/api';
import type { Tone } from '@/core/erp';
import { useErpAction } from './api';

/**
 * Brigadir amal oynalari — yozish o'rniga tanlash (`docs/redesign/brigada-shablonlar.html`, 02 va 03):
 * fakt — raqam klaviaturasi (oyna), muammo — katta plitkalar va variantlar (to'liq sahifa), brak — −/+ va tayyor sabablar.
 * Server amallari o'zgarmagan (`task.progress`, `task.finish`, `issue.*`, `task.defect` / `shift.defect`) — faqat ko'rinish yangi.
 */

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ','));
const parse = (s: string) => Number(s.replace(',', '.')) || 0;
const errText = (e: unknown) => (e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring');

/** Tanlov chipi: bosilganda belgilanadi. Katta (44 dp) — qo'lqop bilan ham bosiladi. */
export function Chip({ label, on, onPress, icon, success }: { label: string; on?: boolean; onPress: () => void; icon?: IconName; /** Yashil (masalan «Hammasi · 18»). */ success?: boolean }) {
  const { c } = useTheme();
  const ink = success ? c.success : on ? c.brandInk : c.textStrong;
  return (
    <Pressable
      onPress={() => { haptic.selection(); onPress(); }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={{
        minHeight: size.touch, paddingHorizontal: space.md + 2, borderRadius: radius.sm, borderCurve: 'continuous',
        flexDirection: 'row', alignItems: 'center', gap: space.xs,
        backgroundColor: success ? c.successBg : on ? c.brandSoft : c.bgSubtle, borderWidth: 1.5, borderColor: success ? c.success : on ? c.brand : c.borderSubtle,
      }}
    >
      {on || success ? <Icon name="check" size={size.iconSm} color={ink} strokeWidth={2.4} /> : icon ? <Icon name={icon} size={size.iconSm} color={c.textBody} /> : null}
      <Txt v="bodyStrong" style={{ color: ink }}>{label}</Txt>
    </Pressable>
  );
}

function Chips({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: center ? 'center' : 'flex-start' }}>{children}</View>;
}

function Question({ children }: { children: string }) {
  return <Txt v="titleSm" style={{ marginTop: space.md, marginBottom: space.sm }}>{children}</Txt>;
}

// ───────────────────────── Fakt yozish ─────────────────────────

export interface FactTask { id: string; taskNo: string; product: string; unit: string; left: number }

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'] as const;

/**
 * «Fakt yozish» — raqam klaviaturasi (tizim klaviaturasi ochilmaydi). «Hammasi» qoldiqni yozadi va topshiriqni yopadi
 * (`task.finish`); qolgan holatda — `task.progress`. Brak — oddiy Yo'q / Ha, «Ha» bo'lsa miqdor va sabab.
 */
export function FactSheet({ task, reasons, onClose }: { task: FactTask; reasons: string[]; onClose: () => void }) {
  const { c } = useTheme();
  const run = useErpAction();
  const [val, setVal] = useState('');
  const [brak, setBrak] = useState<'no' | 'yes'>('no');
  const [dq, setDq] = useState('');
  const [reason, setReason] = useState(reasons[0] ?? 'Boshqa');
  const n = parse(val);
  const finish = task.left > 0 && n === task.left;

  const key = (k: (typeof KEYS)[number]) => {
    haptic.light();
    setVal((v) => {
      if (k === 'del') return v.slice(0, -1);
      if (k === ',') return v.includes(',') ? v : `${v || '0'},`;
      if (v.replace(',', '').length >= 7) return v;
      return v === '0' ? k : v + k;
    });
  };
  const add = (d: number) => setVal((v) => fmt(parse(v) + d));

  const submit = async () => {
    if (!(n > 0)) { haptic.warning(); toast.warning('Bajarilgan miqdorni kiriting'); return; }
    const defect = brak === 'yes' && parse(dq) > 0 ? { defectQty: String(parse(dq)), defectReason: reason } : {};
    try {
      const r = await run.mutateAsync(finish
        ? { action: 'task.finish', id: task.id, payload: defect }
        : { action: 'task.progress', id: task.id, payload: { qty: String(n), ...defect } });
      haptic.success();
      toast.success(r?.message ?? 'Qayd qilindi', `${task.taskNo}: +${fmt(n)} ${task.unit}`);
      onClose();
    } catch (e) {
      haptic.error();
      toast.error(errText(e));
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Fakt yozish"
      footer={<Button title={finish ? `Saqlash va yakunlash · ${fmt(n)} ${task.unit}` : n > 0 ? `Saqlash · ${fmt(n)} ${task.unit}` : 'Saqlash'} size="lg" variant={finish ? 'success' : 'primary'} loading={run.isPending} onPress={() => void submit()} />}
    >
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="caption" color="muted">{task.taskNo}</Txt>
            <Txt v="titleSm" numberOfLines={1}>{task.product}</Txt>
          </View>
          <Txt v="bodyStrong" color="warning">qoldiq {fmt(task.left)} {task.unit}</Txt>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: space.sm, paddingVertical: space.xs }}>
          <Txt v="metricHero" style={{ color: n > 0 ? c.textStrong : c.textFaint }}>{val || '0'}</Txt>
          <Txt v="titleMd" color="muted">{task.unit}</Txt>
        </View>
        {n > task.left && task.left > 0 ? <Txt v="caption" color="warning" align="center">Qoldiqdan ko&apos;p — ortig&apos;ini ishlab chiqarish tasdiqlaydi</Txt> : null}

        <Chips center>
          {task.left > 0 ? <Chip label={`Hammasi · ${fmt(task.left)}`} success onPress={() => setVal(fmt(task.left))} /> : null}
          <Chip label="+1" onPress={() => add(1)} />
          <Chip label="+5" onPress={() => add(5)} />
          <Chip label="+10" onPress={() => add(10)} />
        </Chips>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {KEYS.map((k) => (
            <Pressable
              key={k}
              onPress={() => key(k)}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? "O'chirish" : k}
              style={({ pressed }) => ({ width: '31.5%', height: size.buttonLg, borderRadius: radius.sm, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.bgMuted : c.bgSubtle })}
            >
              {k === 'del' ? <Icon name="delete" size={size.iconLg} color={c.textStrong} /> : <Txt v="titleLg">{k}</Txt>}
            </Pressable>
          ))}
        </View>

        <View style={{ gap: space.sm }}>
          <Txt v="titleSm">Brak chiqdimi?</Txt>
          <SegmentedControl items={[{ key: 'no', label: "Yo'q" }, { key: 'yes', label: 'Ha' }]} value={brak} onChange={setBrak} />
          {brak === 'yes' ? (
            <>
              <Input value={dq} onChangeText={setDq} keyboardType="decimal-pad" placeholder={`Brak miqdori, ${task.unit}`} containerStyle={{ marginBottom: 0 }} />
              <Chips>{reasons.map((r) => <Chip key={r} label={r} on={reason === r} onPress={() => setReason(r)} />)}</Chips>
            </>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}

// ───────────────────────── Muammo bildirish ─────────────────────────

export type IssueKind = 'equipment' | 'material' | 'staff' | 'other';

const KINDS: { kind: IssueKind; title: string; owner: string; icon: IconName; tone: Tone }[] = [
  { kind: 'equipment', title: 'Uskuna buzildi', owner: 'Mexanik', icon: 'wrench', tone: 'danger' },
  { kind: 'material', title: "Material yo'q", owner: 'Sklad, snabjeniye', icon: 'package', tone: 'warning' },
  { kind: 'staff', title: 'Ishchi kerak', owner: 'Otdel kadr', icon: 'user-plus', tone: 'info' },
  { kind: 'other', title: 'Boshqa', owner: 'Ishlab chiqarish', icon: 'ellipsis', tone: 'brand' },
];
export const isIssueKind = (v: unknown): v is IssueKind => KINDS.some((k) => k.kind === v);
const DOWN = [{ label: 'Hozir', min: 0 }, { label: '15 daq', min: 15 }, { label: '30 daq', min: 30 }, { label: '1 soat+', min: 60 }];
const OTHER = [{ key: 'DELAY', label: 'Kechikish' }, { key: 'QUALITY', label: 'Sifat' }, { key: 'OTHER', label: 'Boshqa' }];

/**
 * «Muammo bildirish» — to'liq sahifa (`/erp/muammo`, maket 03): 1-qadam — 4 ta katta plitka (kim hal qilishi plitkada)
 * va hozir ochiq muammolar; 2-qadam — faqat tanlov, izoh ixtiyoriy. `refId` — topshiriq id yoki `b~<brigadeId>`;
 * ikkinchisida topshiriq ham tanlanadi (`tasks`).
 */
export function IssueScreen({ refId, tasks, equipment, open, kind: initial, onBack, onDone, onOpen }: {
  refId: string;
  tasks: { id: string; taskNo: string }[];
  equipment: string[];
  /** Hozir ochiq muammolar (1-qadam ostida). */ open: { id: string; title: string; subtitle?: string; right?: string; tone?: Tone }[];
  kind?: IssueKind;
  onBack: () => void;
  onDone: () => void;
  onOpen: (id: string) => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const run = useErpAction();
  const [kind, setKind] = useState<IssueKind | null>(initial ?? null);
  const [eq, setEq] = useState(equipment[0] ?? '');
  const [custom, setCustom] = useState(!equipment.length);
  const [taskId, setTaskId] = useState('');
  const [down, setDown] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(1);
  const [other, setOther] = useState('DELAY');
  const meta = KINDS.find((k) => k.kind === kind);
  const fromTask = !refId.startsWith('b~');
  const soft = (t: Tone) => (t === 'danger' ? { bg: c.dangerBg, ink: c.danger } : t === 'warning' ? { bg: c.warningBg, ink: c.warning } : t === 'info' ? { bg: c.infoBg, ink: c.info } : { bg: c.bgSurface, ink: c.textStrong });

  const submit = async () => {
    if (!kind) return;
    if (kind === 'equipment' && !eq.trim()) { haptic.warning(); toast.warning('Qaysi uskuna — tanlang yoki yozing'); return; }
    if ((kind === 'material' || kind === 'other') && !note.trim()) { haptic.warning(); toast.warning(kind === 'material' ? 'Qaysi material va qancha kerakligini yozing' : 'Muammoni qisqacha yozing'); return; }
    const payload: Record<string, unknown> = {
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(!fromTask && taskId ? { taskId } : {}),
      ...(down != null && (kind === 'equipment' || kind === 'other') ? { downtimeMin: String(down) } : {}),
      ...(kind === 'equipment' ? { equipment: eq.trim() } : {}),
      ...(kind === 'staff' ? { qty: String(qty) } : {}),
      ...(kind === 'other' ? { kind: other } : {}),
    };
    try {
      const r = await run.mutateAsync({ action: `issue.${kind}`, id: refId, payload });
      haptic.success();
      toast.success(r?.message ?? 'Yuborildi', meta ? `${meta.title} → ${meta.owner}` : undefined);
      onDone();
    } catch (e) {
      haptic.error();
      toast.error(errText(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title={meta ? meta.title : "Nima bo'ldi?"} onBack={meta && !initial ? () => setKind(null) : onBack} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: insets.bottom + space.x12 * 2 }}>
        {!meta ? (
          <View style={{ gap: space.stack }}>
            <Txt v="body" color="muted">Bitta plitkani bosing — yozish shart emas. Kim hal qilishi pastida ko&apos;rinadi.</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm }}>
              {KINDS.map((k) => {
                const col = soft(k.tone);
                return (
                  <Pressable
                    key={k.kind}
                    onPress={() => { haptic.light(); setKind(k.kind); }}
                    accessibilityRole="button"
                    accessibilityLabel={`${k.title} — ${k.owner}`}
                    style={({ pressed }) => ({ width: '48.5%', minHeight: 156, padding: space.lg, borderRadius: radius.xl, borderCurve: 'continuous', backgroundColor: col.bg, opacity: pressed ? 0.85 : 1, justifyContent: 'space-between', borderWidth: 1, borderColor: c.borderSubtle })}
                  >
                    <IconTile icon={k.icon} tone={k.tone} size={size.iconTile + space.sm} bg={k.tone === 'brand' ? c.bgSubtle : c.bgSurface} />
                    <View style={{ gap: space.xs }}>
                      <Txt v="titleMd" style={{ color: col.ink }}>{k.title}</Txt>
                      <Txt v="caption" style={{ color: col.ink }}>→ {k.owner}</Txt>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {open.length ? (
              <>
                <SectionHead title={`Hozir ochiq · ${open.length}`} />
                <AttentionList items={open.map((r) => ({
                  title: r.title, sub: r.subtitle, icon: r.tone === 'danger' ? 'wrench' : 'triangle-alert', module: 'brand',
                  badge: r.right ? { text: r.right, tone: r.tone === 'danger' ? 'danger' : 'warning' } : undefined, onPress: () => onOpen(r.id),
                }))} />
              </>
            ) : null}
          </View>
        ) : (
          <View>
            {kind === 'equipment' ? (
              <>
                <Question>Qaysi uskuna?</Question>
                <Chips>
                  {equipment.map((e) => <Chip key={e} label={e} on={!custom && eq === e} onPress={() => { setCustom(false); setEq(e); }} />)}
                  <Chip label="Boshqa" icon="plus" on={custom} onPress={() => { setCustom(true); setEq(''); }} />
                </Chips>
                {custom ? <Input value={eq} onChangeText={setEq} placeholder="Uskuna nomi" containerStyle={{ marginTop: space.sm, marginBottom: 0 }} /> : null}
              </>
            ) : null}

            {kind === 'staff' ? (
              <>
                <Question>Nechta ishchi kerak?</Question>
                <Chips>{[1, 2, 3, 4, 5].map((q) => <Chip key={q} label={`${q} kishi`} on={qty === q} onPress={() => setQty(q)} />)}</Chips>
              </>
            ) : null}

            {kind === 'other' ? (
              <>
                <Question>Qanday muammo?</Question>
                <Chips>{OTHER.map((o) => <Chip key={o.key} label={o.label} on={other === o.key} onPress={() => setOther(o.key)} />)}</Chips>
              </>
            ) : null}

            {!fromTask && tasks.length ? (
              <>
                <Question>Qaysi topshiriq?</Question>
                <Chips>
                  {tasks.map((t) => <Chip key={t.id} label={t.taskNo} on={taskId === t.id} onPress={() => setTaskId(t.id)} />)}
                  <Chip label="Umumiy" on={!taskId} onPress={() => setTaskId('')} />
                </Chips>
              </>
            ) : null}

            {kind === 'equipment' || kind === 'other' ? (
              <>
                <Question>Qachondan beri to&apos;xtagan?</Question>
                <Chips>{DOWN.map((d) => <Chip key={d.label} label={d.label} on={down === d.min} onPress={() => setDown(down === d.min ? null : d.min)} />)}</Chips>
              </>
            ) : null}

            <Question>{kind === 'material' ? 'Qaysi material, qancha kerak?' : kind === 'other' ? 'Tavsif' : 'Izoh (ixtiyoriy)'}</Question>
            <Input
              value={note}
              onChangeText={setNote}
              placeholder={kind === 'material' ? 'masalan: armatura 12 mm — 200 kg' : kind === 'staff' ? "ish hajmi, kelmagan xodim o'rniga…" : 'qisqacha'}
              multiline
              containerStyle={{ marginBottom: 0 }}
              style={{ minHeight: 64, paddingVertical: space.sm, textAlignVertical: 'top' }}
            />
          </View>
        )}
      </ScrollView>
      {meta ? <StickyActionBar primary={{ title: `Yuborish · ${meta.owner}`, icon: 'send', onPress: () => void submit(), loading: run.isPending, variant: meta.tone === 'danger' ? 'danger' : 'primary' }} /> : null}
    </View>
  );
}

// ───────────────────────── Brak qayd qilish ─────────────────────────

/** «Brak qayd qilish» — mahsulot, −/+ miqdor va tayyor sabab. Topshiriqdan — `task.defect`, bosh sahifadan — `shift.defect` (`b~<brigadeId>`). */
export function DefectSheet({ refId, products, reasons, onClose }: {
  refId: string;
  products: { id: string; name: string; unit: string }[];
  reasons: string[];
  onClose: () => void;
}) {
  const { c } = useTheme();
  const run = useErpAction();
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState(reasons[0] ?? 'Boshqa');
  const p = products.find((x) => x.id === productId);
  const step = p && /m³|m3/.test(p.unit) ? 0.5 : 1;
  const bump = (d: number) => { haptic.light(); setQty((v) => fmt(Math.max(0, parse(v) + d))); };
  const action = refId.startsWith('b~') ? 'shift.defect' : 'task.defect';

  const submit = async () => {
    if (!productId) { haptic.warning(); toast.warning('Mahsulotni tanlang'); return; }
    if (!(parse(qty) > 0)) { haptic.warning(); toast.warning('Brak miqdorini kiriting'); return; }
    try {
      const r = await run.mutateAsync({ action, id: refId, payload: { productId, qty: String(parse(qty)), reason } });
      haptic.success();
      toast.success(r?.message ?? 'Brak qayd qilindi');
      onClose();
    } catch (e) {
      haptic.error();
      toast.error(errText(e));
    }
  };

  return (
    <Sheet open onClose={onClose} title="Brak qayd qilish" footer={<Button title="Brakni yozish" size="lg" variant="danger" loading={run.isPending} onPress={() => void submit()} />}>
      {!products.length ? <Txt v="body" color="muted">Faol topshiriq yo&apos;q — brak topshiriq mahsuloti bo&apos;yicha yoziladi.</Txt> : (
        <View>
          {products.length > 1 ? (
            <>
              <Question>Qaysi mahsulot?</Question>
              <Chips>{products.map((x) => <Chip key={x.id} label={x.name} on={productId === x.id} onPress={() => setProductId(x.id)} />)}</Chips>
            </>
          ) : <Txt v="titleSm">{p?.name}</Txt>}
          <Question>{`Miqdori${p ? `, ${p.unit}` : ''}`}</Question>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
            <Pressable onPress={() => bump(-step)} accessibilityRole="button" accessibilityLabel="Kamaytirish" style={{ width: size.buttonLg, height: size.buttonLg, borderRadius: radius.sm, backgroundColor: c.bgSubtle, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="minus" size={size.iconLg} color={c.textStrong} />
            </Pressable>
            <Txt v="metricHero" align="center" style={{ minWidth: 96 }}>{qty || '0'}</Txt>
            <Pressable onPress={() => bump(step)} accessibilityRole="button" accessibilityLabel="Ko'paytirish" style={{ width: size.buttonLg, height: size.buttonLg, borderRadius: radius.sm, backgroundColor: c.bgSubtle, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={size.iconLg} color={c.textStrong} />
            </Pressable>
          </View>
          <Question>Sababi</Question>
          <Chips>{reasons.map((r) => <Chip key={r} label={r} on={reason === r} onPress={() => setReason(r)} />)}</Chips>
        </View>
      )}
    </Sheet>
  );
}
