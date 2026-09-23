import React from 'react';
import { ErpList } from '@/features/erp/screens';

/** Ishlab chiqarish — ishchi ro'yxat (`/api/mobile/list?key=production`). */
export default function Work() {
  return <ErpList listKey="production" />;
}
