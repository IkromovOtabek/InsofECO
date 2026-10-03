import React from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { ListGroup, SkeletonList } from '@/design/blocks';
import { EmptyState, ListItem, Screen } from '@/design/primitives';
import { fmtRel } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { space } from '@/design/tokens';
import { useAdminAudit } from '@/features/admin/api';

/** Amallar jurnali — oxirgi 30 ta /admin so'rovi: kim, nima, natija. */
export default function AdminAudit() {
  const { c } = useTheme();
  const q = useAdminAudit();
  const rows = q.data ?? [];
  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.pageX, paddingTop: space.sm, paddingBottom: space.x12 * 2 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.textMuted} />}
      >
        {q.isLoading ? <SkeletonList rows={8} />
          : q.isError && !q.data ? <EmptyState icon="cloud-off" title="Yuklanmadi" onRetry={() => void q.refetch()} />
          : rows.length === 0 ? <EmptyState icon="history" title="Jurnal bo'sh" />
          : (
            <ListGroup>
              {rows.map((r) => {
                const write = !r.action.startsWith('GET');
                const failed = (r.status ?? 200) >= 400;
                return (
                  <ListItem
                    key={r.id}
                    icon={failed ? 'circle-alert' : write ? 'pencil' : 'eye'}
                    tone={failed ? 'danger' : write ? 'warning' : undefined}
                    chevron={false}
                    title={r.action}
                    subtitle={`${r.actor.fullName ?? r.actor.phone}${r.targetId ? ` · ${r.targetType ?? ''} ${r.targetId}` : ''}${r.status ? ` · ${r.status}` : ''}`}
                    value={fmtRel(r.createdAt)}
                  />
                );
              })}
            </ListGroup>
          )}
      </ScrollView>
    </Screen>
  );
}
