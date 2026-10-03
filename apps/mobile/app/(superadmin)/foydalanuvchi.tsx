import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChipGroup, ListGroup, SectionHead, SkeletonList, Toggle } from '@/design/blocks';
import { Badge, Button, Callout, EmptyState, KVList, ListItem, Screen, SearchField, Txt, fmtDateFull } from '@/design/primitives';
import { Avatar, Confirm, Sheet, fmtRel, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { EcoRole, ROLE_LABEL, useAdminAction, useAdminOrgs, useAdminUser } from '@/features/admin/api';
import { ReasonConfirm, useDebounced } from '@/features/admin/ui';

type Ask =
  | { kind: 'block' }
  | { kind: 'unblock' }
  | { kind: 'revoke' }
  | { kind: 'membership'; id: string; isActive: boolean; label: string };

interface Act { path: string; method?: 'POST' | 'PATCH'; body?: unknown; done: string }

/**
 * Foydalanuvchi kartochkasi: profil, a'zoliklar, qurilmalar; amallar — bloklash, barcha seanslarni yopish,
 * a'zolikni yoqish/o'chirish va yangi rol biriktirish. Har bir amal tasdiq oynasidan keyin va jurnalga yoziladi.
 * O'zingizga va boshqa superadminga bu amallar yopiq (server ham rad etadi).
 */
export default function AdminUser() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const me = useSession((s) => s.user?.id);
  const q = useAdminUser(id);
  const u = q.data;
  const [ask, setAsk] = useState<Ask | null>(null);
  const [adding, setAdding] = useState(false);
  const act = useAdminAction<Act>((v) => ({ path: v.path, method: v.method, body: v.body }));
  const run = (v: Act) => act.mutate(v, {
    onSuccess: () => { setAsk(null); setAdding(false); toast.success(v.done); },
    onError: (e) => toast.error(e.message, 'Bajarilmadi'),
  });
  const locked = !u || u.id === me || u.isSuperAdmin;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.x12 * 2, gap: space.section }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
      >
        {q.isLoading ? <SkeletonList rows={6} />
          : !u ? <EmptyState icon="cloud-off" title="Foydalanuvchi yuklanmadi" hint={q.error instanceof Error ? q.error.message : undefined} onRetry={() => void q.refetch()} />
          : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
                <Avatar name={u.fullName ?? u.phone} size={size.avatarLg} tone={u.blockedAt ? 'danger' : u.isSuperAdmin ? 'brand' : 'neutral'} />
                <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
                  <Txt v="titleLg" numberOfLines={2}>{u.fullName ?? 'Ismsiz'}</Txt>
                  <Txt v="bodySm" color="muted" selectable>{u.phone}</Txt>
                  <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                    {u.isSuperAdmin ? <Badge label="Superadmin" tone="brand" icon="shield-check" /> : null}
                    {u.blockedAt ? <Badge label="Bloklangan" tone="danger" icon="ban" /> : <Badge label="Faol" tone="success" icon="circle-check" />}
                    {u.deleteRequestedAt ? <Badge label="O'chirish so'ralgan" tone="warning" /> : null}
                  </View>
                </View>
              </View>

              {u.blockedAt ? <Callout tone="danger" icon="ban">{`${fmtDateFull(u.blockedAt)} da bloklangan: ${u.blockedReason ?? '—'}`}</Callout> : null}
              {u.isSuperAdmin && u.id !== me ? <Callout tone="info" icon="shield-check">Superadmin huquqi faqat serverdagi skript bilan olinadi — ilovadan bloklab bo&apos;lmaydi.</Callout> : null}

              <KVList rows={[
                { label: 'Faol seanslar', value: String(u.activeSessions) },
                { label: 'Parol', value: u.hasPassword ? "o'rnatilgan" : "yo'q (SMS/Telegram)" },
                { label: 'Til', value: u.locale },
                { label: "Ro'yxatdan o'tgan", value: fmtDateFull(u.createdAt) },
                { label: 'Seanslar yopilgan', value: u.tokensValidAfter ? fmtDateFull(u.tokensValidAfter) : '—' },
                { label: 'Id', value: u.id },
              ]} />

              <View style={{ gap: space.md }}>
                <SectionHead title="A'zoliklar" icon="building" count={u.memberships.length || undefined} action={locked ? undefined : "Rol qo'shish"} onAction={locked ? undefined : () => setAdding(true)} />
                {u.memberships.length === 0 ? <ListGroup><EmptyState compact icon="building" title="A'zolik yo'q" /></ListGroup> : (
                  <ListGroup>
                    {u.memberships.map((m) => (
                      <ListItem
                        key={m.id}
                        icon={m.organization.type === 'PLANT' ? 'factory' : 'building'} module={m.organization.type === 'PLANT' ? 'production' : 'brand'}
                        title={m.organization.name}
                        subtitle={`${ROLE_LABEL[m.role]}${m.organization.blockedAt ? ' · tashkilot bloklangan' : ''}`}
                        chevron={false}
                        right={(
                          <Toggle
                            value={m.isActive} disabled={locked || act.isPending}
                            onChange={(v) => setAsk({ kind: 'membership', id: m.id, isActive: v, label: `${ROLE_LABEL[m.role]} · ${m.organization.name}` })}
                          />
                        )}
                        onPress={() => router.push({ pathname: '/(superadmin)/tashkilot', params: { id: m.organization.id } } as never)}
                      />
                    ))}
                  </ListGroup>
                )}
              </View>

              <View style={{ gap: space.md }}>
                <SectionHead title="Qurilmalar" icon="smartphone" count={u.devices.length || undefined} />
                {u.devices.length === 0 ? <ListGroup><EmptyState compact icon="smartphone" title="Qurilma yo'q" /></ListGroup> : (
                  <ListGroup>
                    {u.devices.map((d) => (
                      <ListItem key={d.id} icon="smartphone" chevron={false} title={`${d.model ?? d.platform} · v${d.appVersion ?? '?'}`} subtitle={`${d.platform}${d.push ? ' · push yoqiq' : ''}`} value={fmtRel(d.lastSeenAt)} />
                    ))}
                  </ListGroup>
                )}
              </View>

              {locked ? null : (
                <View style={{ gap: space.sm }}>
                  <Button title="Barcha seanslarni yopish" icon="log-out" variant="secondary" size="lg" onPress={() => setAsk({ kind: 'revoke' })} />
                  {u.blockedAt
                    ? <Button title="Blokdan chiqarish" icon="lock-open" variant="secondary" size="lg" onPress={() => setAsk({ kind: 'unblock' })} />
                    : <Button title="Foydalanuvchini bloklash" icon="ban" variant="danger" size="lg" onPress={() => setAsk({ kind: 'block' })} />}
                </View>
              )}
            </>
          )}
      </ScrollView>

      <ReasonConfirm
        open={ask?.kind === 'block'} onClose={() => setAsk(null)} loading={act.isPending}
        title="Foydalanuvchini bloklash?" confirmLabel="Bloklash"
        message="Barcha qurilmalardan darhol chiqariladi va qayta kira olmaydi. Amal jurnalga yoziladi."
        onConfirm={(reason) => run({ path: `/admin/users/${id}/block`, body: { reason }, done: 'Foydalanuvchi bloklandi' })}
      />
      <Confirm
        open={ask?.kind === 'unblock'} onClose={() => setAsk(null)} loading={act.isPending}
        title="Blokdan chiqarilsinmi?" message="Foydalanuvchi yana kira oladi." confirmLabel="Chiqarish"
        onConfirm={() => run({ path: `/admin/users/${id}/unblock`, done: 'Blokdan chiqarildi' })}
      />
      <Confirm
        open={ask?.kind === 'revoke'} onClose={() => setAsk(null)} loading={act.isPending} danger
        title="Barcha seanslar yopilsinmi?" message="Foydalanuvchi barcha qurilmalarda qaytadan kirishi kerak bo'ladi." confirmLabel="Yopish"
        onConfirm={() => run({ path: `/admin/users/${id}/sessions/revoke`, done: 'Seanslar yopildi' })}
      />
      <Confirm
        open={ask?.kind === 'membership'} onClose={() => setAsk(null)} loading={act.isPending} danger={ask?.kind === 'membership' && !ask.isActive}
        title={ask?.kind === 'membership' && ask.isActive ? "A'zolik yoqilsinmi?" : "A'zolik o'chirilsinmi?"}
        message={ask?.kind === 'membership' ? `${ask.label}. O'zgarish ERP'ga ham yuboriladi.` : undefined}
        confirmLabel={ask?.kind === 'membership' && ask.isActive ? 'Yoqish' : "O'chirish"}
        onConfirm={() => ask?.kind === 'membership' && run({ path: `/admin/users/${id}/memberships/${ask.id}`, method: 'PATCH', body: { isActive: ask.isActive }, done: "A'zolik yangilandi" })}
      />
      <AddMembership
        open={adding} onClose={() => setAdding(false)} loading={act.isPending}
        onSubmit={(v) => run({ path: `/admin/users/${id}/memberships`, body: { ...v, isActive: true }, done: "Rol biriktirildi" })}
      />
    </Screen>
  );
}

