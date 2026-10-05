/**
 * Superadmin huquqini berish / olish — faqat serverda, bazaga to'g'ridan-to'g'ri kirish bilan.
 * API orqali superadmin yaratib bo'lmaydi (backdoor parol, maxfiy endpoint yo'q).
 *
 *   yarn workspace @insof/api superadmin +998901234567            # berish
 *   yarn workspace @insof/api superadmin --revoke +998901234567   # olish (seanslar ham yopiladi)
 *   yarn workspace @insof/api superadmin --list                   # ro'yxat
 *   SUPERADMIN_PHONES=+998901234567,+998935554433 yarn workspace @insof/api superadmin   # env'dagilarni berish
 *
 * (yoki: yarn workspace @insof/api ts-node scripts/grant-superadmin.ts +998…)
 *
 * Hisob yo'q bo'lsa parolsiz yaratiladi — egasi ilovaga Telegram kodi bilan kiradi.
 * Superadmin hech qaysi tashkilotga bog'lanmaydi va ularning ro'yxatlarida ko'rinmaydi.
 *
 * Ikkinchi qulf: API muhitida `SUPERADMIN_PHONES` berilsa, SuperAdminGuard bayroqdan tashqari
 * raqamni ham shu ro'yxat bilan solishtiradi — bazadagi bayroqning o'zi yetarli bo'lmaydi.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PHONE = /^\+998\d{9}$/;
const norm = (s: string) => s.replace(/[\s\-()]/g, '');

async function grant(phone: string) {
  const user = await prisma.user.upsert({ where: { phone }, create: { phone }, update: {} });
  if (user.deletedAt) throw new Error(`${phone}: hisob o'chirilgan`);
  await prisma.user.update({ where: { id: user.id }, data: { isSuperAdmin: true, blockedAt: null, blockedReason: null } });
  const memberships = await prisma.membership.count({ where: { userId: user.id, isActive: true } });
  console.log(`✓ ${phone} — superadmin (id ${user.id})`);
  if (memberships) console.log(`  ! ${memberships} ta faol a'zoligi bor: ular saqlanadi, lekin tashkilot ro'yxatlarida bu hisob endi ko'rinmaydi.`);
}

async function revoke(phone: string) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user?.isSuperAdmin) { console.log(`- ${phone}: superadmin emas`); return; }
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { isSuperAdmin: false, tokensValidAfter: now } }),
    prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } }),
  ]);
  console.log(`✓ ${phone} — superadmin huquqi olindi, seanslar yopildi`);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  if (args.includes('--list')) {
    const rows = await prisma.user.findMany({ where: { isSuperAdmin: true }, select: { id: true, phone: true, fullName: true, blockedAt: true, createdAt: true } });
    if (!rows.length) console.log('Superadmin yo\'q');
    for (const r of rows) console.log(`${r.phone}\t${r.fullName ?? '—'}\t${r.id}${r.blockedAt ? '\t(bloklangan)' : ''}`);
    return;
  }
  const isRevoke = args.includes('--revoke');
  let phones = args.filter((a) => !a.startsWith('--')).map(norm);
  if (!phones.length && !isRevoke) phones = (process.env.SUPERADMIN_PHONES ?? '').split(',').map(norm).filter(Boolean);
  if (!phones.length) {
    console.error('Raqam bering: grant-superadmin.ts +998901234567  (yoki SUPERADMIN_PHONES env)');
    process.exitCode = 1;
    return;
  }
  const bad = phones.filter((p) => !PHONE.test(p));
  if (bad.length) {
    console.error(`Noto'g'ri raqam: ${bad.join(', ')} — +998XXXXXXXXX ko'rinishida bo'lsin`);
    process.exitCode = 1;
    return;
  }
  for (const p of phones) await (isRevoke ? revoke(p) : grant(p));
}

main()
  .catch((e: unknown) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
