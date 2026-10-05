import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KpiGrid, ListGroup, Reveal, SectionHead, SkeletonList } from '@/design/blocks';
import { Badge, Button, Callout, EmptyState, KVList, ListItem, Screen, Txt, fmtDateFull } from '@/design/primitives';
import { Avatar, Confirm, fmtRel, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { size, space } from '@/design/tokens';
import { ROLE_LABEL, useAdminAction, useAdminOrg } from '@/features/admin/api';
import { ReasonConfirm } from '@/features/admin/ui';

/** Tashkilot kartochkasi: ma'lumot, sanoqlar, a'zolar, ERP integratsiyasi; bloklash / blokdan chiqarish (tasdiq bilan). */
export default function AdminOrganization() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const q = useAdminOrg(id);
  const o = q.data;
  const [ask, setAsk] = useState<'block' | 'unblock' | null>(null);
  // Yashirin tab qayta ishlatiladi — boshqa tashkilotga o'tilganda ochiq tasdiq oynasi yopiladi
  useEffect(() => { setAsk(null); }, [id]);
  const act = useAdminAction<{ kind: 'block' | 'unblock'; reason?: string }>((v) => ({ path: `/admin/organizations/${id}/${v.kind}`, body: v.kind === 'block' ? { reason: v.reason } : {} }));
  const run = (v: { kind: 'block' | 'unblock'; reason?: string }) => act.mutate(v, {
    onSuccess: () => { setAsk(null); toast.success(v.kind === 'block' ? 'Tashkilot bloklandi' : 'Blokdan chiqarildi'); },
    onError: (e) => toast.error(e.message, 'Bajarilmadi'),
  });

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.x12 * 2 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
      >
        {q.isLoading ? <SkeletonList rows={6} />
          : !o ? <EmptyState icon="cloud-off" title="Tashkilot yuklanmadi" hint={q.error instanceof Error ? q.error.message : undefined} onRetry={() => void q.refetch()} />
          : (
            <Reveal gap={space.section}>
              <View style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                  <Badge label={o.type === 'PLANT' ? 'Zavod' : 'Mijoz tashkiloti'} tone={o.type === 'PLANT' ? 'info' : 'neutral'} icon={o.type === 'PLANT' ? 'factory' : 'building'} />
                  {o.blockedAt ? <Badge label="Bloklangan" tone="danger" icon="ban" /> : <Badge label="Faol" tone="success" icon="circle-check" />}
                  {o.deletedAt ? <Badge label="O'chirilgan" tone="warning" /> : null}
                </View>
                <Txt v="titleLg">{o.name}</Txt>
                {o.address ? <Txt v="bodySm" color="muted">{o.address}</Txt> : null}
              </View>

              {o.blockedAt ? <Callout tone="danger" icon="ban">{`${fmtDateFull(o.blockedAt)} da bloklangan: ${o.blockedReason ?? '—'}. A'zolar bu tashkilot nomidan hech qanday amal bajara olmaydi.`}</Callout> : null}

              <KpiGrid items={[
                { label: 'Bugun buyurtma', value: o.counts.ordersToday, icon: 'clipboard-list' },
                { label: o.type === 'PLANT' ? 'Jami (zavod)' : 'Jami buyurtma', value: o.type === 'PLANT' ? o.counts.ordersAsPlant : o.counts.ordersAsClient, icon: 'layers' },
                { label: 'Transport', value: o.counts.vehicles, icon: 'truck', module: 'logistics' },
                { label: 'Obyektlar', value: o.counts.sites, icon: 'map-pin' },
              ]} />

              <KVList rows={[
                { label: 'INN', value: o.inn ?? '—' },
                { label: 'ERP kartasi', value: o.externalRef ?? '—' },
                { label: 'Yaratilgan', value: fmtDateFull(o.createdAt) },
                { label: 'Id', value: o.id },
              ]} />

              <View style={{ gap: space.md }}>
                <SectionHead title="A'zolar" icon="users" count={o.members.length || undefined} />
                {o.members.length === 0 ? <ListGroup><EmptyState compact icon="users" title="A'zo yo'q" /></ListGroup> : (
                  <ListGroup>
                    {o.members.map((m) => (
                      <ListItem
                        key={m.id}
                        leading={<Avatar name={m.user.fullName ?? m.user.phone} size={size.iconTile} tone={m.user.blockedAt ? 'danger' : 'neutral'} />}
                        title={m.user.fullName ?? m.user.phone}
                        subtitle={`${ROLE_LABEL[m.role]} · ${m.user.phone}${m.user.isSuperAdmin ? ' · superadmin' : ''}`}
                        badge={!m.isActive ? { text: 'Faol emas', tone: 'warning' } : m.user.blockedAt ? { text: 'Bloklangan', tone: 'danger' } : undefined}
                        chevron
                        onPress={() => router.push({ pathname: '/(superadmin)/foydalanuvchi', params: { id: m.user.id } } as never)}
                      />
                    ))}
                  </ListGroup>
                )}
              </View>

              {o.integrations.length ? (
                <View style={{ gap: space.md }}>
                  <SectionHead title="Integratsiya (API kalit)" icon="key-round" />
                  <ListGroup>
                    {o.integrations.map((i) => (
                      <ListItem key={i.id} icon="key-round" chevron={false} title={`${i.name} · ${i.keyPrefix}…`} subtitle={`${i.webhookUrl ?? 'webhook yo\'q'}${i.lastUsedAt ? ` · ${fmtRel(i.lastUsedAt)} oldin` : ''}`} badge={{ text: i.isActive ? 'Faol' : "O'chiq", tone: i.isActive ? 'success' : 'neutral' }} />
                    ))}
                  </ListGroup>
                </View>
              ) : null}

              {o.blockedAt
                ? <Button title="Blokdan chiqarish" icon="lock-open" variant="secondary" size="lg" onPress={() => setAsk('unblock')} />
                : <Button title="Tashkilotni bloklash" icon="ban" variant="danger" size="lg" onPress={() => setAsk('block')} />}
            </Reveal>
          )}
      </ScrollView>

      <ReasonConfirm
        open={ask === 'block'} onClose={() => setAsk(null)} loading={act.isPending}
        title="Tashkilotni bloklash?" confirmLabel="Bloklash"
        message={`«${o?.name ?? ''}» a'zolari (va ERP kaliti) bu tashkilot nomidan so'rov yubora olmaydi. Amal jurnalga yoziladi.`}
        onConfirm={(reason) => run({ kind: 'block', reason })}
      />
      <Confirm
        open={ask === 'unblock'} onClose={() => setAsk(null)} loading={act.isPending}
        title="Blokdan chiqarilsinmi?" message="A'zolar yana odatdagidek ishlay oladi." confirmLabel="Chiqarish"
        onConfirm={() => run({ kind: 'unblock' })}
      />
    </Screen>
  );
}
