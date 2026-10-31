import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Callout, Card, EmptyState, IconButton, Input, KVList, ListGroup, ListItem, Txt, fmtNum } from '@/design/primitives';
import { PageHeader, SkeletonList } from '@/design/blocks';
import { Sheet, result, toast } from '@/design/ui';
import { Icon } from '@/design/icons';
import { useTheme } from '@/design/theme';
import { radius, shadow, space } from '@/design/tokens';
import { haptic } from '@/design/motion';
import { ApiException } from '@/core/api';
import { erpAuth, type ErpShipmentItem } from '@/core/erp';
import { usePollInterval } from '@/shared/hooks';

/**
 * Snabjeniye jo'natmalari (ERP `lib/shipments.ts`): snabjenets olib kelgan molni nakladnoy qilib skladga jo'natadi.
 * Sklad xodimiga ekranning tepasidan banner tushadi — «Sizga yangi mahsulotlar keldi, qabul qiling»; bosilganda
 * jo'natma qatorlari ochiladi: hammasini yoki belgilanganlarini (fakt miqdor bilan) qabul qiladi yoki sabab bilan rad etadi.
 */

const KEY = ['erp', 'shipments'] as const;
const errText = (e: unknown) => (e instanceof ApiException ? e.message : 'Tarmoq xatosi — qayta urinib ko\'ring');

export const useErpShipments = (enabled = true) =>
  useQuery({ queryKey: KEY, queryFn: () => erpAuth.shipments(), enabled, refetchInterval: usePollInterval(30_000), retry: false });

const useErpShipment = (id: string) =>
  useQuery({ queryKey: [...KEY, id], queryFn: () => erpAuth.shipment(id), enabled: !!id });

// ───────────────────────── Tepadagi banner ─────────────────────────

/**
 * Sklad bo'limi ustida suzib turadigan banner. Yangi jo'natma kelganda (ro'yxat o'zgarsa) qayta tushadi va telefon titraydi;
 * yopilsa — keyingi yangi jo'natmagacha ko'rinmaydi. Eski ERP serverida endpoint yo'q (404) — jim turadi.
 */
export function ShipmentBanner() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data } = useErpShipments();
  const [closed, setClosed] = useState<string | null>(null);
  const seen = useRef<string | null>(null);
  const open = data?.canAccept ? data.rows.filter((r) => r.pendingLines > 0) : [];
  const sig = open.map((r) => r.id).join(',');

  useEffect(() => {
    if (!sig || seen.current === sig) return;
    if (seen.current !== null) haptic.warning();
    seen.current = sig;
  }, [sig]);

  if (!open.length || closed === sig) return null;
  const one = open.length === 1 ? open[0] : null;
  const go = () => router.push((one ? `/erp/jonatma/${one.id}` : '/erp/jonatma') as never);

  return (
    <Animated.View key={sig} entering={SlideInUp.springify().damping(16)} exiting={FadeOutUp} pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + space.sm, left: space.md, right: space.md, zIndex: 50 }}>
      <Pressable onPress={go} accessibilityRole="button" accessibilityLabel="Yangi mahsulotlar keldi — qabul qilish"
        style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.warningBg, borderColor: c.warningSolid, borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous', padding: space.md }, shadow.pop]}>
        <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: c.warningSolid, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell-ring" color={c.textOnSolid} />
          <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: radius.pill, backgroundColor: c.dangerSolid, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
            <Txt v="label" style={{ color: c.textOnSolid }}>{String(data?.pending ?? open.length)}</Txt>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong" numberOfLines={1}>Sizga yangi mahsulotlar keldi</Txt>
          <Txt v="bodySm" numberOfLines={2} style={{ color: c.warning }}>
            {one ? `${one.docNo} · ${one.by} · ${one.pendingLines} qator — qabul qiling` : `${open.length} ta jo'natma qabul kutmoqda — qabul qiling`}
          </Txt>
        </View>
        <IconButton icon="x" label="Yopish" tone="muted" onPress={() => setClosed(sig)} />
      </Pressable>
    </Animated.View>
  );
}

// ───────────────────────── Ro'yxat ─────────────────────────

