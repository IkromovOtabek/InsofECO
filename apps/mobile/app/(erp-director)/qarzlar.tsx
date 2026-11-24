import React from 'react';
import { ErpTabRoute } from '@/features/erp/screens';

/** Qarzlar — mijozlar qarzi (`customers` ro'yxati); nima ko'rsatilishi `features/erp/roles.ts` dagi `tabs` da. */
export default function Tab() {
  return <ErpTabRoute role="DIRECTOR" route="qarzlar" />;
}
