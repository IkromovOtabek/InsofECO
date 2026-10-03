import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListGroup, SectionHead, Toggle } from '@/design/blocks';
import { Badge, Button, Callout, EmptyState, Input, ListItem, Screen, Txt } from '@/design/primitives';
import { Avatar, Confirm, Sheet, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { ECO_ROLE_NAME, size, space } from '@/design/tokens';
import { Membership, useSession } from '@/core/session';
import { AppConfigRow, useAdminAction, useAdminConfig } from '@/features/admin/api';

const ROLE_GROUP = { TADBIRKOR: '(tadbirkor)', QURUVCHI: '(quruvchi)', HAYDOVCHI: '(haydovchi)' } as const;
const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

/**
 * Sozlamalar: tezkor almashtirish (o'z rollariga o'tish), ilova sozlamalari / feature flag'lar (kalit → JSON),
 * ommaviy xabar va amallar jurnali, chiqish.
 */
export default function AdminSettings() {
  const router = useRouter();
  const { c } = useTheme();
  const { user, selectMembership, exitAdmin, signOut } = useSession();
  const cfg = useAdminConfig();
  const [edit, setEdit] = useState<Partial<AppConfigRow> | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [out, setOut] = useState(false);
  const save = useAdminAction<{ key: string; value: unknown; isPublic: boolean; description?: string }>((v) => ({ path: `/admin/config/${encodeURIComponent(v.key)}`, method: 'PUT', body: { value: v.value, isPublic: v.isPublic, description: v.description } }));
  const remove = useAdminAction<string>((key) => ({ path: `/admin/config/${encodeURIComponent(key)}`, method: 'DELETE' }));
  const roles = (user?.memberships ?? []).filter((m) => m.isActive);

  const toRole = (m: Membership) => { selectMembership(m); router.replace(`/${ROLE_GROUP[m.role]}` as never); };
  const flip = (r: AppConfigRow) => save.mutate({ key: r.key, value: !r.value, isPublic: r.isPublic, description: r.description ?? undefined }, {
    onSuccess: () => toast.success(`${r.key}: ${!r.value ? 'yoqildi' : "o'chirildi"}`),
    onError: (e) => toast.error(e.message, 'Saqlanmadi'),
  });

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.x12 * 2, gap: space.section }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={cfg.isRefetching} onRefresh={() => void cfg.refetch()} tintColor={c.textMuted} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Avatar name={user?.fullName ?? user?.phone} size={size.avatarLg} tone="brand" />
          <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
            <Txt v="titleMd" numberOfLines={1}>{user?.fullName ?? 'Superadmin'}</Txt>
            <Txt v="bodySm" color="muted">{user?.phone}</Txt>
            <Badge label="Superadmin" tone="brand" icon="shield-check" style={{ alignSelf: 'flex-start' }} />
          </View>
        </View>

        <View style={{ gap: space.md }}>
          <SectionHead title="Tezkor almashtirish" icon="arrow-left-right" />
          <ListGroup>
            {roles.map((m) => (
              <ListItem key={`${m.organization.id}:${m.role}`} icon="log-in" title={ECO_ROLE_NAME[m.role].name} subtitle={m.organization.name} chevron onPress={() => toRole(m)} />
            ))}
            <ListItem icon="layout-grid" title="Rol tanlash ekrani" subtitle={roles.length ? undefined : "Sizda tashkilot roli yo'q"} chevron onPress={exitAdmin} />
          </ListGroup>
        </View>

        <View style={{ gap: space.md }}>
          <SectionHead title="Boshqaruv" icon="shield-check" />
          <ListGroup>
            <ListItem icon="send" title="Ommaviy xabar" subtitle="Rol yoki tashkilotga push" chevron onPress={() => router.push('/(superadmin)/xabar' as never)} />
            <ListItem icon="history" title="Amallar jurnali" subtitle="Superadmin qilgan har bir amal" chevron onPress={() => router.push('/(superadmin)/jurnal' as never)} />
            <ListItem icon="sun-moon" title="Ilova sozlamalari" subtitle="Mavzu, til, PIN" chevron onPress={() => router.push('/settings' as never)} />
          </ListGroup>
        </View>

        <View style={{ gap: space.md }}>
          <SectionHead title="Feature flag'lar" icon="flag" action="Qo'shish" onAction={() => setEdit({ key: '', value: true, isPublic: true })} />
          {cfg.isError && !cfg.data ? <EmptyState compact icon="cloud-off" title="Yuklanmadi" onRetry={() => void cfg.refetch()} />
            : (cfg.data ?? []).length === 0 ? <ListGroup><EmptyState compact icon="flag" title="Sozlama yo'q" hint="Masalan: feature.chat = true (ilovaga ochiq)" /></ListGroup>
            : (
              <ListGroup>
                {(cfg.data ?? []).map((r) => (
                  <ListItem
                    key={r.key}
                    title={r.key}
                    subtitle={`${r.description ? `${r.description} · ` : ''}${r.isPublic ? 'ilovaga ochiq' : 'faqat server'}${typeof r.value === 'boolean' ? '' : ` · ${show(r.value).slice(0, 60)}`}`}
                    chevron={typeof r.value !== 'boolean'}
                    right={typeof r.value === 'boolean' ? <Toggle value={r.value} disabled={save.isPending} onChange={() => flip(r)} /> : undefined}
                    onPress={() => setEdit(r)}
                  />
                ))}
              </ListGroup>
            )}
        </View>

        <Button title="Chiqish" icon="log-out" variant="ghost" size="lg" onPress={() => setOut(true)} />
      </ScrollView>

      <ConfigSheet
        row={edit} onClose={() => setEdit(null)} loading={save.isPending}
        onDelete={edit?.updatedAt ? () => { setDel(edit.key ?? null); setEdit(null); } : undefined}
        onSave={(v) => save.mutate(v, { onSuccess: () => { setEdit(null); toast.success('Saqlandi'); }, onError: (e) => toast.error(e.message, 'Saqlanmadi') })}
      />
      <Confirm
        open={!!del} onClose={() => setDel(null)} danger loading={remove.isPending}
        title="Sozlama o'chirilsinmi?" message={del ?? undefined} confirmLabel="O'chirish"
        onConfirm={() => del && remove.mutate(del, { onSuccess: () => { setDel(null); toast.success("O'chirildi"); }, onError: (e) => toast.error(e.message, 'Bajarilmadi') })}
      />
      <Confirm open={out} onClose={() => setOut(false)} title="Chiqasizmi?" confirmLabel="Chiqish" onConfirm={() => { setOut(false); void signOut(); }} />
    </Screen>
  );
}

