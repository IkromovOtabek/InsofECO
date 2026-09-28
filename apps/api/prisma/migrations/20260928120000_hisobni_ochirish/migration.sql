-- Hisobni o'chirish (App Store / Google Play talabi).
-- Mijoz (QURUVCHI/TADBIRKOR) darhol anonimlashtiriladi; zavod haydovchisi so'rov qoldiradi,
-- ERP direktori tasdiqlagach (a'zolik o'chirilgach) anonimlashtiriladi. Qator o'chirilmaydi —
-- reys/xabar tarixi FK bilan bog'langan.
ALTER TABLE "User" ADD COLUMN "deleteRequestedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
