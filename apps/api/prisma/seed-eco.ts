/**
 * ECO System sun'iy ma'lumotlari. Idempotent: mavjud bo'lsa o'tkazib yuboradi (loyiha nomi bo'yicha).
 * Ishga tushirish: npx ts-node prisma/seed-eco.ts  (seed.ts dan keyin)
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const D = Prisma.Decimal;
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(arr: readonly T[]) => arr[rnd(0, arr.length - 1)]!;
const daysAgo = (n: number, h = 9) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d; };
const daysAhead = (n: number) => daysAgo(-n);

const FIRST = ['Otabek', 'Sardor', 'Jasur', 'Bahodir', 'Aziz', 'Dilshod', 'Farrux', 'Umid', 'Sherzod', 'Bobur', 'Rustam', 'Nodir', 'Alisher', 'Kamol', 'Shohruh', 'Ulug\'bek', 'Anvar', 'Doston', 'Islom', 'Javohir', 'Mirzo', 'Oybek', 'Ravshan', 'Temur', 'Xurshid', 'Yusuf', 'Zafar', 'Abror', 'Behzod', 'Davron'];
const LAST = ['Ikromov', 'Karimov', 'Rahimov', 'Toshmatov', 'Yusupov', 'Nazarov', 'Saidov', 'Qodirov', 'Ergashev', 'Mirzayev', 'Xolmatov', 'Tursunov', 'Abdullayev', 'Umarov', 'Sobirov'];
const SPECS = ['GISHT_TERUVCHI', 'ELEKTRIK', 'SANTEXNIK', 'PAYVANDCHI', 'BETONCHI', 'SUVOQCHI', 'BOYOQCHI', 'UNIVERSAL'] as const;

async function main() {
  const passwordHash = await argon2.hash('123456');
  const plant = await prisma.organization.findUniqueOrThrow({ where: { inn: '300000001' } }); // Insof ECO — asosiy tashkilot (Tadbirkor)
  const orgId = plant.id;
  if (await prisma.project.count({ where: { organizationId: orgId } })) { console.log('ECO seed already present — skip'); return; }

  const tadbirkor = await prisma.user.findUniqueOrThrow({ where: { phone: '+998901110001' } });

  // ───── 24 quruvchi (shu tashkilotga) ─────
  const workers: { id: string; fullName: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const phone = `+99890200${String(i + 1).padStart(4, '0')}`;
    const fullName = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
    const u = await prisma.user.upsert({ where: { phone }, create: { phone, fullName, passwordHash }, update: { fullName } });
    await prisma.membership.upsert({ where: { userId_organizationId_role: { userId: u.id, organizationId: orgId, role: 'QURUVCHI' } }, create: { userId: u.id, organizationId: orgId, role: 'QURUVCHI' }, update: { isActive: true } });
    await prisma.workerProfile.upsert({ where: { userId: u.id }, create: { userId: u.id, specialty: SPECS[i % SPECS.length], experienceYears: rnd(1, 18), dailyRate: 150_000 + rnd(0, 20) * 10_000, ratingAvg: +(3.8 + Math.random() * 1.2).toFixed(1), ratingCount: rnd(3, 40), completedJobs: rnd(5, 60), bio: 'Sifatli va o\'z vaqtida.' }, update: {} });
    workers.push({ id: u.id, fullName });
  }
  // Seed quruvchi (+998901110002) ham shu tashkilotga a'zo bo'lsin — demo uchun
  const demoWorker = await prisma.user.findUniqueOrThrow({ where: { phone: '+998901110002' } });
  await prisma.membership.upsert({ where: { userId_organizationId_role: { userId: demoWorker.id, organizationId: orgId, role: 'QURUVCHI' } }, create: { userId: demoWorker.id, organizationId: orgId, role: 'QURUVCHI' }, update: { isActive: true } });
  await prisma.workerProfile.upsert({ where: { userId: demoWorker.id }, create: { userId: demoWorker.id, specialty: 'UNIVERSAL', experienceYears: 9, dailyRate: 250_000, ratingAvg: 4.8, ratingCount: 27, completedJobs: 27 }, update: {} });
  workers.unshift({ id: demoWorker.id, fullName: demoWorker.fullName ?? 'Sardor Prorab' });

  // ───── 6 haydovchi + transport ─────
  const drivers: { id: string; fullName: string }[] = [];
  const demoDriver = await prisma.user.findUniqueOrThrow({ where: { phone: '+998901110003' } });
  drivers.push({ id: demoDriver.id, fullName: demoDriver.fullName ?? 'Bahodir Haydovchi' });
  for (let i = 0; i < 5; i++) {
    const phone = `+99890300${String(i + 1).padStart(4, '0')}`;
    const fullName = `${FIRST[(i + 12) % FIRST.length]} ${LAST[(i * 3 + 1) % LAST.length]}`;
    const u = await prisma.user.upsert({ where: { phone }, create: { phone, fullName, passwordHash }, update: {} });
    await prisma.membership.upsert({ where: { userId_organizationId_role: { userId: u.id, organizationId: orgId, role: 'HAYDOVCHI' } }, create: { userId: u.id, organizationId: orgId, role: 'HAYDOVCHI' }, update: { isActive: true } });
    await prisma.driverProfile.upsert({ where: { userId: u.id }, create: { userId: u.id }, update: {} });
    drivers.push({ id: u.id, fullName });
  }
  const TRUCKS = [['DAF XF', '01 A 123 AA', 'TRUCK', 20], ['KamAZ 65115', '01 B 456 BB', 'DUMP', 15], ['Isuzu NQR', '01 C 789 CC', 'TRUCK', 5], ['MAN TGS', '01 D 321 DD', 'TRUCK', 18], ['Hyundai HD78', '01 E 654 EE', 'PICKUP', 4], ['KamAZ 5320', '01 F 987 FF', 'DUMP', 10]] as const;
  for (let i = 0; i < TRUCKS.length; i++) {
    const [brand, plate, type, tons] = TRUCKS[i]!;
    await prisma.vehicle.upsert({ where: { organizationId_plateNumber: { organizationId: orgId, plateNumber: plate } }, create: { organizationId: orgId, plateNumber: plate, brand, type, capacityM3: 0, capacityTons: tons, fuelPercent: rnd(25, 95), odometerKm: rnd(80_000, 420_000), nextServiceAt: daysAhead(rnd(5, 60)), driverUserId: drivers[i]!.id }, update: { driverUserId: drivers[i]!.id, brand, capacityTons: tons } });
  }

  // ───── Ombor + materiallar ─────
  const wh = await prisma.warehouse.create({ data: { organizationId: orgId, name: 'ECO Warehouse (Chortoq)', address: 'Chortoq tumani, Sanoat zonasi', lat: 41.0640, lng: 71.8170 } });
  const MATS: [string, string, string, number, number, number][] = [
    ['Sement M400', 'Bog\'lovchi', 'qop', 65_000, 30, 25], ['Sement M500', 'Bog\'lovchi', 'qop', 72_000, 30, 140],
    ['Armatura Ø12', 'Armatura', 'tonna', 9_800_000, 2, 6.5], ['Armatura Ø16', 'Armatura', 'tonna', 9_600_000, 2, 1.2],
    ['G\'isht (qizil)', 'Devor', 'dona', 1_100, 5000, 42_000], ['Gazoblok 600x300x200', 'Devor', 'dona', 14_500, 500, 380],
    ['Qum', 'Inert', 'm³', 120_000, 20, 85], ['Shag\'al 5-20', 'Inert', 'm³', 160_000, 20, 12],
    ['Shifer', 'Tom', 'dona', 48_000, 50, 210], ['Metall cherepitsa', 'Tom', 'm²', 95_000, 100, 640],
    ['Gips suvoq (Knauf)', 'Pardoz', 'qop', 58_000, 40, 96], ['Emulsiya bo\'yoq 10L', 'Pardoz', 'dona', 145_000, 10, 8],
    ['Kabel VVG 3x2.5', 'Elektr', 'm', 9_500, 200, 1_150], ['Polipropilen quvur Ø25', 'Santexnika', 'm', 12_000, 100, 60],
  ];
  const mats: Record<string, { id: string; unit: string; price: number }> = {};
  for (const [name, category, unit, price, minStock, qty] of MATS) {
    const m = await prisma.material.create({ data: { organizationId: orgId, name, category, unit, price, minStock } });
    await prisma.inventoryItem.create({ data: { warehouseId: wh.id, materialId: m.id, quantity: qty } });
    mats[name] = { id: m.id, unit, price };
  }

  // ───── 8 loyiha ─────
  const PROJECTS: [string, string, number, number, string, number, number, number, number][] = [
    // name, address, lat, lng, status, budget(mln), spentPct, progress, deadlineDays
    ['Toshkent Residence', 'Toshkent, Yunusobod 4-mavze', 41.3650, 69.2870, 'ACTIVE', 850, 62, 67, 120],
    ['Chortoq — 12 xonadonli uy', 'Chortoq tumani, Navbahor MFY', 41.0689, 71.8232, 'ACTIVE', 420, 48, 45, 75],
    ['Namangan Mall (karkas)', 'Namangan sh., Uychi ko\'chasi', 40.9983, 71.6726, 'ACTIVE', 2100, 31, 28, 300],
    ['Maktab №14 rekonstruksiya', 'Pop tumani', 40.8730, 71.1080, 'DELAYED', 310, 78, 60, -6],
    ['Fermer hovlisi — issiqxona', 'Uchqo\'rg\'on tumani', 41.1120, 72.0790, 'ACTIVE', 95, 40, 52, 30],
    ['Mahalla masjidi', 'To\'raqo\'rg\'on tumani', 41.0060, 71.5150, 'DELAYED', 180, 91, 82, -14],
    ['Dehqon bozori ustaxonalari', 'Chust tumani', 41.0030, 71.2370, 'ACTIVE', 260, 22, 18, 150],
    ['Xususiy hovli (Otabek aka)', 'Namangan sh., Davlatobod', 41.0120, 71.6500, 'COMPLETED', 140, 100, 100, -40],
    ['Sport zali — G\'ijduvon', 'Yangiqo\'rg\'on tumani', 41.1970, 71.7180, 'PLANNING', 520, 0, 0, 240],
    ['Suv inshooti — nasos stansiyasi', 'Kosonsoy tumani', 41.2470, 71.5470, 'ON_HOLD', 390, 12, 10, 90],
  ];
  const projects: { id: string; name: string; lat: number; lng: number; budget: number }[] = [];
  for (let i = 0; i < PROJECTS.length; i++) {
    const [name, address, lat, lng, status, budget, spentPct, progress, dl] = PROJECTS[i]!;
    const budgetV = budget * 1_000_000;
    const p = await prisma.project.create({ data: { organizationId: orgId, name, address, lat, lng, status: status as never, budget: budgetV, spent: Math.round(budgetV * spentPct / 100), progress, clientName: pick(['"Namangan Qurilish" MCHJ', 'Xususiy buyurtmachi', 'Tuman hokimligi', '"Agro Invest" MCHJ']), description: 'Loyiha bo\'yicha ishlar reja asosida olib borilmoqda.', startDate: daysAgo(rnd(30, 200)), deadline: daysAhead(dl) } });
    projects.push({ id: p.id, name, lat, lng, budget: budgetV });
    // a'zolar: 2–5 quruvchi
    const team = [workers[0]!, ...workers.slice(1).sort(() => Math.random() - 0.5).slice(0, rnd(2, 4))];
    for (const w of team) await prisma.projectMember.upsert({ where: { projectId_userId: { projectId: p.id, userId: w.id } }, create: { projectId: p.id, userId: w.id, role: 'QURUVCHI' }, update: {} });
    // vazifalar
    const TASKS = ['Poydevor qazish', 'Armatura bog\'lash', 'Beton quyish', 'Devor terish (1-qavat)', 'Devor terish (2-qavat)', 'Tom karkasi', 'Elektr montaj', 'Santexnika', 'Suvoq', 'Bo\'yoq'];
    const doneN = Math.round((progress / 100) * TASKS.length);
    for (let t = 0; t < TASKS.length; t++) {
      const st = t < doneN ? 'DONE' : t === doneN ? 'IN_PROGRESS' : t === doneN + 1 ? 'REVIEW' : 'TODO';
      await prisma.task.create({ data: { projectId: p.id, title: TASKS[t]!, status: st as never, priority: pick(['LOW', 'MEDIUM', 'HIGH']) as never, assigneeUserId: pick(team).id, dueDate: daysAhead(t * 7 - doneN * 7 + rnd(0, 3)), completedAt: st === 'DONE' ? daysAgo(rnd(1, 40)) : null, sortOrder: t, photoKeys: st === 'DONE' ? ['photo/demo.jpg'] : [] } });
    }
    // hujjatlar
    await prisma.document.createMany({ data: [{ projectId: p.id, name: 'Shartnoma.pdf', fileKey: 'docs/demo.pdf', kind: 'doc' }, { projectId: p.id, name: 'Smeta.xlsx', fileKey: 'docs/demo.xlsx', kind: 'doc' }, { projectId: p.id, name: 'Obyekt fotosi', fileKey: 'photo/demo.jpg', kind: 'photo' }] });
    // daromad: shartnoma bo'yicha olingan / kutilayotgan
    const received = Math.round(budgetV * Math.min(progress, 90) / 100 * 0.9);
    await prisma.income.create({ data: { organizationId: orgId, projectId: p.id, source: 'PROJECT', amount: received, description: `${name} — bosqichli to'lov`, date: daysAgo(rnd(2, 60)) } });
    if (status !== 'COMPLETED') await prisma.income.create({ data: { organizationId: orgId, projectId: p.id, source: 'PROJECT', amount: budgetV - received, description: `${name} — qolgan summa (shartnoma)`, date: daysAhead(dl > 0 ? dl : 10), isExpected: true } });
    // xarajatlar tarixi (6 oy)
    const CATS = ['MATERIAL', 'WORKER', 'DRIVER', 'FUEL', 'TRANSPORT', 'REPAIR', 'OTHER'] as const;
    for (let k = 0; k < 14; k++) {
      const cat = pick(CATS);
      await prisma.expense.create({ data: { organizationId: orgId, projectId: p.id, category: cat, amount: rnd(5, 120) * 100_000 * (cat === 'MATERIAL' ? 3 : 1), description: `${name}: ${({ MATERIAL: 'material xaridi', WORKER: 'ish haqi', DRIVER: 'yetkazish', FUEL: 'yoqilg\'i', TRANSPORT: 'transport', REPAIR: 'ta\'mirlash', OTHER: 'boshqa' })[cat]}`, date: daysAgo(rnd(0, 170)), createdByUserId: tadbirkor.id } });
    }
  }
  // Qo'shimcha daromad (xizmatlar/buyurtmalar)
  for (let k = 0; k < 10; k++) await prisma.income.create({ data: { organizationId: orgId, source: pick(['ORDER', 'SERVICE'] as const), amount: rnd(8, 60) * 1_000_000, description: pick(['Beton yetkazish', 'Texnika ijarasi', 'Loyihalash xizmati', 'Qurilish maslahati']), date: daysAgo(rnd(0, 170)) } });

  // ───── Ish buyurtmalari (turli holatlarda) ─────
  const WO = [
    ['Devor qurish (2-qavat)', 'Toshkent Residence', 1_500_000, 'IN_PROGRESS', 0], ['Suvoq ishlari, 120 m²', 'Chortoq — 12 xonadonli uy', 2_400_000, 'REVIEW', 0],
    ['Elektr montaj, 6 xona', 'Toshkent Residence', 3_200_000, 'WORKER_ASSIGNED', 3], ['Poydevor betoni, 18 m³', 'Dehqon bozori ustaxonalari', 2_700_000, 'ACCEPTED', -1],
    ['Tom yopish (metall cherepitsa)', 'Fermer hovlisi — issiqxona', 1_900_000, 'NEW', -1], ['Santexnika, 4 xonadon', 'Chortoq — 12 xonadonli uy', 2_100_000, 'DONE', 5],
    ['Bo\'yoq ishlari, 300 m²', 'Xususiy hovli (Otabek aka)', 1_200_000, 'PAID', 0], ['Payvandlash — karkas', 'Namangan Mall (karkas)', 4_500_000, 'PAID', 7],
    ['G\'isht terish, 40 m³', 'Mahalla masjidi', 3_600_000, 'DONE', 9], ['Gazoblok devor', 'Maktab №14 rekonstruksiya', 2_200_000, 'IN_PROGRESS', 11],
    ['Armatura bog\'lash', 'Namangan Mall (karkas)', 1_800_000, 'NEW', -1], ['Pol quyish, 200 m²', 'Sport zali — G\'ijduvon', 2_900_000, 'CANCELLED', 4],
  ] as const;
  for (const [title, pname, price, status, wi] of WO) {
    const p = projects.find((x) => x.name === pname)!;
    const worker = wi >= 0 ? workers[wi]! : null;
    const created = daysAgo(rnd(3, 30));
    const wo = await prisma.workOrder.create({ data: { organizationId: orgId, projectId: p.id, title, description: 'Texnik topshiriq bo\'yicha, sifat nazorati bilan.', address: PROJECTS.find((x) => x[0] === pname)![1], price, deadline: daysAhead(rnd(-3, 20)), status: status as never, workerUserId: worker?.id ?? null, createdByUserId: tadbirkor.id, createdAt: created, acceptedAt: status !== 'NEW' ? created : null, startedAt: ['IN_PROGRESS', 'REVIEW', 'DONE', 'PAID'].includes(status) ? created : null, submittedAt: ['REVIEW', 'DONE', 'PAID'].includes(status) ? daysAgo(rnd(1, 3)) : null, completedAt: ['DONE', 'PAID'].includes(status) ? daysAgo(rnd(0, 2)) : null, paidAt: status === 'PAID' ? daysAgo(0) : null, photoKeys: ['REVIEW', 'DONE', 'PAID'].includes(status) ? ['photo/demo.jpg'] : [], workerComment: ['REVIEW', 'DONE', 'PAID'].includes(status) ? 'Ish sifatli bajarildi, foto biriktirildi.' : null } });
    if (worker && ['DONE', 'PAID'].includes(status)) {
      await prisma.payout.create({ data: { organizationId: orgId, userId: worker.id, workOrderId: wo.id, amount: price, status: status === 'PAID' ? 'PAID' : 'PENDING', description: `№${wo.number} ${title}`, earnedAt: daysAgo(rnd(0, 20)), paidAt: status === 'PAID' ? daysAgo(0) : null } });
      await prisma.review.create({ data: { organizationId: orgId, targetUserId: worker.id, authorUserId: tadbirkor.id, workOrderId: wo.id, scoreOverall: rnd(4, 5), comment: pick(['Sifatli', 'O\'z vaqtida topshirdi', 'Yaxshi ishladi']) } });
    }
  }
  // Demo quruvchi uchun tarixiy payoutlar (Daromad sahifasi)
  for (let k = 0; k < 8; k++) await prisma.payout.create({ data: { organizationId: orgId, userId: demoWorker.id, amount: rnd(4, 15) * 100_000, status: k < 6 ? 'PAID' : 'PENDING', description: pick(['Devor terish', 'Suvoq', 'Beton quyish', 'Armatura']), earnedAt: daysAgo(k * 3, 17), paidAt: k < 6 ? daysAgo(k * 3 - 1) : null } });

  // ───── Material so'rovlari + yuklar ─────
  const MR = [
    ['Sement M400', 'Toshkent Residence', 20, 'PENDING'], ['Armatura Ø16', 'Namangan Mall (karkas)', 1.5, 'PENDING'],
    ['Gazoblok 600x300x200', 'Maktab №14 rekonstruksiya', 120, 'APPROVED'], ['Qum', 'Chortoq — 12 xonadonli uy', 10, 'LOADING'],
    ['Sement M500', 'Chortoq — 12 xonadonli uy', 50, 'DELIVERED'], ['Metall cherepitsa', 'Fermer hovlisi — issiqxona', 80, 'CONFIRMED'],
    ['G\'isht (qizil)', 'Mahalla masjidi', 6000, 'CONFIRMED'], ['Gips suvoq (Knauf)', 'Toshkent Residence', 15, 'REJECTED'],
    ['Kabel VVG 3x2.5', 'Toshkent Residence', 300, 'CONFIRMED'],
  ] as const;
  const SH_STATUS: Record<string, string> = { APPROVED: 'NEW', LOADING: 'LOADING', DELIVERED: 'DELIVERED', CONFIRMED: 'CONFIRMED' };
  for (let i = 0; i < MR.length; i++) {
    const [mname, pname, qty, status] = MR[i]!;
    const m = mats[mname]!; const p = projects.find((x) => x.name === pname)!;
    const req = await prisma.materialRequest.create({ data: { organizationId: orgId, projectId: p.id, materialId: m.id, quantity: qty, reason: pick(['Poydevor', 'Devor', 'Tom', 'Pardoz', 'Elektr']), status: status as never, requestedByUserId: demoWorker.id, decidedByUserId: status === 'PENDING' ? null : tadbirkor.id, decidedAt: status === 'PENDING' ? null : daysAgo(rnd(1, 5)), rejectReason: status === 'REJECTED' ? 'Bu oy byudjet tugagan, keyingi haftaga' : null, createdAt: daysAgo(rnd(1, 7)) } });
    if (SH_STATUS[status]) {
      const shStatus = SH_STATUS[status]!;
      const driver = shStatus === 'NEW' ? null : drivers[i % drivers.length]!;
      const vehicle = driver ? await prisma.vehicle.findFirst({ where: { driverUserId: driver.id } }) : null;
      const dist = +(Math.hypot((p.lat - 41.064) * 111, (p.lng - 71.817) * 85)).toFixed(1);
      const sh = await prisma.shipment.create({ data: { organizationId: orgId, materialRequestId: req.id, projectId: p.id, warehouseId: wh.id, driverUserId: driver?.id, vehicleId: vehicle?.id, status: shStatus as never, cargo: `${mname} — ${qty} ${m.unit}`, quantity: qty, unit: m.unit, distanceKm: dist, driverFee: Math.round(dist * 15_000) + 100_000, acceptedAt: driver ? daysAgo(1) : null, loadedAt: ['LOADING', 'EN_ROUTE', 'DELIVERED', 'CONFIRMED'].includes(shStatus) ? daysAgo(1, 10) : null, departedAt: ['EN_ROUTE', 'DELIVERED', 'CONFIRMED'].includes(shStatus) ? daysAgo(1, 11) : null, deliveredAt: ['DELIVERED', 'CONFIRMED'].includes(shStatus) ? daysAgo(1, 13) : null, confirmedAt: shStatus === 'CONFIRMED' ? daysAgo(1, 14) : null, receiverName: shStatus === 'CONFIRMED' ? demoWorker.fullName : null, photoKey: ['DELIVERED', 'CONFIRMED'].includes(shStatus) ? 'photo/demo.jpg' : null } });
      if (driver && shStatus === 'CONFIRMED') await prisma.payout.create({ data: { organizationId: orgId, userId: driver.id, shipmentId: sh.id, amount: sh.driverFee, status: 'PAID', description: `Yuk №${sh.number}: ${sh.cargo}`, earnedAt: daysAgo(1, 14), paidAt: daysAgo(0) } });
    }
  }
  // Demo haydovchi: bugungi 3 yuk (2 bajarilgan, 1 kutilmoqda) + tarix
  const demoVehicle = await prisma.vehicle.findFirst({ where: { driverUserId: demoDriver.id } });
  const todayCargo = [['Sement M500 — 50 qop', 50, 'qop', 'CONFIRMED', 'Toshkent Residence'], ['Armatura Ø12 — 2 tonna', 2, 'tonna', 'DELIVERED', 'Namangan Mall (karkas)'], ['Shag\'al 5-20 — 8 m³', 8, 'm³', 'ACCEPTED', 'Chortoq — 12 xonadonli uy']] as const;
  for (const [cargo, qty, unit, st, pname] of todayCargo) {
    const p = projects.find((x) => x.name === pname)!;
    const dist = +(Math.hypot((p.lat - 41.064) * 111, (p.lng - 71.817) * 85)).toFixed(1);
    const sh = await prisma.shipment.create({ data: { organizationId: orgId, projectId: p.id, warehouseId: wh.id, driverUserId: demoDriver.id, vehicleId: demoVehicle?.id, status: st as never, cargo, quantity: qty, unit, distanceKm: dist, driverFee: Math.round(dist * 15_000) + 100_000, acceptedAt: daysAgo(0, 7), loadedAt: st !== 'ACCEPTED' ? daysAgo(0, 8) : null, departedAt: st !== 'ACCEPTED' ? daysAgo(0, 9) : null, deliveredAt: st !== 'ACCEPTED' ? daysAgo(0, 10) : null, confirmedAt: st === 'CONFIRMED' ? daysAgo(0, 11) : null, receiverName: st === 'CONFIRMED' ? 'Sardor Prorab' : null } });
    if (st === 'CONFIRMED') await prisma.payout.create({ data: { organizationId: orgId, userId: demoDriver.id, shipmentId: sh.id, amount: sh.driverFee, status: 'PENDING', description: `Yuk №${sh.number}: ${cargo}`, earnedAt: daysAgo(0, 11) } });
  }
  for (let k = 1; k <= 12; k++) {
    const p = pick(projects); const cargo = pick(['Sement M400 — 40 qop', 'Qum — 12 m³', 'G\'isht — 4000 dona', 'Gazoblok — 200 dona', 'Armatura Ø16 — 1 tonna']);
    const sh = await prisma.shipment.create({ data: { organizationId: orgId, projectId: p.id, warehouseId: wh.id, driverUserId: demoDriver.id, vehicleId: demoVehicle?.id, status: 'CONFIRMED', cargo, quantity: 1, unit: 'partiya', distanceKm: rnd(5, 60), driverFee: rnd(15, 45) * 10_000, acceptedAt: daysAgo(k, 8), loadedAt: daysAgo(k, 9), departedAt: daysAgo(k, 10), deliveredAt: daysAgo(k, 12), confirmedAt: daysAgo(k, 13), receiverName: pick(workers).fullName, createdAt: daysAgo(k, 7) } });
    await prisma.payout.create({ data: { organizationId: orgId, userId: demoDriver.id, shipmentId: sh.id, amount: sh.driverFee, status: k > 2 ? 'PAID' : 'PENDING', description: `Yuk №${sh.number}: ${cargo}`, earnedAt: daysAgo(k, 13), paidAt: k > 2 ? daysAgo(k - 1) : null } });
    await prisma.review.create({ data: { organizationId: orgId, targetUserId: demoDriver.id, authorUserId: tadbirkor.id, shipmentId: sh.id, scoreOverall: rnd(4, 5), scoreTime: rnd(4, 5), scoreManner: 5, comment: pick(['Tez yetkazdi', 'Ehtiyotkor', 'Muomalasi yaxshi']) } });
  }

  // ───── Xabarlar ─────
  const mkConv = async (type: 'DIRECT' | 'GROUP' | 'PROJECT', ids: string[], title?: string, projectId?: string, msgs: [string, string][] = []) => {
    const c = await prisma.conversation.create({ data: { organizationId: orgId, type, title, projectId, participants: { create: ids.map((userId) => ({ userId })) } } });
    let t = 0;
    for (const [sender, text] of msgs) { t++; await prisma.message.create({ data: { conversationId: c.id, senderId: sender, text, createdAt: daysAgo(0, 8 + t) } }); }
    await prisma.conversation.update({ where: { id: c.id }, data: { lastMessageAt: daysAgo(0, 8 + t) } });
  };
  await mkConv('DIRECT', [tadbirkor.id, demoWorker.id], undefined, undefined, [[demoWorker.id, 'Assalomu alaykum, Toshkent Residence uchun 20 qop sement kerak bo\'lyapti.'], [tadbirkor.id, 'Vaalaykum assalom. So\'rov yuboring, bugun tasdiqlayman.'], [demoWorker.id, 'Yubordim, rahmat 👍']]);
  await mkConv('DIRECT', [tadbirkor.id, demoDriver.id], undefined, undefined, [[tadbirkor.id, 'Bahodir aka, Chortoqqa shag\'al bor, 10:00 da yuklang.'], [demoDriver.id, 'Xo\'p, yo\'ldaman.']]);
  await mkConv('PROJECT', [tadbirkor.id, demoWorker.id, workers[1]!.id, workers[2]!.id, demoDriver.id], 'Toshkent Residence', projects[0]!.id, [[tadbirkor.id, 'Bugun 2-qavat devorini yakunlaymiz, ertaga tekshiruv.'], [workers[1]!.id, 'Tushunarli.'], [demoDriver.id, 'Sement 11:30 da obyektda bo\'ladi.']]);
  await mkConv('GROUP', [tadbirkor.id, ...workers.slice(0, 6).map((w) => w.id)], 'Quruvchilar guruhi', undefined, [[tadbirkor.id, 'Diqqat: juma kuni ish haqi to\'lanadi. Kartalarni yangilang.']]);

  // ───── Bildirishnomalar ─────
  await prisma.notification.createMany({ data: [
    { userId: tadbirkor.id, type: 'MATERIAL_REQUEST', title: '👷 Quruvchi yangi material so\'rovini yubordi', body: 'Sement M400 — 20 qop · Toshkent Residence', data: {} },
    { userId: tadbirkor.id, type: 'SHIPMENT_DELIVERED', title: '🚚 Haydovchi yukni yetkazib berdi', body: 'Armatura Ø12 — 2 tonna · Namangan Mall', data: {} },
    { userId: tadbirkor.id, type: 'PROJECT_DEADLINE', title: '⚠️ Loyiha muddati yaqinlashmoqda', body: 'Mahalla masjidi — 14 kun kechikmoqda', data: {} },
    { userId: tadbirkor.id, type: 'EXPENSE', title: '💰 5 000 000 so\'mlik xarajat kiritildi', body: 'Toshkent Residence: material xaridi', data: {} },
    { userId: tadbirkor.id, type: 'WORK_ORDER_REVIEW', title: '👷 Quruvchi ishni tugatdi', body: 'Suvoq ishlari, 120 m² — tekshiruvga yuborildi', data: {} },
    { userId: demoWorker.id, type: 'WORK_ORDER_ASSIGNED', title: '🔨 Yangi ish buyurtmasi', body: 'Devor qurish (2-qavat) — 1 500 000 so\'m', data: {} },
    { userId: demoWorker.id, type: 'SHIPMENT_DELIVERED', title: '📦 Yuk yetkazildi — tasdiqlang', body: 'Sement M500 — 50 qop', data: {} },
    { userId: demoDriver.id, type: 'SHIPMENT_ASSIGNED', title: '🚚 Yangi yuk', body: 'Shag\'al 5-20 — 8 m³ · Chortoq', data: {} },
  ] });

  console.log(`ECO seed OK: ${projects.length} loyiha, ${workers.length} quruvchi, ${drivers.length} haydovchi, ${MATS.length} material`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
