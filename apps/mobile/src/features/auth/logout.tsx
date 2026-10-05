import React, { useCallback, useState } from 'react';
import { Button } from '@/design/primitives';
import { dialog } from '@/design/ui';
import i18n from '@/core/i18n';
import { useSession } from '@/core/session';
import { erpAuth } from '@/core/erp';
import { outbox } from '@/core/outbox';
import { clearAccountCache } from '@/core/query';
import { authApi } from './api';

/**
 * Chiqish — barcha rollar, ERP, do'kon profili va superadmin uchun BITTA yo'l:
 *   1) outbox: egasiz elementlarga joriy ega yoziladi (keyingi hisob ularni yubormasin);
 *   2) serverdagi sessiya bekor qilinadi (ECO `/auth/logout` yoki ERP `/auth/logout`) — o'g'irlangan
 *      refresh token ham ishlamaydi; push o'chiriladi; tokenlar va profil o'chiriladi (`signOut`);
 *   3) so'rovlar keshi (xotira + disk) va soket tozalanadi;
 *   4) kirish ekraniga o'tiladi (Gate `takeLogoutRedirect()` orqali — poygasiz).
 */
let redirect: string | null = null;
/** Gate (app/_layout.tsx) mehmon holatiga o'tganda bir marta o'qiydi. */
export const takeLogoutRedirect = () => { const r = redirect; redirect = null; return r; };

let running: Promise<void> | null = null;

export function logout(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const s = useSession.getState();
    if (s.status !== 'authed') return;
    outbox.sealOwnership();
    const revoke = s.kind === 'erp' ? () => erpAuth.logout() : () => authApi.logout();
    redirect = '/(auth)/login';
    await s.signOut({ revoke });
    clearAccountCache();
  })().finally(() => { running = null; });
  return running;
}

const CONFIRM_TEXT = {
  eco: "Qayta kirish uchun login yoki telefon kodi kerak bo'ladi.",
  erp: "Qayta kirish uchun login va parol kerak bo'ladi.",
};

/** `confirm()` — "Chiqasizmi?" oynasi, tasdiqlansa `logout()`; `pending` — chiqish davom etmoqda. */
export function useLogout() {
  const kind = useSession((s) => s.kind);
  const [pending, setPending] = useState(false);
  const run = useCallback(async () => {
    setPending(true);
    try { await logout(); } finally { setPending(false); }
  }, []);
  const confirm = useCallback(() => {
    dialog('Chiqasizmi?', CONFIRM_TEXT[kind === 'erp' ? 'erp' : 'eco'], [
      { text: 'Chiqish', style: 'destructive', onPress: () => void run() },
      { text: i18n.t('ui.cancel'), style: 'cancel' },
    ], { tone: 'warning', icon: 'log-out' });
  }, [kind, run]);
  return { confirm, logout: run, pending };
}

/** Standart "Chiqish" tugmasi (tasdiq bilan). */
export function LogoutButton({ variant = 'secondary', size = 'lg', textColor }: { variant?: 'secondary' | 'danger' | 'ghost'; size?: 'md' | 'lg' | 'xl'; textColor?: string }) {
  const { confirm, pending } = useLogout();
  return <Button title="Chiqish" variant={variant} size={size} icon="log-out" textColor={textColor} loading={pending} onPress={confirm} />;
}
