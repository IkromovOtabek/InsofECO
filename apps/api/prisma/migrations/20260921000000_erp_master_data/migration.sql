-- Insof ERP master-data kalitlari.
-- ERP — mijoz, marka va xomashyo kartalarining manbai. Bu ustunlar ERP yozuvi id'sini
-- saqlaydi, shuning uchun ERP'da nom yoki INN o'zgarsa ham ECO'da dublikat yaratilmaydi.
-- Faqat qo'shiladi: mavjud ustunlar va ma'lumotlarga tegilmaydi.

ALTER TABLE "Organization" ADD COLUMN "externalRef" TEXT;
CREATE UNIQUE INDEX "Organization_externalRef_key" ON "Organization"("externalRef");

ALTER TABLE "Material" ADD COLUMN "externalRef" TEXT;
CREATE UNIQUE INDEX "Material_organizationId_externalRef_key" ON "Material"("organizationId", "externalRef");
