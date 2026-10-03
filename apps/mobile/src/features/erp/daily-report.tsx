import React, { useState } from 'react';
import { View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Button, Callout, IconButton, Txt } from '@/design/primitives';
import { ChipGroup } from '@/design/blocks';
import { Sheet, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { haptic } from '@/design/motion';
import { radius, size, space } from '@/design/tokens';
import { ApiException } from '@/core/api';
import { downloadDailyReport, ymd } from './api';

/**
 * "Kunlik hisobot (Excel)" — direktor bosh sahifasi va menyusidan ochiladi.
 * Kun tanlanadi (standart — bugun), fayl ERP'dan Bearer token bilan yuklanadi
 * (`GET /api/mobile/report/daily?date=`), so'ng tizimning "Ulashish / Ochish" oynasi chiqadi
 * (Excel, Telegram, Google Sheets…). Varaqlar: xulosa, sotuv, ishlab chiqarish, reyslar, to'lovlar, muammolar.
 */

const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const longDay = (d: Date) => `${d.getDate()}-${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${WEEKDAYS[d.getDay()]!.toLowerCase()}`;

export function DailyReportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const today = startOfDay(new Date());
  const [day, setDay] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isToday = day.getTime() === today.getTime();
  const chip = isToday ? 'today' : day.getTime() === addDays(today, -1).getTime() ? 'yesterday' : 'other';

  const move = (n: number) => {
    const next = addDays(day, n);
    if (next > today) return;
    haptic.selection();
    setError(null);
    setDay(next);
  };

  const run = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const uri = await downloadDailyReport(ymd(day));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          UTI: 'org.openxmlformats.spreadsheetml.sheet',
          dialogTitle: `Kunlik hisobot — ${ymd(day)}`,
        });
        onClose();
      } else {
        toast.info('Fayl qurilmaga saqlandi, lekin ulashish oynasi mavjud emas', 'Hisobot tayyor');
      }
    } catch (e) {
      setError(e instanceof ApiException ? e.message : "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring");
      haptic.warning();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Kunlik hisobot (Excel)"
      footer={<Button title={busy ? 'Tayyorlanmoqda…' : 'Yuklab olish va ulashish'} icon="download" size="lg" loading={busy} onPress={() => void run()} />}
    >
      <View style={{ gap: space.lg }}>
        <ChipGroup
          items={[{ key: 'today', label: 'Bugun' }, { key: 'yesterday', label: 'Kecha' }, ...(chip === 'other' ? [{ key: 'other', label: ymd(day).split('-').reverse().join('.') }] : [])]}
          value={chip}
          onChange={(k) => { setError(null); if (k === 'today') setDay(today); else if (k === 'yesterday') setDay(addDays(today, -1)); }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.pill, backgroundColor: c.bgSubtle }}>
          <IconButton icon="chevron-left" label="Oldingi kun" variant="secondary" size={size.touch - space.xs} onPress={() => move(-1)} />
          <View style={{ flex: 1, alignItems: 'center' }} accessibilityLiveRegion="polite">
            <Txt v="titleSm" align="center" numberOfLines={1}>{longDay(day)}</Txt>
          </View>
          <IconButton icon="chevron-right" label="Keyingi kun" variant="secondary" size={size.touch - space.xs} onPress={() => move(1)} disabled={isToday} style={isToday ? { opacity: 0.4 } : undefined} />
        </View>
        <Txt v="bodySm" color="muted">
          Varaqlar: xulosa, sotuv, ishlab chiqarish, reyslar, mijoz to&apos;lovlari, kirim-chiqim va muammolar. Fayl Excel, Telegram yoki boshqa ilovada ochiladi.
        </Txt>
        {error ? <Callout tone="danger" icon="triangle-alert">{error}</Callout> : null}
      </View>
    </Sheet>
  );
}
