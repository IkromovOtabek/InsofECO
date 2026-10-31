import React from 'react';
import { ErpTabRoute } from '@/features/erp/screens';

/** Transport — holat va texnik xizmat; nima ko'rsatilishi `features/erp/roles.ts` dagi `tabs` da. */
export default function Tab() {
  return <ErpTabRoute role="DISPATCHER" route="transport" />;
}
