import React from 'react';
import { ErpTabRoute } from '@/features/erp/screens';

/** Reys haqi — narx va to'lov turi (ish boshqaruvchi tasdig'iga boradi); nima ko'rsatilishi `features/erp/roles.ts` dagi `tabs` da. */
export default function Tab() {
  return <ErpTabRoute role="DISPATCHER" route="reys-haqi" />;
}
