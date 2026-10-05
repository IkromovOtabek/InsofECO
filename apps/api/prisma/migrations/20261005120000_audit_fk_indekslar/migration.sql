-- Tez-tez filtrlanadigan tashqi kalitlar uchun indekslar (Postgres FK uchun o'zi indeks yaratmaydi).
-- Buyurtma/schyot kartochkasi (items, lines, payments), loyiha sahifasi (ish buyurtmalari, yuklar,
-- material so'rovlari), suhbatlar ro'yxati (participants.some.userId) va kredit limiti so'rovlari.

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");
CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX IF NOT EXISTS "CreditLimit_clientOrgId_idx" ON "CreditLimit"("clientOrgId");
CREATE INDEX IF NOT EXISTS "WorkOrder_projectId_idx" ON "WorkOrder"("projectId");
CREATE INDEX IF NOT EXISTS "Shipment_projectId_idx" ON "Shipment"("projectId");
CREATE INDEX IF NOT EXISTS "MaterialRequest_projectId_idx" ON "MaterialRequest"("projectId");
CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");
CREATE INDEX IF NOT EXISTS "ProjectMember_userId_idx" ON "ProjectMember"("userId");
