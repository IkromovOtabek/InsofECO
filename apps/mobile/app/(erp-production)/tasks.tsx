import React from 'react';
import { ErpTabRoute } from '@/features/erp/screens';

/** Topshiriq — tab ekrani; nima ko'rsatilishi `features/erp/roles.ts` dagi `tabs` da. */
export default function Tab() {
  return <ErpTabRoute role="PRODUCTION" route="tasks" />;
}
