import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Sheet, dialog, toast } from '@/design/ui';
import { Button, Input, Txt } from '@/design/primitives';
import { space } from '@/design/tokens';
import { useSession } from '@/core/session';
import { erpAuth } from '@/core/erp';
import { SetRow } from '@/components/set-row';
import { ApiException } from '@/core/api';
import { authApi } from './api';
import i18n from '@/core/i18n';

/**
 * "Hisobni o'chirish" qatori (App Store / Google Play talabi) — Sozlamalar → Hisob (`SetGroup` ichida). Hamma kabinet uchun:
 *  · ECO hisobi — server `DELETE /me`: mijoz darhol o'chadi; zavod haydovchisi so'rov qoldiradi — direktor ERP'da
 *    tasdiqlagach hisob anonimlashadi;
 *  · ERP xodimi — hisobni direktor bergan: darhol o'chmaydi, so'rov direktorga tushadi (`/api/mobile/account`),
 *    tasdiqlansa login yopiladi, xodim kartasi (HR) qoladi.
 * Tasdiq — `dialog()` (ildizdagi DialogHost): qator `SetGroup` (overflow: hidden) ichida, daraxt ichidagi
 * `Confirm` karta chegarasida qirqilib qolardi.
 */
export function DeleteAccountRow() {
  const { kind } = useSession();
  return kind === 'erp' ? <ErpDeleteAccountRow /> : <EcoDeleteAccountRow />;
}

function ErpDeleteAccountRow() {
  // null — holat hali kelmadi (qator ko'rinmaydi, bosib bo'lmaydigan "so'ralgan" holati chiqib ketmasin)
  const [pending, setPending] = useState<boolean | null>(null);
  const busy = useRef(false);
  useEffect(() => { erpAuth.deletionStatus().then((r) => setPending(r.pending)).catch(() => setPending(false)); }, []);
  if (pending === null) return null;

  const request = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await erpAuth.requestDeletion();
      setPending(true);
      toast.info('Direktor tasdiqlagach hisobingiz yopiladi.', "So'rov yuborildi");
    } catch (e) {
      toast.error((e as Error).message, 'Xato');
    } finally {
      busy.current = false;
    }
  };
  const cancel = async () => {
    try { await erpAuth.cancelDeletion(); setPending(false); toast.success("So'rov qaytarib olindi"); }
    catch (e) { toast.error((e as Error).message, 'Xato'); }
  };
  const ask = () => dialog(
    "Hisobni o'chirish",
    "Hisobingizni direktor bergan, shuning uchun so'rov unga boradi. Tasdiqlangach login yopiladi, ilova va kompyuterdagi seanslar tugaydi. Xodim kartangiz (HR) saqlanib qoladi.",
    [
      { text: "So'rov yuborish", style: 'destructive', onPress: () => void request() },
      { text: i18n.t('ui.cancel'), style: 'cancel' },
    ],
  );

  return pending ? (
    <SetRow icon="hourglass" tone="warning" title="O'chirish so'ralgan" subtitle="Direktor tasdig'i kutilmoqda — bekor qilish uchun bosing" onPress={() => void cancel()} chevron={false} />
  ) : (
    <SetRow icon="trash" module="warehouse" title="Hisobni o'chirish" subtitle="So'rov direktorga boradi" danger onPress={ask} chevron={false} />
  );
}

