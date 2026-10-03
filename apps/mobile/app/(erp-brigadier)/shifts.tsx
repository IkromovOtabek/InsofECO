import React from 'react';
import { ErpTabRoute } from '@/features/erp/screens';

/** Smenalar — tab ekrani; nima ko'rsatilishi `features/erp/roles.ts` dagi `tabs` da. */
export default function Tab() {
  return <ErpTabRoute role="BRIGADIER" route="shifts" />;
}
