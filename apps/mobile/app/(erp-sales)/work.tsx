import React from 'react';
import { ErpList } from '@/features/erp/screens';

/** Sotuv — ishchi ro'yxat (`/api/mobile/list?key=orders`). */
export default function Work() {
  return <ErpList listKey="orders" />;
}
