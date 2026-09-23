/**
 * Zavod (PLANT) tashkilotini yaratish — prodda `db:seed` o'rniga.
 *
 *   yarn workspace @insof/api plant:create -- --inn 123456789 --name "Insof beton zavodi" [--address "..."]
 *
 * Nega alohida skript: `db:seed` demo ma'lumot yaratadi — `123456` parolli sinov
 * foydalanuvchilari bilan. Prodda ular haqiqiy kirish huquqiga ega bo'lib qolardi.
 * Bu yerda esa faqat tashkilotning o'zi yaratiladi, hech qanday hisob ochilmaydi.
 *
 * Tashkilot bo'lgach, ERP uchun integratsiya kaliti olinadi:
 *   yarn workspace @insof/api integration:create -- --org <INN> --webhook https://insof-erp.uz/api/eco/webhook
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const inn = arg('inn');
  const name = arg('name');
  const address = arg('address');
  if (!inn || !name) throw new Error('--inn va --name kerak. Masalan: --inn 123456789 --name "Insof beton zavodi"');

  const org = await prisma.organization.upsert({
    where: { inn },
    create: { type: 'PLANT', name, inn, address },
    update: { name, ...(address ? { address } : {}) },
  });
  console.log(`✓ Zavod tayyor: ${org.name} · INN ${org.inn} · id ${org.id}`);
  console.log(`\nKeyingi qadam — ERP uchun kalit:`);
  console.log(`  yarn workspace @insof/api integration:create -- --org ${org.inn} --webhook https://insof-erp.uz/api/eco/webhook`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
