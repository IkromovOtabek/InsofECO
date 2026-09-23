import React from 'react';
import { SPECIALTY_LABEL } from '@insof/shared';
import { Card, Gap, Txt } from '@/design/primitives';
import { Row, Stars } from '@/design/ui';
import { Profile } from '@/screens/Profile';
import { useQuruvchiDashboard } from '@/features/eco/api';

export default function QuruvchiProfile() {
  const d = useQuruvchiDashboard(); const p = d.data?.profile;
  return (
    <Profile>
      {p ? (<><Gap /><Card style={{ paddingVertical: 4 }}>
        <Row icon="construct" title="Mutaxassislik" subtitle={SPECIALTY_LABEL[p.specialty as keyof typeof SPECIALTY_LABEL]} />
        <Row icon="time" title="Tajriba" subtitle={`${p.experienceYears} yil`} />
        <Row icon="cash" title="Kunlik narx" subtitle={`${Number(p.dailyRate).toLocaleString('ru-RU')} so'm`} />
        <Row icon="star" title="Reyting" right={<Stars value={p.ratingAvg} />} subtitle={`${p.ratingCount} baho · ${p.completedJobs} ish`} last />
      </Card><Txt v="caption" color="secondary" style={{ marginTop: 8, marginLeft: 4 }}>Profilni tahrirlash — keyingi versiyada</Txt></>) : null}
    </Profile>
  );
}
