-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "externalRef" TEXT;

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "externalRef" TEXT;

-- CreateTable
CREATE TABLE "IntegrationClient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationClient_keyHash_key" ON "IntegrationClient"("keyHash");

-- CreateIndex
CREATE INDEX "IntegrationClient_organizationId_idx" ON "IntegrationClient"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_plantOrgId_externalRef_key" ON "Order"("plantOrgId", "externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_externalRef_key" ON "Delivery"("externalRef");

-- AddForeignKey
ALTER TABLE "IntegrationClient" ADD CONSTRAINT "IntegrationClient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationClient" ADD CONSTRAINT "IntegrationClient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

