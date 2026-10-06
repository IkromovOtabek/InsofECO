import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Callout, Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { ChipGroup } from '@/design/blocks';
import { Sheet, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { haptic } from '@/design/motion';
import { radius, size, space } from '@/design/tokens';
import { ApiException } from '@/core/api';
import { downloadDailyReport, ymd } from './api';
import { DayCalendar } from './range-calendar';

/**
 * "Kunlik hisobot (Excel)" — direktor bosh sahifasi va menyusidan ochiladi.
 * Kun tanlanadi: "Bugun" / "Kecha" tugmalari yoki kalendardan istalgan o'tgan kun
 * (standart — bugun). Fayl ERP'dan Bearer token bilan yuklanadi
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
  const chip = day.getTime() === today.getTime() ? 'today' : day.getTime() === addDays(today, -1).getTime() ? 'yesterday' : 'other';

  const pick = (d: Date) => {
    if (d > today) return;
    setError(null);
    setDay(d);
  };

  const run = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const uri = await downloadDailyReport(ymd(day));
      // Kech yuklanadi: expo-sharing native moduli yo'q eski build'da (OTA) butun ilova yiqilmasin
      let Sharing: typeof import('expo-sharing') | null = null;
      try { Sharing = require('expo-sharing') as typeof import('expo-sharing'); } catch { Sharing = null; }
      if (Sharing && (await Sharing.isAvailableAsync())) {
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
          onChange={(k) => { haptic.selection(); if (k === 'today') pick(today); else if (k === 'yesterday') pick(addDays(today, -1)); }}
        />
        {/* Istalgan o'tgan kun — kalendardan; tanlangani pastda to'liq yoziladi */}
        <DayCalendar value={day} onChange={pick} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.touch - space.sm, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: c.brandSoft }} accessibilityLiveRegion="polite">
          <Icon name="calendar-days" tone="brand" size={size.iconSm} />
          <Txt v="label" color="strong" style={{ flex: 1 }} numberOfLines={1}>{longDay(day)}</Txt>
        </View>
        <Txt v="bodySm" color="muted">
          Varaqlar: xulosa, sotuv, ishlab chiqarish, reyslar, mijoz to&apos;lovlari, kirim-chiqim va muammolar. Fayl Excel, Telegram yoki boshqa ilovada ochiladi.
        </Txt>
        {error ? <Callout tone="danger" icon="triangle-alert">{error}</Callout> : null}
      </View>
    </Sheet>
  );
}
