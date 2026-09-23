import React from 'react';
import { ErpList } from '@/features/erp/screens';

/** Otdel kadr — ishchi ro'yxat (`/api/mobile/list?key=employees`). */
export default function Work() {
  return <ErpList listKey="employees" />;
}
