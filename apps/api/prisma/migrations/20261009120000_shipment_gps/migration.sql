-- Yuk (Shipment) reysining GPS izi: xaritada bosib o'tilgan yo'l, km va vaqt shundan.

-- CreateTable
CREATE TABLE "ShipmentGpsPoint" (
    "id" BIGSERIAL NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speedKmh" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "at" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentGpsPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentGpsPoint_shipmentId_at_idx" ON "ShipmentGpsPoint"("shipmentId", "at");

-- AddForeignKey
ALTER TABLE "ShipmentGpsPoint" ADD CONSTRAINT "ShipmentGpsPoint_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