export function ShipmentListScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching, error } = useErpShipments();
  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="Jo'natmalar" onBack={onBack} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView contentContainerStyle={{ padding: space.pageX, paddingBottom: insets.bottom + space.x10, gap: space.md }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
        {isLoading ? <SkeletonList /> : error ? <EmptyState title="Yuklanmadi" hint={errText(error)} onRetry={refetch} /> : !data?.rows.length ? (
          data?.canAccept
            ? <EmptyState icon="package-check" title="Qabul kutayotgan jo'natma yo'q" hint="Snabjeniye jo'natganda shu yerda va ekran tepasida chiqadi" />
            : <EmptyState icon="package-check" title="Jo'natmalar yo'q" hint="Skladga jo'natma kompyuterdagi ERP'da tuziladi — natijasi shu yerda ko'rinadi" />
        ) : (
          <ListGroup>
            {data.rows.map((r, i) => (
              <ListItem key={r.id} icon="package" module="warehouse" title={`${r.docNo} · ${r.supplier}`}
                subtitle={`${r.date} · ${r.by} · ${r.lines} qator · ${r.total}`}
                badge={{ text: r.pendingLines ? `${r.pendingLines} kutmoqda` : r.statusLabel, tone: r.pendingLines ? 'warning' : 'success' }}
                onPress={() => router.push(`/erp/jonatma/${r.id}` as never)} chevron last={i === data.rows.length - 1} />
            ))}
          </ListGroup>
        )}
      </ScrollView>
    </View>
  );
}

// ───────────────────────── Qabul ekrani ─────────────────────────

const ST: Record<ErpShipmentItem['status'], { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  PENDING: { label: 'Kutmoqda', tone: 'warning' }, ACCEPTED: { label: 'Qabul qilindi', tone: 'success' }, REJECTED: { label: 'Rad etildi', tone: 'danger' },
};
const parse = (v: string) => Number(v.replace(/\s+/g, '').replace(',', '.'));
/** Miqdor: 3 xonagacha kasr, ortiqcha nollarsiz — "10.000 dona" o'n mingdek o'qilmasin (10, 9.5). */
const qtyText = (n: number) => fmtNum(n, 3).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

