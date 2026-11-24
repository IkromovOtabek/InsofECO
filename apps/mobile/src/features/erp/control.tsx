import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ListItem } from '@/design/primitives';
import { ListGroup, PageHeader, Reveal, SectionHead, SkeletonList } from '@/design/blocks';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useHeaderRaise } from '@/design/motion';
import type { IconName } from '@/design/icons';
import type { ErpRow, ErpSection } from '@/core/erp';
import { useErpHome, useErpList } from './api';
import { ProgressChart } from './charts';
import { ROW_ICON, RowsGroup, idSeg, listModule } from './ui';

/**
 * Direktor «Nazorat» tabi — qaror talab qiladigan hamma narsa bir joyda: tasdiq kutayotganlar (`approvals`),
 * «Direktor nazorati — plan / fakt» va «Egasi qarori kerak» (vebdagi Egasi dashbordining `#qaror` bloki).
 * Ma'lumot bosh sahifa bilan bitta keshdan (`/api/mobile/home`) — ilova raqam hisoblamaydi.
 */
const CONTROL_SECTIONS = [/^Direktor nazorati/, /^Egasi qarori/, /^Egasi paneli/];

/** Qatorning o'z `open`i (ro'yxat) bo'lim `target`idan (kartochka) ustun — bosh sahifadagi bilan bir xil qoida. */
const rowHref = (s: ErpSection, r: ErpRow) => (r.open ? `/erp/list/${r.open}` : s.target ? `/erp/${s.target}/${idSeg(r.id)}` : null);

export function ControlScreen({ title }: { title: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const raise = useHeaderRaise();
  const { data, isLoading, refetch, isRefetching } = useErpHome();
  const approvals = useErpList('approvals');
  const pending = approvals.data?.rows.length ?? 0;
  const go = (href: string) => router.push(href as never);
  const sections = CONTROL_SECTIONS
    .map((re) => data?.sections.find((s) => re.test(s.title)))
    .filter((s): s is ErpSection => !!s && (s.rows.length > 0 || s.chart?.kind === 'progress'));

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <PageHeader title={title} raised={raise.raised} style={{ paddingTop: insets.top + space.sm }} />
      <ScrollView
        onScroll={raise.onScroll}
        scrollEventThrottle={raise.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.xs, paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); void approvals.refetch(); }} tintColor={c.brand} />}
      >
        <Reveal loading={isLoading} skeleton={<SkeletonList rows={6} />}>
          <ListGroup key="appr">
            <ListItem
              icon="circle-check"
              title="Tasdiq kutmoqda"
              subtitle={pending ? "Bloklangan zayavka, ta'minot, ish haqi" : "Hozir tasdiq kutayotgan hujjat yo'q"}
              badge={pending ? { text: String(pending), tone: 'warning' } : undefined}
              onPress={() => go('/erp/list/approvals')}
            />
          </ListGroup>
          {sections.flatMap((s) => [
            <SectionHead key={`${s.title}-h`} title={s.title} />,
            s.chart?.kind === 'progress'
              ? <ProgressChart key={s.title} chart={s.chart} onOpen={(k) => go(`/erp/list/${k}`)} />
              : (
                <RowsGroup
                  key={s.title}
                  rows={s.rows}
                  icon={(s.icon ?? ROW_ICON[s.target ?? ''] ?? 'circle') as IconName}
                  module={listModule(s.target)}
                  onRow={(r) => { const h = rowHref(s, r); return h ? () => go(h) : undefined; }}
                />
              ),
          ])}
          {!sections.length ? (
            <EmptyState key="e" icon="circle-check" title="Nazorat ma'lumoti yuklanmadi" hint="Internetni tekshirib, qayta urinib ko'ring" onRetry={() => void refetch()} />
          ) : null}
        </Reveal>
      </ScrollView>
    </View>
  );
}
