import React from 'react';
import { ErpList } from '@/features/erp/screens';

/** Kassa / bank — ishchi ro'yxat (`/api/mobile/list?key=payments`). */
export default function Work() {
  return <ErpList listKey="payments" />;
}
