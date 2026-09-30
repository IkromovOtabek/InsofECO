import React from 'react';
import { ErpList } from '@/features/erp/screens';

/** Mexanik — ishchi ro'yxat (`/api/mobile/list?key=trips`). */
export default function Work() {
  return <ErpList listKey="trips" />;
}
