import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { HeroCard, KpiGrid, ListGroup, PageHeader, Reveal, SectionHead, SkeletonDashboard } from '@/design/blocks';
import { Badge, Callout, EmptyState, KVList, ListItem, Screen, Txt, fmtNum } from '@/design/primitives';
import { fmtRel } from '@/design/ui';
import { useHeaderRaise } from '@/design/motion';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { config } from '@/core/config';
import { HEALTH_LABEL, Health, fmtUptime, healthTone, useAdminHealth, useAdminOverview, useErpFromDevice } from '@/features/admin/api';
import { StatusCard } from '@/features/admin/ui';

/** Sparkline uchun oxirgi 20 o'lchov (~5 daqiqa, 15 s dan). */
const HISTORY = 20;
const push = (a: number[], v: number | null | undefined) => (v == null ? a : [...a, v].slice(-HISTORY));

/**
 * Holat — server holati paneli. 15 s da bir /admin/health so'raladi:
 * API (ketib-kelish vaqti, uptime, versiya), DB ping, ERP serveri (server va telefondan), Socket ulanishlar,
 * Redis/navbat, xotira/disk, oxirgi xatolar, ilova versiyalari va bugungi buyurtma/reyslar.
 */
export default function AdminStatus() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const raise = useHeaderRaise();
  const user = useSession((s) => s.user);
  const h = useAdminHealth();
  const erpDev = useErpFromDevice();
  const ov = useAdminOverview();
  const x = h.data;

  // Kechikish tarixi — har yangi javobda bitta nuqta
  const [hist, setHist] = useState<{ rtt: number[]; db: number[]; erp: number[]; redis: number[] }>({ rtt: [], db: [], erp: [], redis: [] });
  useEffect(() => {
    if (!x) return;
    setHist((p) => ({ rtt: push(p.rtt, x.rttMs), db: push(p.db, x.db.latencyMs), erp: push(p.erp, x.erp.latencyMs), redis: push(p.redis, x.redis.latencyMs) }));
  }, [x?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  // Server javob bermasa — API qizil (oxirgi ma'lum holat kulrang ko'rinadi)
  const apiDown = h.isError && !h.isFetching;
  const overall: Health = apiDown ? 'down' : x?.overall ?? 'unknown';
  const appVersion = Constants.expoConfig?.version ?? '—';

  return (
    <Screen padded={false} style={{ paddingTop: insets.top }}>
      <PageHeader
        overline="Superadmin"
        title="Tizim holati"
        raised={raise.raised}
        right={<Badge label={HEALTH_LABEL[overall]} tone={healthTone(overall)} icon={overall === 'ok' ? 'circle-check' : 'circle-alert'} />}
        actions={[{ icon: 'send', label: 'Ommaviy xabar', onPress: () => router.push('/(superadmin)/xabar' as never) }]}
      />
      <ScrollView
        onScroll={raise.onScroll} scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.x12 * 2, gap: space.section }}
        refreshControl={<RefreshControl refreshing={h.isRefetching} onRefresh={() => { void h.refetch(); void ov.refetch(); void erpDev.refetch(); }} tintColor={c.textMuted} />}
      >
        {h.isLoading ? <SkeletonDashboard chips={false} kpis={4} actions={0} rows={2} />
          : !x ? <EmptyState icon="cloud-off" title="Server javob bermadi" hint={`${config.apiUrl} — internet yoki server ishlamayapti`} onRetry={() => void h.refetch()} />
          : (
            <Reveal gap={space.section}>
              {apiDown ? <Callout tone="danger" icon="circle-alert">{`Oxirgi so'rov muvaffaqiyatsiz: ${h.error instanceof Error ? h.error.message : 'tarmoq xatosi'}. Pastdagi ma'lumot ${fmtRel(x.at)} oldingi.`}</Callout> : null}

              <HeroCard
                label="API javob vaqti"
                value={x.rttMs}
                unit="ms"
                spark={hist.rtt.length > 1 ? hist.rtt : undefined}
              >
                <Txt v="caption" style={{ color: c.textOnInverseMuted }} numberOfLines={2}>
                  {`Ishlamoqda ${fmtUptime(x.api.uptimeSec)} · API v${x.api.version}${x.api.commit ? ` · ${x.api.commit}` : ''} · ${x.api.env} · Node ${x.api.node} · ilova v${appVersion}`}
                </Txt>
              </HeroCard>

              <View style={{ gap: space.md }}>
                <SectionHead title="Komponentlar" icon="activity" unit="15 s" />
                <View style={{ flexDirection: 'row', gap: space.md }}>
                  <StatusCard icon="zap" title="API" status={apiDown ? 'down' : x.api.status} metric={x.rttMs} unit="ms" caption={`Ishlamoqda ${fmtUptime(x.api.uptimeSec)}`} spark={hist.rtt} />
                  <StatusCard icon="layers" title="Ma'lumotlar bazasi" status={x.db.status} metric={x.db.latencyMs} unit="ms" caption={x.db.detail ?? (x.db.migrations != null ? `${x.db.migrations} ta migratsiya` : 'PostgreSQL')} spark={hist.db} />
                </View>
                <View style={{ flexDirection: 'row', gap: space.md }}>
                  <StatusCard
                    icon="factory" title="ERP server" status={x.erp.status} metric={x.erp.latencyMs} unit="ms"
                    caption={x.erp.detail ?? `${x.erp.url ?? '—'}${x.erp.httpStatus ? ` · ${x.erp.httpStatus}` : ''}`}
                    spark={hist.erp}
                  />
                  <StatusCard icon="radio" title="Socket" status={x.sockets.status} metric={x.sockets.connections} unit="ulanish" caption={x.sockets.detail ?? x.sockets.namespace} />
                </View>
                <View style={{ flexDirection: 'row', gap: space.md }}>
                  <StatusCard icon="gauge" title="Redis" status={x.redis.status} metric={x.redis.latencyMs} unit="ms" caption={x.redis.detail ?? x.redis.state} spark={hist.redis} />
                  <StatusCard
                    icon="clipboard-list" title={`Navbat · ${x.queue.name}`} status={x.queue.status}
                    metric={x.queue.counts ? (x.queue.counts.waiting ?? 0) + (x.queue.counts.delayed ?? 0) : null} unit="kutmoqda"
                    caption={x.queue.detail ?? (x.queue.counts ? `faol ${x.queue.counts.active ?? 0} · xato ${x.queue.counts.failed ?? 0}` : undefined)}
                  />
                </View>
                <Callout tone={erpDev.data?.ok ? 'success' : erpDev.data ? 'warning' : 'neutral'} icon="smartphone">
                  {erpDev.data
                    ? `Telefondan ERP (${config.erpUrl}): ${erpDev.data.ok ? `javob ${erpDev.data.status}, ${erpDev.data.ms} ms` : 'javob yo\'q'}`
                    : 'Telefondan ERP tekshirilmoqda…'}
                </Callout>
              </View>

              {ov.data ? (
                <View style={{ gap: space.md }}>
                  <SectionHead title="Bugun" icon="calendar-days" />
                  <KpiGrid items={[
                    { label: 'Buyurtmalar', value: ov.data.orders.today, icon: 'clipboard-list' },
                    { label: 'Reyslar', value: ov.data.deliveries.today, icon: 'truck', module: 'logistics' },
                    { label: "Yo'lda (faol)", value: ov.data.deliveries.active, icon: 'navigation', module: 'logistics' },
                    { label: 'SLA buzildi', value: ov.data.deliveries.slaBreachedToday, icon: 'alarm-clock', tone: ov.data.deliveries.slaBreachedToday ? 'danger' : undefined },
                    { label: "Yangi foydalanuvchi", value: ov.data.users.today, icon: 'user-plus' },
                    { label: 'Faol qurilma (24 s)', value: ov.data.devices.active24h, icon: 'smartphone' },
                  ]} />
                  <KVList rows={[
                    { label: 'Foydalanuvchilar', value: fmtNum(ov.data.users.total) },
                    { label: 'Zavodlar / mijoz tashkilotlari', value: `${ov.data.organizations.plants} / ${fmtNum(ov.data.organizations.contractors)}` },
                    { label: 'Bloklangan (foyd. / tashk.)', value: `${ov.data.users.blocked} / ${ov.data.organizations.blocked}`, tone: ov.data.users.blocked + ov.data.organizations.blocked ? 'warning' : undefined },
                  ]} />
                </View>
              ) : null}

              <View style={{ gap: space.md }}>
                <SectionHead title="Server" icon="monitor" />
                <KVList rows={[
                  { label: 'Xost', value: x.system.hostname },
                  { label: 'Tizim', value: x.system.platform },
                  { label: 'Yuklama (1/5/15 daq)', value: `${x.system.loadAvg.join(' / ')} · ${x.system.cpus} CPU` },
                  { label: 'Xotira (bo\'sh / jami)', value: `${fmtNum(x.system.memory.freeMb)} / ${fmtNum(x.system.memory.totalMb)} MB` },
                  { label: 'API jarayoni (RSS / heap)', value: `${x.system.memory.rssMb} / ${x.system.memory.heapUsedMb} MB` },
                  { label: 'Disk', value: x.system.disk ? `${x.system.disk.freeGb} GB bo'sh · ${x.system.disk.usedPct ?? '—'}% band` : '—', tone: (x.system.disk?.usedPct ?? 0) > 85 ? 'danger' : undefined },
                  { label: 'Server ishlamoqda', value: fmtUptime(x.system.osUptimeSec) },
                  { label: 'Tekshirildi', value: fmtRel(x.at) },
                ]} />
              </View>

              <View style={{ gap: space.md }}>
                <SectionHead title="Xatolar" icon="triangle-alert" unit={`${x.errors.lastHour} / soat · ${x.errors.last24h} / sutka`} />
                {x.errors.recent.length === 0
                  ? <ListGroup><EmptyState compact icon="circle-check" title="Xato yo'q" hint="Oxirgi ishga tushgandan beri 5xx xato bo'lmadi" /></ListGroup>
                  : (
                    <ListGroup>
                      {x.errors.recent.map((e, i) => (
                        <ListItem key={`${e.at}-${i}`} icon="circle-alert" tone="danger" chevron={false} title={`${e.method} ${e.path}`} subtitle={`${e.status} · ${e.message}`} value={fmtRel(e.at)} />
                      ))}
                    </ListGroup>
                  )}
              </View>

              <View style={{ gap: space.md }}>
                <SectionHead title="Ilova versiyalari" icon="smartphone" unit="30 kun" />
                {x.clients.length === 0
                  ? <ListGroup><EmptyState compact icon="smartphone" title="Ma'lumot yo'q" /></ListGroup>
                  : (
                    <ListGroup>
                      {x.clients.map((cl) => (
                        <ListItem key={`${cl.platform}-${cl.appVersion}`} icon={cl.platform === 'ios' ? 'smartphone' : 'monitor'} chevron={false} title={`${cl.platform} · v${cl.appVersion}`} value={`${fmtNum(cl.devices)} ta`} badge={cl.appVersion === appVersion ? { text: 'joriy', tone: 'success' } : undefined} />
                      ))}
                    </ListGroup>
                  )}
              </View>

              <Txt v="caption" color="faint" align="center">{`${user?.fullName ?? user?.phone ?? ''} · har bir amal jurnalga yoziladi`}</Txt>
            </Reveal>
          )}
      </ScrollView>
    </Screen>
  );
}
