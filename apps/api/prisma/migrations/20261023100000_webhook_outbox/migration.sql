-- ERP webhook navbati: hodisa bazaga yoziladi, fon ishchisi yuboradi va qayta uradi (API qayta ishga tushsa ham yo'qolmaydi).

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "WebhookOutbox" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastStatus" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "WebhookOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookOutbox_status_nextAttemptAt_idx" ON "WebhookOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WebhookOutbox_clientId_status_createdAt_idx" ON "WebhookOutbox"("clientId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "WebhookOutbox" ADD CONSTRAINT "WebhookOutbox_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "IntegrationClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

