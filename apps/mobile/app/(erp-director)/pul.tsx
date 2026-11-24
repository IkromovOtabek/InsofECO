import React from 'react';
import { ErpTabRoute } from '@/features/erp/screens';

/** Pul — kirim/chiqim oqimi (`cashflow` ro'yxati); nima ko'rsatilishi `features/erp/roles.ts` dagi `tabs` da. */
export default function Tab() {
  return <ErpTabRoute role="DIRECTOR" route="pul" />;
}
