import React from 'react';
import { ErpTabs } from '@/features/erp/screens';
import { RouteErrorBoundary } from '@/components/route-error';

/** Ekran xatosi shu bo'lim ichida ushlanadi — butun navigator almashmaydi. */
export { RouteErrorBoundary as ErrorBoundary };

/** Insof ERP — Sotuv agenti bo'limi. Tablar va rang `features/erp/roles.ts` dagi sozlamadan. */
export default function Layout() {
  return <ErpTabs role="AGENT" />;
}
