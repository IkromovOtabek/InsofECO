import React, { useRef } from 'react';
import { dialog, toast } from '@/design/ui';
import { useSession } from '@/core/session';
import { SetRow } from '@/components/set-row';
import { authApi } from './api';
import i18n from '@/core/i18n';

/**
 * "Hisobni o'chirish" qatori (App Store / Google Play talabi) — `SetGroup` ichida ishlatiladi.
 * Faqat ECO hisobi uchun: server `DELETE /me` bor. Mijoz darhol o'chadi; zavod haydovchisi so'rov
 * qoldiradi — direktor ERP'da tasdiqlagach hisob anonimlashadi. ERP hisobida (API yo'q) hech narsa chizilmaydi.
 * Tasdiq — `dialog()` (ildizdagi DialogHost): qator `SetGroup` (overflow: hidden) ichida, daraxt ichidagi
 * `Confirm` karta chegarasida qirqilib qolardi.
 */
export function DeleteAccountRow() {
  const { kind, user, setUser, signOut } = useSession();
  const busy = useRef(false);
  if (kind !== 'eco' || !user) return null;

  const isDriver = user.memberships.some((m) => m.isActive && m.role === 'HAYDOVCHI');
  const requested = !!user.deleteRequestedAt;

  const remove = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await authApi.deleteAccount();
      if (r.status === 'deleted') {
        toast.success("Hisobingiz o'chirildi");
        await signOut();
      } else {
        setUser({ ...user, deleteRequestedAt: new Date().toISOString() });
        toast.info("So'rov zavod direktoriga yuborildi. Tasdiqlangach hisob o'chiriladi.", "So'rov qabul qilindi");
      }
    } catch (e) {
      toast.error((e as Error).message, 'Xato');
    } finally {
      busy.current = false;
    }
  };

  const ask = () => dialog(
    "Hisobni o'chirish",
    isDriver
      ? "Siz zavod haydovchisisiz — hisobni direktor tasdiqlagach o'chiramiz. Shu vaqtgacha ilova ishlayveradi."
      : "Telefon raqamingiz, ismingiz va kirish ma'lumotlaringiz butunlay o'chiriladi. Buyurtma tarixi shaxsga bog'lanmagan holda qoladi. Qaytarib bo'lmaydi.",
    [
      { text: isDriver ? "So'rov yuborish" : "Ha, o'chirish", style: 'destructive', onPress: () => void remove() },
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

  return requested ? (
    <SetRow icon="hourglass" tone="warning" title="O'chirish so'ralgan" subtitle="Direktor tasdig'i kutilmoqda — bekor qilish uchun bosing" onPress={() => void cancel()} chevron={false} />
  ) : (
    <SetRow icon="trash" module="warehouse" title="Hisobni o'chirish" danger onPress={ask} chevron={false} />
  );
}
