-- Yuk reysi kuzatuvi: iOS'dagi soxta "GPS jim" (nuqtasiz ping, platforma) va marshrutdan chetlashish
-- (haydovchi ilovasidagi rejadagi yo'l, bir martalik ogohlantirish).

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "gpsLastSeenAt" TIMESTAMP(3),
ADD COLUMN "gpsPlatform" TEXT,
ADD COLUMN "plannedRoute" JSONB,
ADD COLUMN "plannedRouteAt" TIMESTAMP(3),
ADD COLUMN "offRouteAlertAt" TIMESTAMP(3);
