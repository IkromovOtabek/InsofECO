import React from 'react';
import { ErpTabRoute } from '@/features/erp/screens';

/** Arenda — oy varag'i, kassa, kirim/chiqim; ekran `features/erp/arenda.tsx` da. */
export default function Tab() {
  return <ErpTabRoute role="SECRETARY" route="arenda" />;
}
