import React from 'react';
import { SPECIALTY_LABEL } from '@insof/shared';
import { Card, Gap, ListItem, Txt, fmtSum, fmtUnit } from '@/design/primitives';
import { Stars } from '@/design/ui';
import { space } from '@/design/tokens';
import { Profile } from '@/screens/Profile';
import { useQuruvchiDashboard } from '@/features/eco/api';

export default function QuruvchiProfile() {
  const d = useQuruvchiDashboard(); const p = d.data?.profile;
  return (
    <Profile>
      {p ? (
        <>
          <Gap />
          <Card style={{ paddingVertical: space.xs }}>
            <ListItem icon="wrench" module="production" title="Mutaxassislik" subtitle={SPECIALTY_LABEL[p.specialty as keyof typeof SPECIALTY_LABEL]} />
            <ListItem icon="clock" title="Tajriba" subtitle={fmtUnit(p.experienceYears, 'yil')} />
            <ListItem icon="banknote" tone="success" title="Kunlik narx" subtitle={fmtSum(p.dailyRate)} />
            <ListItem icon="star" title="Reyting" right={<Stars value={p.ratingAvg} />} subtitle={`${p.ratingCount} baho · ${p.completedJobs} ish`} last />
          </Card>
          <Txt v="caption" style={{ marginTop: space.sm, marginLeft: space.xs }}>Profilni tahrirlash — keyingi versiyada</Txt>
        </>
      ) : null}
    </Profile>
  );
}
