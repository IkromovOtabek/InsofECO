import React from 'react';
import { ErpTabRoute } from '@/features/erp/screens';

/** Kirim — pul so'rovi (Transport / Zavod / Boshqalar) va o'z so'rovlari; ekran `features/erp/kirim.tsx` da. */
export default function Tab() {
  return <ErpTabRoute role="MECHANIC" route="kirim" />;
}
