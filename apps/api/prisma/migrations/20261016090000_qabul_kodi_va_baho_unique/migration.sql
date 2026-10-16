-- Qabul kodi: muddat va urinishlar soni (4 xonali kod cheklovsiz terib topilardi — endi 6 xona, 30 daqiqa, 5 urinish).
-- Baho: bir muallif bir ish/yukka bitta sharh (reytingni spam qilib tushirib bo'lmasin).

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN "acceptOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN "acceptOtpAttempts" INTEGER NOT NULL DEFAULT 0;

-- Eski (muddatsiz) kodlar bekor: yangi kod so'raladi
UPDATE "Delivery" SET "acceptOtpHash" = NULL WHERE "acceptOtpHash" IS NOT NULL;

-- Takror baholar bo'lsa — eng eskisi qoladi (unique qo'yilishi uchun)
DELETE FROM "Review" r USING "Review" r2
WHERE r."authorUserId" = r2."authorUserId" AND r."workOrderId" IS NOT NULL AND r."workOrderId" = r2."workOrderId" AND r."createdAt" > r2."createdAt";
DELETE FROM "Review" r USING "Review" r2
WHERE r."authorUserId" = r2."authorUserId" AND r."shipmentId" IS NOT NULL AND r."shipmentId" = r2."shipmentId" AND r."createdAt" > r2."createdAt";

-- CreateIndex
CREATE UNIQUE INDEX "Review_authorUserId_workOrderId_key" ON "Review"("authorUserId", "workOrderId");
CREATE UNIQUE INDEX "Review_authorUserId_shipmentId_key" ON "Review"("authorUserId", "shipmentId");

-- Ombor: zaxira endi so'rov TASDIQLANGANDA ayiriladi (ilgari qabulda). Yo'ldagi yuklar (tasdiqlangan, hali qabul
-- qilinmagan) uchun bir martalik yarashtirish — ular uchun zaxira hali ayirilmagan edi.
UPDATE "InventoryItem" i
SET "quantity" = i."quantity" - s."quantity"
FROM "Shipment" s
JOIN "MaterialRequest" r ON r."id" = s."materialRequestId"
WHERE i."warehouseId" = s."warehouseId" AND i."materialId" = r."materialId"
  AND s."status" IN ('NEW', 'ACCEPTED', 'LOADING', 'EN_ROUTE', 'DELIVERED');