function EcoDeleteAccountRow() {
  const { kind, user, setUser, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  if (kind !== 'eco' || !user) return null;

  const isDriver = user.memberships.some((m) => m.isActive && m.role === 'HAYDOVCHI');
  const requested = !!user.deleteRequestedAt;
  const errText = (e: unknown) => (e instanceof ApiException ? e.message : 'Tarmoq xatosi. Internetni tekshiring');

  // Qaytarib bo'lmaydigan amal — server parol (yoki parolsiz hisobda Telegram kod) bilan qayta tasdiq so'raydi
  const start = async () => {
    setSecret(''); setError(undefined); setSent(false);
    let withPassword = user.hasPassword;
    if (withPassword === undefined) {
      // Eski keshdagi profilda maydon yo'q — serverdan yangilaymiz
      try { const me = await authApi.me(); setUser(me); withPassword = me.hasPassword; } catch { withPassword = true; }
    }
    setHasPassword(withPassword !== false);
    setOpen(true);
  };

  const sendCode = async () => {
    setLoading(true);
    try { await authApi.deletionCode(); setSent(true); setError(undefined); }
    catch (e) { setError(errText(e)); }
    finally { setLoading(false); }
  };

  const remove = async () => {
    if (!secret) { setError(hasPassword ? 'Parolingizni kiriting' : 'Telegram kodni kiriting'); return; }
    setLoading(true);
    try {
      const r = await authApi.deleteAccount(hasPassword ? { password: secret } : { code: secret });
      setOpen(false);
      if (r.status === 'deleted') {
        toast.success("Hisobingiz o'chirildi");
        await signOut();
      } else {
        setUser({ ...user, deleteRequestedAt: new Date().toISOString() });
        toast.info("So'rov zavod direktoriga yuborildi. Tasdiqlangach hisob o'chiriladi.", "So'rov qabul qilindi");
      }
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  };

  const ask = () => dialog(
    "Hisobni o'chirish",
    isDriver
      ? "Siz zavod haydovchisisiz — hisobni direktor tasdiqlagach o'chiramiz. Shu vaqtgacha ilova ishlayveradi."
      : "Telefon raqamingiz, ismingiz va kirish ma'lumotlaringiz butunlay o'chiriladi. Buyurtma tarixi shaxsga bog'lanmagan holda qoladi. Qaytarib bo'lmaydi.",
    [
      { text: isDriver ? "Davom etish" : "Ha, o'chirish", style: 'destructive', onPress: () => void start() },
      { text: i18n.t('ui.cancel'), style: 'cancel' },
    ],
  );

  const cancel = async () => {
    try {
      await authApi.cancelDeletion();
      setUser({ ...user, deleteRequestedAt: null });
      toast.success("So'rov qaytarib olindi");
    } catch (e) {
      toast.error((e as Error).message, 'Xato');
    }
  };

  return (
    <>
      {requested ? (
        <SetRow icon="hourglass" tone="warning" title="O'chirish so'ralgan" subtitle="Direktor tasdig'i kutilmoqda — bekor qilish uchun bosing" onPress={() => void cancel()} chevron={false} />
      ) : (
        <SetRow icon="trash" module="warehouse" title="Hisobni o'chirish" danger onPress={ask} chevron={false} />
      )}
      <Sheet
        open={open}
        onClose={() => !loading && setOpen(false)}
        title="Tasdiqlash"
        footer={<Button title={isDriver ? "So'rov yuborish" : "Hisobni o'chirish"} variant="danger" size="lg" loading={loading} onPress={() => void remove()} />}
      >
        <View style={{ gap: space.md }}>
          <Txt color="muted">{hasPassword ? 'Xavfsizlik uchun joriy parolingizni kiriting.' : "Xavfsizlik uchun raqamingizga Telegram orqali kelgan 6 xonali kodni kiriting."}</Txt>
          {hasPassword ? (
            <Input label="Joriy parol" value={secret} onChangeText={(v) => { setSecret(v); setError(undefined); }} secureTextEntry autoComplete="current-password" placeholder="••••••••" mono error={error} autoFocus />
          ) : (
            <>
              <Input label="Telegram kod" value={secret} onChangeText={(v) => { setSecret(v.replace(/\D/g, '').slice(0, 6)); setError(undefined); }} keyboardType="number-pad" placeholder="000000" mono error={error} />
              <Button title={sent ? 'Kodni qayta yuborish' : 'Kod yuborish'} variant="secondary" icon="send" disabled={loading} onPress={() => void sendCode()} />
              {sent ? <Txt color="muted">Kod yuborildi. Telegram ilovasini tekshiring.</Txt> : null}
            </>
          )}
        </View>
      </Sheet>
    </>
  );
}
