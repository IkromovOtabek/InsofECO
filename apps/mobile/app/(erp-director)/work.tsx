import React from 'react';
import { ErpList } from '@/features/erp/screens';

/** Direktor — "Tasdiqlar": qarorini kutayotgan hujjatlar (`/api/mobile/list?key=approvals`). */
export default function Work() {
  return <ErpList listKey="approvals" />;
}
