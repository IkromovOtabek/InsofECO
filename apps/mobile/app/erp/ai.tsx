import React from 'react';
import { ErpAiChat } from '@/features/erp/ai-chat';

/**
 * AI yordamchi — orqaga tugmali alohida ekran (direktor: bosh sahifadagi «AI so'rov» va Menyu → Tezkor).
 * Pastki panelda AI tabi yo'q; ma'lumot vebdagi "Tahlil → AI" bilan bitta (`/api/mobile/ai`).
 */
export default function ErpAiScreen() {
  return <ErpAiChat standalone />;
}
