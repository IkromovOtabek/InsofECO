import React, { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChipGroup, ListGroup, SectionHead } from '@/design/blocks';
import { Button, Callout, EmptyState, Input, ListItem, Screen, SearchField, fmtNum } from '@/design/primitives';
import { Confirm, toast } from '@/design/ui';
import { space } from '@/design/tokens';
import { ApiException } from '@/core/api';
import { EcoRole, adminApi, useAdminOrgs } from '@/features/admin/api';
import { useDebounced } from '@/features/admin/ui';

type Target = 'all' | EcoRole;

/**
 * Ommaviy push-xabar: matn → qabul qiluvchi (barcha / rol / tashkilot). Avval "dry run" bilan necha kishiga
 * borishi hisoblanadi va tasdiq oynasida ko'rsatiladi; faqat tasdiqdan keyin yuboriladi. Server 3/daq bilan cheklaydi.
 */
export default function AdminBroadcast() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<Target>('all');
  const [search, setSearch] = useState('');
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);
  const [preview, setPreview] = useState<{ recipients: number; devices: number } | null>(null);
  const [busy, setBusy] = useState(false);
  // "Yuborish" ikki marta tez bosilsa (tugma `loading` bo'lib ulgurmasdan) — har biri yangi idempotency kalit bilan
  // ketib, xabar ikki marta borardi. Ref — render kutmaydi.
  const inFlight = useRef(false);
  const q = useDebounced(search.trim());
  const orgs = useAdminOrgs({ q: q || undefined });
  const ok = title.trim().length >= 2 && body.trim().length >= 2;
  const payload = { title: title.trim(), body: body.trim(), role: target === 'all' ? undefined : target, organizationId: org?.id };

  const fail = (e: unknown) => toast.error(e instanceof ApiException ? e.message : 'Tarmoq xatosi', 'Bajarilmadi');
  const check = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try { setPreview(await adminApi.broadcast({ ...payload, dryRun: true })); } catch (e) { fail(e); } finally { inFlight.current = false; setBusy(false); }
  };
  const send = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const r = await adminApi.broadcast(payload);
      setPreview(null);
      toast.success(`${fmtNum(r.recipients)} foydalanuvchiga yuborildi`, 'Yuborildi');
      router.back();
    } catch (e) { fail(e); } finally { inFlight.current = false; setBusy(false); }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.x12 * 2, gap: space.section }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.md }}>
          <Input label="Sarlavha" required value={title} onChangeText={setTitle} maxLength={80} placeholder="Texnik ishlar" />
          <Input label="Matn" required value={body} onChangeText={setBody} maxLength={400} multiline placeholder="Bugun 23:00 dan 23:30 gacha ilova ishlamaydi" />
        </View>

        <View style={{ gap: space.md }}>
          <SectionHead title="Kimga" icon="users" />
          <ChipGroup<Target> items={[{ key: 'all', label: 'Barchasi' }, { key: 'TADBIRKOR', label: 'Tadbirkor' }, { key: 'QURUVCHI', label: 'Mijoz' }, { key: 'HAYDOVCHI', label: 'Haydovchi' }]} value={target} onChange={setTarget} />
          {org ? (
            <ListGroup>
              <ListItem icon="building" title={org.name} subtitle="Faqat shu tashkilot a'zolari" right={<Button title="Olib tashlash" variant="ghost" full={false} onPress={() => setOrg(null)} />} chevron={false} />
            </ListGroup>
          ) : (
            <>
              <SearchField value={search} onChangeText={setSearch} placeholder="Tashkilot bilan cheklash (ixtiyoriy)…" autoCapitalize="none" />
              {q ? (
                <ListGroup>
                  {(orgs.data?.rows ?? []).slice(0, 8).map((o) => (
                    <ListItem key={o.id} icon={o.type === 'PLANT' ? 'factory' : 'building'} title={o.name} subtitle={`${o.members} a'zo`} chevron={false} onPress={() => { setOrg({ id: o.id, name: o.name }); setSearch(''); }} />
                  ))}
                  {orgs.data && orgs.data.rows.length === 0 ? <EmptyState compact icon="search" title="Topilmadi" /> : null}
                </ListGroup>
              ) : null}
            </>
          )}
        </View>

        <Callout tone="warning" icon="triangle-alert">Xabar darhol telefonlarga boradi va qaytarib olinmaydi. Superadminlar va bloklanganlar qabul qilmaydi.</Callout>
        <Button title="Tekshirish va yuborish" icon="send" size="lg" disabled={!ok} loading={busy && !preview} onPress={() => void check()} />
      </ScrollView>

      <Confirm
        open={!!preview} onClose={() => setPreview(null)} loading={busy} danger
        title={preview ? `${fmtNum(preview.recipients)} foydalanuvchiga yuborilsinmi?` : ''}
        message={preview ? `${fmtNum(preview.devices)} ta qurilmaga push · «${title.trim()}»` : undefined}
        confirmLabel="Yuborish"
        onConfirm={() => void send()}
      />
    </Screen>
  );
}
