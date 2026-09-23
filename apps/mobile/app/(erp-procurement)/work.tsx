import React from 'react';
import { ErpList } from '@/features/erp/screens';

/** Snabjeniye — ishchi ro'yxat (`/api/mobile/list?key=receipts`). */
export default function Work() {
  return <ErpList listKey="receipts" />;
}
