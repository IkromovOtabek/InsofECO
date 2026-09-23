import React from 'react';
import { ErpList } from '@/features/erp/screens';

/** Ish boshqaruvchi — brigada topshiriqlari (`/api/mobile/list?key=tasks`). */
export default function Work() {
  return <ErpList listKey="tasks" />;
}