export function ShipmentAcceptScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching, error } = useErpShipment(id);
  const pending = useMemo(() => data?.items.filter((i) => i.status === 'PENDING') ?? [], [data]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  // Ochilganda kutayotgan hamma qator belgilangan, miqdor — jo'natilgani (odatda hammasi to'g'ri keladi)
  const pendingSig = pending.map((i) => i.id).join(',');
  useEffect(() => {
    setSel(new Set(pending.map((i) => i.id)));
    setQty(Object.fromEntries(pending.map((i) => [i.id, String(i.qty)])));
  }, [pendingSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = (msg: string) => {
    void qc.invalidateQueries({ queryKey: KEY });
    void qc.invalidateQueries({ queryKey: ['erp', 'notifications'] });
    void refetch();
    haptic.success();
    result.success('Bajarildi', msg);
  };
  const accept = useMutation({
    mutationFn: () => erpAuth.acceptShipment(id, chosen.map((i) => ({ itemId: i.id, qty: parse(qty[i.id] ?? '') }))),
    onSuccess: (r) => done(r.message),
    onError: (e) => { haptic.error(); toast.error(errText(e), 'Qabul qilinmadi'); },
  });
  const reject = useMutation({
    mutationFn: () => erpAuth.rejectShipment(id, chosen.map((i) => i.id), reason.trim()),
    onSuccess: (r) => { setRejectOpen(false); setReason(''); done(r.message); },
    onError: (e) => { haptic.error(); toast.error(errText(e), 'Rad etilmadi'); },
  });

  const chosen = pending.filter((i) => sel.has(i.id));
  const allOn = pending.length > 0 && chosen.length === pending.length;
  const bad = chosen.some((i) => !(parse(qty[i.id] ?? '') > 0));
  const toggle = (itemId: string) => { haptic.selection(); setSel((s) => { const n = new Set(s); if (n.has(itemId)) n.delete(itemId); else n.add(itemId); return n; }); };
  const busy = accept.isPending || reject.isPending;
  const live = !!data?.canAccept && pending.length > 0;

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title={data?.docNo ?? "Jo'natma"} onBack={onBack} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView contentContainerStyle={{ padding: space.pageX, paddingBottom: insets.bottom + (live ? 180 : space.x10), gap: space.md }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />} keyboardShouldPersistTaps="handled">
        {isLoading ? <SkeletonList /> : error || !data ? <EmptyState title="Yuklanmadi" hint={errText(error)} onRetry={refetch} /> : (
          <>
            {live && (
              <Callout tone="warning" icon="bell-ring">
                Mahsulotlarni sanab tekshiring. Kelganlarini belgilang va fakt miqdorni yozing — qabul qilinganlari shu zahoti skladga kirim bo&apos;ladi.
              </Callout>
            )}
            <Card>
              <KVList flat rows={[
                { label: 'Holat', value: data.statusLabel },
                { label: 'Yetkazuvchi', value: data.supplier },
                { label: 'Snabjenets', value: data.by },
                { label: 'Sana', value: data.date },
                ...(data.waybillNo ? [{ label: 'Nakladnoy №', value: data.waybillNo }] : []),
                ...(data.carrier ? [{ label: 'Kim olib keldi', value: data.carrier }] : []),
                { label: 'Summa', value: data.total },
              ]} />
              {data.note ? <Txt v="bodySm" style={{ marginTop: space.sm, color: c.textMuted }}>{data.note}</Txt> : null}
            </Card>

            {live && (
              <Pressable onPress={() => { haptic.selection(); setSel(allOn ? new Set() : new Set(pending.map((i) => i.id))); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs }}>
                <Icon name={allOn ? 'square-check' : 'square'} color={allOn ? c.brand : c.textMuted} />
                <Txt v="bodyStrong">{allOn ? 'Hammasi belgilangan' : 'Hammasini belgilash'} ({chosen.length}/{pending.length})</Txt>
              </Pressable>
            )}

            {data.items.map((i) => {
              const on = sel.has(i.id);
              const isPending = i.status === 'PENDING';
              const f = parse(qty[i.id] ?? '');
              return (
                <Pressable key={i.id} disabled={!live || !isPending} onPress={() => toggle(i.id)}
                  style={{ backgroundColor: c.bgSurface, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: live && isPending && on ? c.successSolid : c.borderSubtle, padding: space.md, gap: space.sm, opacity: isPending || !live ? 1 : 0.75 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                    {live && isPending ? <Icon name={on ? 'square-check' : 'square'} color={on ? c.successSolid : c.textMuted} /> : null}
                    <View style={{ flex: 1 }}>
                      <Txt v="bodyStrong">{i.name}</Txt>
                      <Txt v="bodySm" style={{ color: c.textMuted }}>{i.category}{i.isNew ? ' · yangi mahsulot' : ''} · {fmtNum(i.price)} so&apos;m / {i.unit}</Txt>
                    </View>
                    <Badge label={ST[i.status].label} tone={ST[i.status].tone} />
                  </View>
                  {live && isPending ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <Txt v="bodySm" style={{ flex: 1, color: c.textMuted }}>Jo&apos;natildi: {qtyText(i.qty)} {i.unit}</Txt>
                      <Txt v="bodySm">Keldi:</Txt>
                      <TextInput value={qty[i.id] ?? ''} editable={on} keyboardType="decimal-pad" selectTextOnFocus
                        onChangeText={(t) => setQty((q) => ({ ...q, [i.id]: t }))}
                        style={{ width: 96, height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: on && f < i.qty ? c.warningSolid : c.borderDefault, paddingHorizontal: space.sm, textAlign: 'right', color: c.textStrong, backgroundColor: on ? c.bgApp : c.bgMuted }} />
                      <Txt v="bodySm" numberOfLines={1} style={{ minWidth: 28 }}>{i.unit}</Txt>
                    </View>
                  ) : (
                    <Txt v="bodySm" style={{ color: c.textMuted }}>
                      {qtyText(i.qty)} {i.unit}
                      {i.acceptedQty != null ? ` → qabul ${qtyText(i.acceptedQty)} ${i.unit}` : ''}
                      {i.receiptNo ? ` · ${i.receiptNo}` : ''}{i.rejectReason ? ` · ${i.rejectReason}` : ''}{i.decidedBy ? ` · ${i.decidedBy}` : ''}
                    </Txt>
                  )}
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      {live && (
        <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.bgSurface, borderTopWidth: 1, borderColor: c.borderSubtle, padding: space.md, paddingBottom: insets.bottom + space.md, gap: space.sm }, shadow.pop]}>
          <Txt v="bodySm" style={{ color: c.textMuted }}>Belgilanmaganlar kutishda qoladi — keyin qabul qilasiz yoki rad etasiz.</Txt>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Rad etish" variant="secondary" icon="ban" textColor={c.danger} full={false} disabled={busy || !chosen.length} onPress={() => setRejectOpen(true)} />
            <View style={{ flex: 1 }}>
              <Button title={allOn ? 'Hammasini qabul qilish' : `${chosen.length} qatorni qabul qilish`} variant="success" icon="package-check"
                loading={accept.isPending} disabled={busy || !chosen.length || bad} onPress={() => accept.mutate()} />
            </View>
          </View>
        </View>
      )}

      <Sheet open={rejectOpen} onClose={() => setRejectOpen(false)} title={`${chosen.length} qatorni rad etish`}
        footer={<Button title="Rad etish" variant="danger" icon="ban" loading={reject.isPending} disabled={reason.trim().length < 3} onPress={() => reject.mutate()} />}>
        <Input label="Sabab" value={reason} onChangeText={setReason} placeholder="Masalan: sifatsiz, kelmadi, singan" autoFocus required />
      </Sheet>
    </View>
  );
}
