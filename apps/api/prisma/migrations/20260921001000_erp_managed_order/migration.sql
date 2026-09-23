-- ERP zayavkasi to'liq kelganda hajm/summani ECO qayta hisoblamaydi.
-- Eski reys-hisobi oqimi o'zgarishsiz qoladi: mavjud yozuvlarda erpManaged = false.
ALTER TABLE "Order" ADD COLUMN "erpManaged" BOOLEAN NOT NULL DEFAULT false;
