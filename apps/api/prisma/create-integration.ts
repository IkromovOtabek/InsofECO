/**
 * Tashqi tizim (Insof ERP) uchun integratsiya kaliti yaratish.
 *
 *   yarn workspace @insof/api integration:create -- --org 300000001 [--name "Insof ERP"] [--webhook http://erp:3000/api/eco/webhook]
 *
 * --org      zavod (PLANT) INN yoki id
 * --name     integratsiya nomi (standart "Insof ERP"). Shu nomdagi eski kalit o'chiriladi (rotatsiya).
 * --webhook  ERP webhook manzili — reys holati o'zgarganda ECO shu yerga POST qiladi
 *
 * Natija: API kalit va webhook siri BIR MARTA chop etiladi — bazada faqat sha256 xeshi saqlanadi.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function arg(name: string, def?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

async function main() {
  const orgKey = arg('org');
  const name = arg('name', 'Insof ERP')!;
  const webhookUrl = arg('webhook');
  if (!orgKey) throw new Error('--org <INN yoki id> kerak');

  const org = await prisma.organization.findFirst({ where: { type: 'PLANT', deletedAt: null, OR: [{ inn: orgKey }, { id: orgKey }] } });
  if (!org) throw new Error(`Zavod topilmadi: ${orgKey}`);

  // Xizmat foydalanuvchisi: ilovaga kira olmaydi (telefon emas), lekin TADBIRKOR a'zoligi bor —
  // reys hodisalarida "Insof ERP" nomi ko'rinadi.
  const phone = `integration:${org.id}:${name.toLowerCase().replace(/\s+/g, '-')}`;
  const user = await prisma.user.upsert({ where: { phone }, create: { phone, fullName: `${name} (integratsiya)` }, update: { fullName: `${name} (integratsiya)` } });
  await prisma.membership.upsert({
    where: { userId_organizationId_role: { userId: user.id, organizationId: org.id, role: 'TADBIRKOR' } },
    create: { userId: user.id, organizationId: org.id, role: 'TADBIRKOR' },
    update: { isActive: true },
  });

  const apiKey = `eco_${randomBytes(24).toString('hex')}`;
  const webhookSecret = randomBytes(24).toString('hex');
  const rotated = await prisma.integrationClient.updateMany({ where: { organizationId: org.id, name, isActive: true }, data: { isActive: false } });
  const client = await prisma.integrationClient.create({
    data: { organizationId: org.id, userId: user.id, name, keyPrefix: apiKey.slice(0, 12), keyHash: createHash('sha256').update(apiKey).digest('hex'), webhookUrl, webhookSecret },
  });

  console.log(`\nIntegratsiya yaratildi: ${name} → ${org.name}${rotated.count ? ` (eski ${rotated.count} ta kalit o'chirildi)` : ''}`);
  console.log(`Client id: ${client.id}`);
  console.log(`\nERP .env ga qo'ying (kalit qayta ko'rsatilmaydi):\n`);
  console.log(`ECO_API_URL="http://localhost:${process.env.PORT ?? 3010}"`);
  console.log(`ECO_API_KEY="${apiKey}"`);
  console.log(`ECO_WEBHOOK_SECRET="${webhookSecret}"`);
  if (!webhookUrl) console.log(`\nEslatma: --webhook berilmadi — haydovchi harakatlari ERP'ga avtomatik yetib bormaydi.`);
  else console.log(`\nWebhook: ${webhookUrl}`);
}

main().finally(() => prisma.$disconnect());
