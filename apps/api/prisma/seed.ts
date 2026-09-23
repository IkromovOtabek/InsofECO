import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('123456'); // demo parol
  const plant = await prisma.organization.upsert({
    where: { inn: '300000001' },
    create: { type: 'PLANT', name: 'Insof ECO beton zavodi', inn: '300000001', address: 'Namangan viloyati' },
    update: {},
  });
  const contractor = await prisma.organization.upsert({
    where: { inn: '300000002' },
    create: { type: 'CONTRACTOR', name: 'Qishloq Qurilish MCHJ', inn: '300000002' },
    update: {},
  });

  const mk = async (phone: string, fullName: string, orgId: string, role: 'TADBIRKOR' | 'QURUVCHI' | 'HAYDOVCHI') => {
    const u = await prisma.user.upsert({ where: { phone }, create: { phone, fullName, passwordHash }, update: { fullName, passwordHash } });
    await prisma.membership.upsert({
      where: { userId_organizationId_role: { userId: u.id, organizationId: orgId, role } },
      create: { userId: u.id, organizationId: orgId, role },
      update: {},
    });
    if (role === 'HAYDOVCHI') await prisma.driverProfile.upsert({ where: { userId: u.id }, create: { userId: u.id }, update: {} });
    return u;
  };
  await mk('+998901110001', 'Otabek Ikromov', plant.id, 'TADBIRKOR');
  await mk('+998901110002', 'Sardor Prorab', contractor.id, 'QURUVCHI');
  await mk('+998901110003', 'Bahodir Haydovchi', plant.id, 'HAYDOVCHI');
  await mk('+998901110004', 'Jasur Haydovchi', plant.id, 'HAYDOVCHI');

  const mixes = [
    ['M100', 'M100 B7.5 P3', 520_000],
    ['M150', 'M150 B12.5 P3', 560_000],
    ['M200', 'M200 B15 P3', 600_000],
    ['M250', 'M250 B20 P3', 650_000],
    ['M300', 'M300 B22.5 P3', 700_000],
    ['M350', 'M350 B25 P3', 760_000],
    ['M400', 'M400 B30 P3', 830_000],
  ] as const;
  for (const [grade, name, unitPrice] of mixes) {
    const exists = await prisma.concreteMix.findFirst({ where: { organizationId: plant.id, grade } });
    if (!exists) await prisma.concreteMix.create({ data: { organizationId: plant.id, grade, name, slump: 'P3', unitPrice } });
  }

  for (const [plateNumber, capacityM3] of [['60 A 123 AA', 8], ['60 B 456 BB', 10], ['60 C 789 CC', 7]] as const) {
    await prisma.vehicle.upsert({
      where: { organizationId_plateNumber: { organizationId: plant.id, plateNumber } },
      create: { organizationId: plant.id, plateNumber, capacityM3 },
      update: {},
    });
  }

  await prisma.creditLimit.upsert({
    where: { plantOrgId_clientOrgId: { plantOrgId: plant.id, clientOrgId: contractor.id } },
    create: { plantOrgId: plant.id, clientOrgId: contractor.id, limitAmount: 50_000_000 },
    update: {},
  });

  const siteExists = await prisma.constructionSite.findFirst({ where: { organizationId: contractor.id } });
  if (!siteExists) {
    await prisma.constructionSite.create({
      data: {
        organizationId: contractor.id, name: 'Chortoq — 12 xonadonli uy', address: 'Chortoq tumani, Navbahor MFY', lat: 41.0689, lng: 71.8232,
        stages: { create: ['Poydevor', 'Devor', 'Tom', 'Pardoz'].map((name, order) => ({ name, order })) },
      },
    });
  }
  console.log('Seed OK');
}

main().finally(() => prisma.$disconnect());
