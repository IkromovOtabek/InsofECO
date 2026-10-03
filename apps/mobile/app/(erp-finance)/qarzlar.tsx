import React from 'react';
import { ErpTabRoute } from '@/features/erp/screens';

/** Qarzlar — tab ekrani; nima ko'rsatilishi `features/erp/roles.ts` dagi `tabs` da. */
export default function Tab() {
  return <ErpTabRoute role="FINANCE" route="qarzlar" />;
}
