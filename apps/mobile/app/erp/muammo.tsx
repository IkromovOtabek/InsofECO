import React, { useEffect } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SkeletonList } from '@/design/blocks';
import { useErpHome } from '@/features/erp/api';
import { IssueScreen, isIssueKind } from '@/features/erp/brigadier-sheets';
import { idSeg } from '@/features/erp/ui';

/**
 * Brigadir — «Muammo bildirish» (maket 03). `ref` — topshiriq id (topshiriq kartasidan) yoki bo'sh — brigada (`brigadeToday.ref`);
 * `kind` — tur oldindan tanlangan bo'lsa (`equipment` / `material` / `staff` / `other`).
 */
export default function IssueRoute() {
  const nav = useNavigation();
  const router = useRouter();
  const { ref, kind } = useLocalSearchParams<{ ref?: string; kind?: string }>();
  useEffect(() => { nav.setOptions({ headerShown: false }); }, [nav]);
  const t = useErpHome().data?.brigadeToday;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const refId = ref || t?.ref;
  if (!refId) return <SkeletonList rows={4} />;
  const fromTask = !refId.startsWith('b~');
  return (
    <IssueScreen
      refId={refId}
      tasks={fromTask ? [] : t?.tasks.map((x) => ({ id: x.id, label: `${x.brigade ?? x.taskNo} · ${x.product}` })) ?? []}
      equipment={t?.equipment ?? []}
      open={fromTask ? [] : t?.issues.rows ?? []}
      kind={isIssueKind(kind) ? kind : undefined}
      onBack={back}
      onDone={back}
      onOpen={(id) => { const i = id.indexOf(':'); router.push((i > 0 ? `/erp/${id.slice(0, i)}/${idSeg(id.slice(i + 1))}` : `/erp/brig-issue/${idSeg(id)}`) as never); }}
    />
  );
}