/** Rol biriktirish: tashkilotni qidirib tanlash + rol. Haydovchi faqat zavodga (server ham tekshiradi). */
function AddMembership({ open, onClose, onSubmit, loading }: { open: boolean; onClose: () => void; onSubmit: (v: { organizationId: string; role: EcoRole }) => void; loading?: boolean }) {
  const [search, setSearch] = useState('');
  const [org, setOrg] = useState<{ id: string; name: string; type: 'PLANT' | 'CONTRACTOR' } | null>(null);
  const [role, setRole] = useState<EcoRole>('QURUVCHI');
  const q = useDebounced(search.trim());
  const orgs = useAdminOrgs({ q: q || undefined });
  const close = () => { setSearch(''); setOrg(null); onClose(); };
  const bad = role === 'HAYDOVCHI' && org?.type !== 'PLANT';
  return (
    <Sheet
      open={open} onClose={close} title="Rol biriktirish"
      footer={<Button title="Biriktirish" icon="user-plus" size="lg" loading={loading} disabled={!org || bad} onPress={() => org && onSubmit({ organizationId: org.id, role })} />}
    >
      <View style={{ gap: space.md }}>
        <ChipGroup<EcoRole> items={[{ key: 'QURUVCHI', label: 'Mijoz' }, { key: 'TADBIRKOR', label: 'Tadbirkor' }, { key: 'HAYDOVCHI', label: 'Haydovchi' }]} value={role} onChange={setRole} />
        {bad ? <Callout tone="warning" icon="info">Haydovchi faqat zavodga biriktiriladi.</Callout> : null}
        <SearchField value={search} onChangeText={setSearch} placeholder="Tashkilot nomi yoki INN…" autoCapitalize="none" />
        <ListGroup>
          {(orgs.data?.rows ?? []).slice(0, 12).map((o) => (
            <ListItem
              key={o.id} icon={o.type === 'PLANT' ? 'factory' : 'building'} title={o.name} subtitle={o.type === 'PLANT' ? 'Zavod' : 'Mijoz'}
              chevron={false} badge={org?.id === o.id ? { text: 'Tanlandi', tone: 'success' } : undefined}
              onPress={() => setOrg({ id: o.id, name: o.name, type: o.type })}
            />
          ))}
          {orgs.data && orgs.data.rows.length === 0 ? <EmptyState compact icon="search" title="Topilmadi" /> : null}
        </ListGroup>
      </View>
    </Sheet>
  );
}
