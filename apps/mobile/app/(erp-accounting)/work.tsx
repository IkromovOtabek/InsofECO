import React from 'react';
import { ErpList } from '@/features/erp/screens';

/** Buxgalteriya — ishchi ro'yxat (`/api/mobile/list?key=invoices`). */
export default function Work() {
  return <ErpList listKey="invoices" />;
}