/** Kalit/qiymat tahriri: qiymat JSON sifatida o'qiladi (true, 42, "matn", {"a":1}); JSON bo'lmasa — oddiy matn. */
function ConfigSheet({ row, onClose, onSave, onDelete, loading }: {
  row: Partial<AppConfigRow> | null; onClose: () => void; loading?: boolean; onDelete?: () => void;
  onSave: (v: { key: string; value: unknown; isPublic: boolean; description?: string }) => void;
}) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [desc, setDesc] = useState('');
  const [pub, setPub] = useState(true);
  const [seed, setSeed] = useState<unknown>(null);
  // Har safar yangi qator ochilganda maydonlar to'ldiriladi
  if (row && seed !== row) {
    setSeed(row);
    setKey(row.key ?? '');
    setValue(row.value === undefined ? '' : show(row.value));
    setDesc(row.description ?? '');
    setPub(row.isPublic ?? true);
  }
  const existing = !!row?.updatedAt;
  const keyOk = /^[a-z][a-z0-9_.-]{1,63}$/.test(key);
  const parse = (s: string): unknown => { try { return JSON.parse(s); } catch { return s; } };
  return (
    <Sheet
      open={!!row} onClose={() => { setSeed(null); onClose(); }} title={existing ? key : 'Yangi sozlama'}
      footer={(
        <View style={{ gap: space.sm }}>
          <Button title="Saqlash" icon="check" size="lg" loading={loading} disabled={!keyOk} onPress={() => onSave({ key, value: parse(value.trim()), isPublic: pub, description: desc.trim() || undefined })} />
          {onDelete ? <Button title="O'chirish" icon="trash" variant="ghost" onPress={onDelete} /> : null}
        </View>
      )}
    >
      <View style={{ gap: space.md }}>
        <Input label="Kalit" required value={key} onChangeText={(t) => setKey(t.toLowerCase())} editable={!existing} autoCapitalize="none" placeholder="feature.chat" error={key && !keyOk ? 'Kichik harf, raqam, . _ -' : undefined} mono />
        <Input label="Qiymat (JSON)" value={value} onChangeText={setValue} autoCapitalize="none" placeholder='true, 42, "matn"' mono multiline />
        <Input label="Izoh" value={desc} onChangeText={setDesc} placeholder="Nima uchun" maxLength={200} />
        <Toggle value={pub} onChange={setPub} label="Ilovaga ochiq" hint="/app-config orqali barcha foydalanuvchilarga beriladi — maxfiy qiymat qo'ymang" />
        <Callout tone="info" icon="info">O&apos;zgarish jurnalga yoziladi.</Callout>
      </View>
    </Sheet>
  );
}
