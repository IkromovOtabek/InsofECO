import React from 'react';
import { ErpList } from '@/features/erp/screens';

/** Sklad — ishchi ro'yxat (`/api/mobile/list?key=stock`). */
export default function Work() {
  return <ErpList listKey="stock" />;
}
