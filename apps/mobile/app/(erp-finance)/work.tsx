import React from 'react';
import { ErpList } from '@/features/erp/screens';

/** Moliya — ishchi ro'yxat (`/api/mobile/list?key=cashflow`). */
export default function Work() {
  return <ErpList listKey="cashflow" />;
}
