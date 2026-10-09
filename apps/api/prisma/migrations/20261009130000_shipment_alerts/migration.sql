-- Yuk reysi kuzatuvi: obyektga yetib kelish (geofence) va ogohlantirishlar (uzoq turish, GPS jim).
-- Har biri bir marta yuboriladi — vaqt shu ustunlarda saqlanadi.

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "nearSiteAt" TIMESTAMP(3),
ADD COLUMN "stopAlertAt" TIMESTAMP(3),
ADD COLUMN "silentAlertAt" TIMESTAMP(3);
