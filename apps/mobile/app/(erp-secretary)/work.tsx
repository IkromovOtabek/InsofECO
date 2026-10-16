import React from 'react';
import { ErpTabRoute } from '@/features/erp/screens';

/** Kirim-chiqim jurnali — kaliti `features/erp/roles.ts` dagi `listKey`. */
export default function Work() {
  return <ErpTabRoute role="SECRETARY" route="work" />;
}
