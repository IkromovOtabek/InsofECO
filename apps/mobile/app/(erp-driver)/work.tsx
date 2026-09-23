import React from 'react';
import { ErpList } from '@/features/erp/screens';

/** Haydovchi — o'z reyslari (`/api/mobile/list?key=trips`, serverda faqat o'ziniki qoladi). */
export default function Work() {
  return <ErpList listKey="trips" />;
}
