import React from 'react';
import { ErpTabRoute } from '@/features/erp/screens';

/** Ishchi ro'yxat tabi — kaliti `features/erp/roles.ts` dagi `listKey`. */
export default function Work() {
  return <ErpTabRoute role="DRIVER" route="work" />;
}
