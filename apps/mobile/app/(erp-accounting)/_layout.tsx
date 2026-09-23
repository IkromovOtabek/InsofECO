import React from 'react';
import { ErpTabs } from '@/features/erp/screens';

/** Insof ERP — Buxgalteriya bo'limi. Tablar va rang `features/erp/roles.ts` dagi sozlamadan. */
export default function Layout() {
  return <ErpTabs role="ACCOUNTING" />;
}
