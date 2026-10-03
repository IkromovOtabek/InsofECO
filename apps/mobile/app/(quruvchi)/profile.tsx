import React from 'react';
import { View } from 'react-native';
import { SPECIALTY_LABEL } from '@insof/shared';
import { KpiGrid, ListGroup, SectionHead } from '@/design/blocks';
import { Gap, ListItem, Txt, fmtUnit } from '@/design/primitives';
import { Stars, fmtShort } from '@/design/ui';
import { space } from '@/design/tokens';
import { Profile } from '@/screens/Profile';
import { useQuruvchiDashboard } from '@/features/eco/api';

/** Quruvchi profili: umumiy profil + mutaxassislik bloki (reyting, tajriba, narx). */
export default function QuruvchiProfile() {
  const d = useQuruvchiDashboard(); const p = d.data?.profile;
  return (
    <Profile>
      {p ? (
        <View>
          <Gap h={space.grid} />
          <KpiGrid items={[
            { label: 'Reyting', value: p.ratingAvg.toFixed(1), icon: 'star', module: 'brand' },
            { label: 'Bajarilgan ish', value: p.completedJobs, icon: 'circle-check', tone: 'success' },
          ]} />
          <Gap h={space.section} />
          <SectionHead title="Mutaxassislik" icon="hard-hat" />
          <ListGroup>
            <ListItem icon="wrench" module="production" title="Mutaxassislik" right={<Txt v="bodyStrong" numberOfLines={1}>{SPECIALTY_LABEL[p.specialty as keyof typeof SPECIALTY_LABEL] ?? p.specialty}</Txt>} />
            <ListItem icon="clock" title="Tajriba" right={<Txt v="bodyStrong">{fmtUnit(p.experienceYears, 'yil')}</Txt>} />
            <ListItem icon="banknote" tone="success" title="Kunlik narx" right={<Txt v="bodyStrong">{`${fmtShort(p.dailyRate)} so'm`}</Txt>} />
            <ListItem icon="star" title="Baholar" subtitle={`${p.ratingCount} baho`} right={<Stars value={p.ratingAvg} />} />
          </ListGroup>
          <Txt v="caption" color="muted" style={{ marginTop: space.sm, marginLeft: space.xs }}>Profilni tahrirlash — keyingi versiyada</Txt>
        </View>
      ) : null}
    </Profile>
  );
}
