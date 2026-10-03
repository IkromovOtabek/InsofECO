import React from 'react';
import { ErpTabRoute } from '@/features/erp/screens';

/** Nasiya — tab ekrani; nima ko'rsatilishi `features/erp/roles.ts` dagi `tabs` da. */
export default function Tab() {
  return <ErpTabRoute role="SALES" route="nasiya" />;
}
