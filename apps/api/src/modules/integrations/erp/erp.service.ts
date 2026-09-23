import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { ACTIVE_DELIVERY_STATUSES, DeliveryStatus, OrderStatus } from '@insof/shared';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { DomainError } from '../../../common/errors/domain.error';
import { AuthContext } from '../../../common/auth/decorators';
import { DeliveriesService } from '../../deliveries/deliveries.service';
import { OrganizationsService } from '../../organizations/organizations.service';
import { TrackingService, trackStats } from '../../tracking/tracking.service';
import { ErpCustomerInput, ErpInvoiceInput, ErpMaterialInput, ErpMixInput, ErpOrderInput, ErpPaymentInput, ErpTripInput, ErpTripStatusInput } from './erp.schemas';

const D = Prisma.Decimal;

/** Oldinga yurish tartibi — ERP "Yuklandi"/"Yo'lga chiqdi"/"Yetkazildi" bosganda oraliq holatlar avtomatik o'tiladi. */
const FORWARD: DeliveryStatus[] = ['ASSIGNED', 'ACCEPTED', 'LOADING', 'EN_ROUTE', 'ARRIVED', 'UNLOADING', 'COMPLETED'];

/** ERP zayavka holati → ECO buyurtma holati. ECO ERP'ga moslashadi, teskarisi emas. */
const ORDER_STATUS: Record<string, OrderStatus> = {
  DRAFT: 'DRAFT',
  BLOCKED: 'SUBMITTED', // kredit limiti oshgan — ERP'da direktor ochishi kerak
  CONFIRMED: 'SCHEDULED',
  IN_PRODUCTION: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  CLOSED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

/** ERP schyot holati → ECO schyot holati. */
const INVOICE_STATUS: Record<string, InvoiceStatus> = {
  OPEN: 'OPEN',
  PARTIAL: 'PARTIALLY_PAID',
  PAID: 'PAID',
  CANCELLED: 'VOID',
};

/**
 * Insof ERP ↔ Insof ECO ko'prigi (zavod tomoni).
 * ERP — buxgalteriya/sklad/nakladnoy manbai; ECO — haydovchi ilovasi (qabul, GPS, imzo).
 * Kalit: Delivery.externalRef = ERP nakladnoy raqami, Order.externalRef = ERP zayavka raqami.
 */
@Injectable()
export class ErpService {
  private readonly logger = new Logger(ErpService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveries: DeliveriesService,
    private readonly orgs: OrganizationsService,
    private readonly tracking: TrackingService,
    private readonly events: EventEmitter2,
  ) {}

  private readonly include = {
    order: { select: { id: true, number: true, externalRef: true, address: true, status: true, plantOrgId: true, client: { select: { id: true, name: true } } } },
    driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
    vehicle: { select: { id: true, plateNumber: true, capacityM3: true } },
    events: { orderBy: { receivedAt: 'asc' as const }, select: { from: true, to: true, at: true, receivedAt: true, note: true, lat: true, lng: true, byRole: true } },
  } satisfies Prisma.DeliveryInclude;

  async ping(a: AuthContext) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: a.orgId! }, select: { id: true, name: true, inn: true } });
    return { ok: true, client: a.integration!.name, organization: org, serverTime: new Date().toISOString() };
  }

  // ───────── spravochniklar ─────────

  async drivers(a: AuthContext) {
    const members = await this.prisma.membership.findMany({
      where: { organizationId: a.orgId!, role: 'HAYDOVCHI' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true, fullName: true, phone: true, updatedAt: true,
            driverProfile: { select: { isAvailable: true, deliveries: { where: { status: { in: ACTIVE_DELIVERY_STATUSES as DeliveryStatus[] } }, select: { id: true, externalRef: true, status: true } } } },
          },
        },
      },
    });
    return members.map((m) => ({
      userId: m.user.id,
      membershipId: m.id,
      fullName: m.user.fullName,
      phone: m.user.phone,
      /** Tadbirkor/ERP tasdiqlagan (ilovaga kira oladi) */
      isActive: m.isActive,
      /** true — ERP/Tadbirkor taklifi bilan; false — ilovada zavodni tanlab o'zi ro'yxatdan o'tgan */
      invitedByPhone: m.invitedByPhone,
      registeredAt: m.createdAt,
      profileUpdatedAt: m.user.updatedAt,
      isAvailable: m.user.driverProfile?.isAvailable ?? true,
      activeDelivery: m.user.driverProfile?.deliveries[0] ?? null,
    }));
  }

  /** ERP xodimi (Haydovchi) → ECO foydalanuvchi + HAYDOVCHI a'zolik + DriverProfile. Telefon — yagona kalit. */
  async upsertDriver(a: AuthContext, input: { phone: string; fullName: string }) {
    const m = await this.orgs.invite(a.orgId!, input.phone, 'HAYDOVCHI', input.fullName, a.userId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: m.userId }, select: { id: true, fullName: true, phone: true } });
    if (!user.fullName) await this.prisma.user.update({ where: { id: user.id }, data: { fullName: input.fullName } });
    return { userId: user.id, phone: user.phone, fullName: user.fullName ?? input.fullName, isActive: m.isActive };
  }

  /** ERP xodim kartasi (F.I.O.) → ECO profili. Faqat shu zavod haydovchisi bo'lsa. */
  async patchDriver(a: AuthContext, userId: string, input: { fullName?: string }) {
    const m = await this.prisma.membership.findUnique({ where: { userId_organizationId_role: { userId, organizationId: a.orgId!, role: 'HAYDOVCHI' } } });
    if (!m) throw DomainError.notFound('Haydovchi');
    const user = await this.prisma.user.update({ where: { id: userId }, data: { ...(input.fullName ? { fullName: input.fullName } : {}) }, select: { id: true, fullName: true, phone: true } });
    return { userId: user.id, phone: user.phone, fullName: user.fullName, isActive: m.isActive };
  }

  /** ERP'dan tasdiqlash (isActive=true) yoki bloklash (false). */
  async setDriverActive(a: AuthContext, userId: string, isActive: boolean) {
    const m = await this.orgs.setDriverActive(a.orgId!, userId, isActive, a.userId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, fullName: true, phone: true } });
    return { userId: user.id, phone: user.phone, fullName: user.fullName, isActive: m.isActive };
  }

  vehicles(a: AuthContext) {
    return this.orgs.vehicles(a.orgId!);
  }

  async upsertVehicle(a: AuthContext, input: { plateNumber: string; capacityM3: number; type?: 'MIXER' | 'PUMP' | 'DUMP' | 'TRUCK'; isActive?: boolean }) {
    const v = await this.prisma.vehicle.upsert({
      where: { organizationId_plateNumber: { organizationId: a.orgId!, plateNumber: input.plateNumber } },
      create: { organizationId: a.orgId!, plateNumber: input.plateNumber, capacityM3: new D(input.capacityM3), type: input.type ?? 'MIXER', isActive: input.isActive ?? true },
      update: { capacityM3: new D(input.capacityM3), ...(input.type ? { type: input.type } : {}), isActive: input.isActive ?? true },
    });
    this.orgs.vehicleChanged(v.organizationId, v.id, a.userId);
    return v;
  }

  // ───────── reyslar ─────────

  async getTrip(a: AuthContext, ref: string) {
    const d = await this.prisma.delivery.findFirst({ where: { externalRef: ref, order: { plantOrgId: a.orgId! } }, include: this.include });
    if (!d) throw DomainError.notFound('Reys');
    return d;
  }

  /** Bugungi va faol reyslar (ERP monitoring sahifasi uchun). */
  listTrips(a: AuthContext, date: Date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return this.prisma.delivery.findMany({
      where: { order: { plantOrgId: a.orgId! }, externalRef: { not: null }, OR: [{ plannedAt: { gte: start, lt: end } }, { status: { in: ACTIVE_DELIVERY_STATUSES as DeliveryStatus[] } }] },
      include: this.include,
      orderBy: { plannedAt: 'asc' },
    });
  }

  /**
   * ERP nakladnoy → ECO reys. Idempotent: externalRef bo'yicha bor bo'lsa yangilanadi.
   * Mijoz (CONTRACTOR tashkilot), marka (ConcreteMix), buyurtma (Order) yo'q bo'lsa yaratiladi.
   */
  async upsertTrip(a: AuthContext, ref: string, input: ErpTripInput) {
    const orgId = a.orgId!;
    const client = await this.ensureClient(input.customer);
    const mix = await this.ensureMix(orgId, input.product);
    const [driver, vehicle] = await Promise.all([this.resolveDriver(a, input), this.resolveVehicle(orgId, input)]);

    const existing = await this.prisma.delivery.findUnique({ where: { externalRef: ref }, include: { order: { select: { id: true, plantOrgId: true } } } });
    if (existing && existing.order.plantOrgId !== orgId) throw DomainError.forbidden();

    const result = await this.prisma.$transaction(async (tx) => {
      // 1) Buyurtma: ERP zayavkasi = ECO buyurtmasi (reyslar unga yig'iladi)
      let order = await tx.order.findUnique({ where: { plantOrgId_externalRef: { plantOrgId: orgId, externalRef: input.orderRef } }, include: { items: true } });
      if (!order) {
        order = await tx.order.create({
          data: {
            plantOrgId: orgId, clientOrgId: client.id, createdByUserId: a.userId, externalRef: input.orderRef,
            status: 'SCHEDULED', confirmedAt: new Date(),
            address: input.address, lat: input.location?.lat ?? 0, lng: input.location?.lng ?? 0,
            scheduledAt: input.scheduledAt, note: input.note,
            totalVolumeM3: new D(0), totalAmount: new D(0),
            items: { create: { mixId: mix.id, gradeSnapshot: mix.grade, nameSnapshot: mix.name, volumeM3: new D(0), unitPriceSnapshot: new D(input.product.unitPrice) } },
          },
          include: { items: true },
        });
      } else if (['SCHEDULED', 'CONFIRMED'].includes(order.status)) {
        // Manzil/vaqt ERP'da o'zgargan bo'lsa — hali boshlanmagan buyurtmada yangilanadi
        order = await tx.order.update({ where: { id: order.id }, data: { address: input.address, scheduledAt: input.scheduledAt, ...(input.location ? { lat: input.location.lat, lng: input.location.lng } : {}) }, include: { items: true } });
      }

      // 2) Reys
      const prevM3 = existing ? existing.plannedM3 : new D(0);
      const deltaM3 = new D(input.plannedM3).minus(prevM3);
      const lineTotal = deltaM3.mul(new D(input.product.unitPrice));
      const item = order.items.find((i) => i.mixId === mix.id) ?? order.items[0];

      let delivery;
      let assignedChanged = false;
      if (!existing) {
        const sequence = (await tx.delivery.count({ where: { orderId: order.id } })) + 1;
        delivery = await tx.delivery.create({
          data: { orderId: order.id, externalRef: ref, sequence, plannedM3: new D(input.plannedM3), plannedAt: input.scheduledAt, driverId: driver?.id, vehicleId: vehicle?.id, status: 'ASSIGNED' },
          include: this.include,
        });
        assignedChanged = !!driver;
      } else if (['ASSIGNED', 'DECLINED'].includes(existing.status)) {
        assignedChanged = !!driver && existing.driverId !== driver.id;
        delivery = await tx.delivery.update({
          where: { id: existing.id },
          data: { plannedM3: new D(input.plannedM3), plannedAt: input.scheduledAt, driverId: driver?.id ?? existing.driverId, vehicleId: vehicle?.id ?? existing.vehicleId, status: 'ASSIGNED' },
          include: this.include,
        });
      } else {
        // Reys boshlangan — faqat o'qiymiz (haydovchi jarayonini buzmaymiz)
        delivery = await tx.delivery.findUniqueOrThrow({ where: { id: existing.id }, include: this.include });
        return { delivery, order, created: false, changed: false, assignedChanged: false };
      }

      // Zayavka to'liq ERP'dan kelgan bo'lsa (erpManaged) hajm va summa ERP'niki —
      // reyslar bo'yicha qayta hisoblamaymiz, aks holda ERP raqami ustiga qo'shilib ketardi.
      if (!order.erpManaged && !deltaM3.isZero() && item) {
        await tx.orderItem.update({ where: { id: item.id }, data: { volumeM3: item.volumeM3.plus(deltaM3) } });
        await tx.order.update({ where: { id: order.id }, data: { totalVolumeM3: order.totalVolumeM3.plus(deltaM3), totalAmount: order.totalAmount.plus(lineTotal) } });
      }
      return { delivery, order, created: !existing, changed: true, assignedChanged };
    });

    if (result.assignedChanged && result.delivery.driver) {
      this.events.emit('delivery.assigned', { deliveryId: result.delivery.id, driverUserId: result.delivery.driver.user.id, orderId: result.order.id });
    }
    return { created: result.created, changed: result.changed, delivery: result.delivery };
  }

  /**
   * ERP tomonidan holat: oraliq bosqichlar avtomatik o'tiladi (masalan, ASSIGNED → LOADING uchun
   * avval haydovchi nomidan ACCEPTED). Orqaga yurish yo'q — allaqachon oldinda bo'lsa hech narsa qilinmaydi.
   */
  async setStatus(a: AuthContext, ref: string, input: ErpTripStatusInput) {
    const d = await this.getTrip(a, ref);
    const at = input.at ?? new Date();
    const from = d.status as DeliveryStatus;

    if (input.to === 'CANCELLED') {
      if (['CANCELLED', 'COMPLETED', 'FAILED'].includes(from)) return this.getTrip(a, ref);
      if (from === 'DECLINED') {
        // Jadvalda DECLINED → CANCELLED yo'q (odatda qayta biriktiriladi) — to'g'ridan-to'g'ri yopamiz
        await this.prisma.$transaction([
          this.prisma.delivery.update({ where: { id: d.id }, data: { status: 'CANCELLED' } }),
          this.prisma.deliveryEvent.create({ data: { deliveryId: d.id, from, to: 'CANCELLED', byUserId: a.userId, byRole: 'TADBIRKOR', at, note: input.note ?? 'ERP: bekor' } }),
        ]);
        return this.getTrip(a, ref);
      }
      const to: DeliveryStatus = ['ASSIGNED', 'ACCEPTED'].includes(from) ? 'CANCELLED' : 'FAILED';
      await this.deliveries.transition(a, d.id, { to, at, note: input.note ?? 'ERP: bekor' }, `erp:${ref}:${to}:${at.getTime()}`);
      return this.getTrip(a, ref);
    }

    const fromIdx = FORWARD.indexOf(from);
    const toIdx = FORWARD.indexOf(input.to);
    if (fromIdx < 0) throw new DomainError('DELIVERY_INVALID_TRANSITION', `Reys ${from} holatida — ERP'dan o'tkazib bo'lmaydi`, { from, to: input.to });
    if (fromIdx >= toIdx) return d; // allaqachon shu yoki keyingi bosqichda

    for (let i = fromIdx + 1; i <= toIdx; i++) {
      const step = FORWARD[i]!;
      const ctx = step === 'ACCEPTED' ? this.driverContext(d) : a; // qabul faqat haydovchi nomidan
      const body = {
        to: step, at,
        note: i === toIdx ? (input.note ?? 'ERP') : 'ERP: avtomatik oraliq bosqich',
        ...(step === 'EN_ROUTE' && input.loadedM3 ? { loadedM3: input.loadedM3 } : {}),
      };
      await this.deliveries.transition(ctx, d.id, body, `erp:${ref}:${step}:${at.getTime()}`);
    }
    if (input.to === 'COMPLETED' && input.acceptedM3) {
      await this.prisma.delivery.update({ where: { id: d.id }, data: { acceptedM3: new D(input.acceptedM3) } });
    }
    return this.getTrip(a, ref);
  }

  // ───────── ERP spravochniklari (ERP — manba, ECO — ko'zgu) ─────────

  /** ERP mijoz kartasi → CONTRACTOR tashkilot + shu zavod uchun kredit limiti. */
  async upsertCustomer(a: AuthContext, input: ErpCustomerInput) {
    const org = await this.ensureClient(input);
    const data: Prisma.OrganizationUpdateInput = {
      name: input.name,
      ...(input.inn ? { inn: input.inn } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      // ERP'da arxivlangan mijoz ilovada ko'rinmaydi. O'chirilmaydi — qayta faollashtirilsa tiklanadi.
      ...(input.isActive === undefined ? {} : { deletedAt: input.isActive ? null : (org.deletedAt ?? new Date()) }),
    };
    const saved = await this.prisma.organization.update({ where: { id: org.id }, data });

    if (input.creditLimit !== undefined) {
      await this.prisma.creditLimit.upsert({
        where: { plantOrgId_clientOrgId: { plantOrgId: a.orgId!, clientOrgId: saved.id } },
        create: { plantOrgId: a.orgId!, clientOrgId: saved.id, limitAmount: new D(input.creditLimit) },
        update: { limitAmount: new D(input.creditLimit) },
      });
    }
    return { id: saved.id, externalRef: saved.externalRef, name: saved.name, inn: saved.inn, isActive: !saved.deletedAt };
  }

  /** ERP mahsulot kartasi (beton markasi) → ConcreteMix. Kalit: marka (grade). */
  async upsertMix(a: AuthContext, input: ErpMixInput) {
    const existing = await this.prisma.concreteMix.findFirst({ where: { organizationId: a.orgId!, grade: input.grade } });
    const data = {
      name: input.name,
      unitPrice: new D(input.unitPrice),
      ...(input.slump !== undefined ? { slump: input.slump } : {}),
      isActive: input.isActive ?? true,
      // ERP'da qayta faollashtirilgan marka ECO'da ham tiklanadi
      ...(input.isActive === false ? {} : { deletedAt: null }),
    };
    const mix = existing
      ? await this.prisma.concreteMix.update({ where: { id: existing.id }, data })
      : await this.prisma.concreteMix.create({ data: { organizationId: a.orgId!, grade: input.grade, ...data } });
    return { id: mix.id, grade: mix.grade, name: mix.name, unitPrice: mix.unitPrice, isActive: mix.isActive };
  }

  /** ERP xomashyo kartasi → Material. Kalit: externalRef (ERP kartasi id). */
  async upsertMaterial(a: AuthContext, input: ErpMaterialInput) {
    const data = {
      name: input.name,
      unit: input.unit,
      category: input.category ?? 'Xomashyo',
      price: new D(input.price ?? 0),
      minStock: new D(input.minStock ?? 0),
    };
    const m = await this.prisma.material.upsert({
      where: { organizationId_externalRef: { organizationId: a.orgId!, externalRef: input.externalRef } },
      create: { organizationId: a.orgId!, externalRef: input.externalRef, ...data },
      update: data,
    });
    return { id: m.id, externalRef: m.externalRef, name: m.name, unit: m.unit, price: m.price };
  }

  /**
   * ERP zayavkasi → ECO buyurtmasi. Kalit: externalRef (ERP zayavka raqami).
   * Buyurtma erpManaged bo'lib qoladi — hajm va summa ERP'niki, reyslar uni o'zgartirmaydi.
   */
  async upsertOrder(a: AuthContext, ref: string, input: ErpOrderInput) {
    const orgId = a.orgId!;
    const client = await this.ensureClient(input.customer);
    const mixes = new Map<string, string>();
    for (const it of input.items) {
      const mix = await this.ensureMix(orgId, { grade: it.grade, name: it.name, unitPrice: it.unitPrice });
      mixes.set(it.grade, mix.id);
    }
    const totalVolumeM3 = input.items.reduce((sum, i) => sum.plus(new D(i.volumeM3)), new D(0));
    const totalAmount = input.items.reduce((sum, i) => sum.plus(new D(i.volumeM3).mul(new D(i.unitPrice))), new D(0));
    const status = ORDER_STATUS[input.status] ?? 'DRAFT';

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { plantOrgId_externalRef: { plantOrgId: orgId, externalRef: ref } }, include: { items: true } });
      const common = {
        clientOrgId: client.id,
        status,
        address: input.address,
        ...(input.location ? { lat: input.location.lat, lng: input.location.lng } : {}),
        scheduledAt: input.scheduledAt,
        needsPump: input.needsPump ?? false,
        note: input.note,
        totalVolumeM3,
        totalAmount,
        erpManaged: true,
        ...(status === 'SCHEDULED' || status === 'IN_PROGRESS' ? { confirmedAt: new Date() } : {}),
      };

      const order = existing
        ? await tx.order.update({ where: { id: existing.id }, data: common })
        : await tx.order.create({
            data: {
              plantOrgId: orgId, createdByUserId: a.userId, externalRef: ref,
              lat: input.location?.lat ?? 0, lng: input.location?.lng ?? 0,
              ...common,
            },
          });

      // Qatorlar: ERP'dagi holatga keltiriladi (markaga qarab yangilanadi, ortiqchasi olib tashlanadi)
      const keep: string[] = [];
      for (const it of input.items) {
        const mixId = mixes.get(it.grade)!;
        const row = existing?.items.find((x) => x.mixId === mixId);
        const payload = { gradeSnapshot: it.grade, nameSnapshot: it.name, volumeM3: new D(it.volumeM3), unitPriceSnapshot: new D(it.unitPrice) };
        const saved = row
          ? await tx.orderItem.update({ where: { id: row.id }, data: payload })
          : await tx.orderItem.create({ data: { orderId: order.id, mixId, ...payload } });
        keep.push(saved.id);
      }
      if (existing) {
        const stale = existing.items.filter((i) => !keep.includes(i.id)).map((i) => i.id);
        if (stale.length) await tx.orderItem.deleteMany({ where: { id: { in: stale } } });
      }

      return { created: !existing, order: await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, client: { select: { id: true, name: true } } } }) };
    });
  }

  /** ERP schyoti → ECO hisob-fakturasi. ECO'da schyot buyurtmaga tegishli, shuning uchun zayavka avval yuborilgan bo'lishi kerak. */
  async upsertInvoice(a: AuthContext, ref: string, input: ErpInvoiceInput) {
    const order = await this.prisma.order.findUnique({ where: { plantOrgId_externalRef: { plantOrgId: a.orgId!, externalRef: input.orderRef } } });
    if (!order) throw DomainError.notFound(`Zayavka ${input.orderRef} (avval zayavkani yuboring)`);
    const data = {
      clientOrgId: order.clientOrgId,
      status: INVOICE_STATUS[input.status] ?? 'OPEN',
      amount: new D(input.amount),
      paidAmount: new D(input.paidAmount ?? 0),
      issuedAt: input.issuedAt ?? new Date(),
    };
    const inv = await this.prisma.invoice.upsert({ where: { orderId: order.id }, create: { orderId: order.id, ...data }, update: data });
    this.logger.log(`ERP schyot ${ref} → invoice ${inv.id}`);
    return { id: inv.id, number: inv.number, status: inv.status, amount: inv.amount, paidAmount: inv.paidAmount };
  }

  /** ERP to'lovi → ECO to'lovi. Kalit: externalId (ERP to'lov id) — takror yuborilsa dublikat bo'lmaydi. */
  async upsertPayment(a: AuthContext, ref: string, input: ErpPaymentInput) {
    const order = await this.prisma.order.findUnique({ where: { plantOrgId_externalRef: { plantOrgId: a.orgId!, externalRef: input.orderRef } }, include: { invoice: true } });
    if (!order) throw DomainError.notFound(`Zayavka ${input.orderRef} (avval zayavkani yuboring)`);
    if (!order.invoice) throw DomainError.notFound(`${input.orderRef} uchun schyot (avval schyotni yuboring)`);
    const data = { amount: new D(input.amount), method: input.method ?? 'CASH', paidAt: input.paidAt ?? new Date(), status: 'CONFIRMED', recordedByUserId: a.userId };
    const pay = await this.prisma.payment.upsert({
      where: { externalId: ref },
      create: { invoiceId: order.invoice.id, externalId: ref, ...data },
      update: data,
    });
    return { id: pay.id, externalId: pay.externalId, amount: pay.amount, method: pay.method };
  }

  // ───────── kuzatuv (ERP xaritasi uchun) ─────────

  /** Faol reyslarning oxirgi GPS nuqtasi. ERP "Reyslar / nakladnoy" sahifasi shu bo'yicha xarita chizadi. */
  async positions(a: AuthContext) {
    const ds = await this.prisma.delivery.findMany({
      where: { order: { plantOrgId: a.orgId! }, externalRef: { not: null }, status: { in: ACTIVE_DELIVERY_STATUSES as DeliveryStatus[] } },
      select: {
        id: true, externalRef: true, status: true, plannedM3: true, loadedM3: true, plannedAt: true, departedAt: true, slaBreached: true,
        order: { select: { externalRef: true, address: true, lat: true, lng: true, client: { select: { name: true } } } },
        driver: { select: { user: { select: { fullName: true, phone: true } } } },
        vehicle: { select: { plateNumber: true } },
      },
      orderBy: { plannedAt: 'asc' },
    });
    return Promise.all(ds.map(async (d) => ({
      ref: d.externalRef!,
      deliveryId: d.id,
      status: d.status,
      orderRef: d.order.externalRef,
      customer: d.order.client.name,
      address: d.order.address,
      /** Obyekt koordinatasi — ERP zayavkada nuqta berilmagan bo'lsa null */
      destination: d.order.lat || d.order.lng ? { lat: d.order.lat, lng: d.order.lng } : null,
      driver: d.driver?.user.fullName ?? null,
      driverPhone: d.driver?.user.phone ?? null,
      plate: d.vehicle?.plateNumber ?? null,
      plannedM3: d.plannedM3,
      loadedM3: d.loadedM3,
      plannedAt: d.plannedAt,
      departedAt: d.departedAt,
      slaBreached: d.slaBreached,
      /** Oxirgi nuqta + ETA. null — haydovchi hali GPS yubormagan */
      position: await this.tracking.lastPosition(d.id),
      /** Reys boshidan beri GPS izi bo'yicha bosib o'tilgan yo'l va tezlik */
      odometer: await this.tracking.odometer(d.id),
    })));
  }

  /**
   * Haydovchilar kesimida bosib o'tilgan yo'l — ERP "Haydovchilar" sahifasi va xodim kartochkasi
   * shu bo'yicha "bugun/shu oyda necha km yurdi" ko'rsatadi (yoqilg'i va ish haqi hisobiga asos).
   */
  async mileage(a: AuthContext, fromISO?: string, toISO?: string) {
    const to = toISO ? new Date(toISO) : new Date();
    const from = fromISO ? new Date(fromISO) : new Date(to.getFullYear(), to.getMonth(), 1);
    const rows = await this.tracking.mileageByDriver(a.orgId!, from, to);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      drivers: rows.map((r) => ({
        driverId: r.driverId,
        userId: r.userId,
        fullName: r.fullName,
        phone: r.phone,
        trips: Number(r.trips),
        meters: Number(r.meters ?? 0),
      })),
    };
  }

  /** Bitta reysning to'liq izi (polyline) — nizolarda dalil va ERP xaritasida yo'l chizig'i. */
  async track(a: AuthContext, ref: string) {
    const d = await this.getTrip(a, ref);
    const points = await this.tracking.track(d.id);
    return { ref, deliveryId: d.id, status: d.status, points, odometer: trackStats(points) };
  }

  // ───────── ichki ─────────

  private driverContext(d: { driver: { userId: string } | null }): AuthContext {
    if (!d.driver) throw new DomainError('DELIVERY_INVALID_TRANSITION', 'Reysga haydovchi biriktirilmagan — avval haydovchini bering');
    return { userId: d.driver.userId, sessionId: 'integration:driver', orgId: null, role: 'HAYDOVCHI' };
  }

  /**
   * Mijoz — CONTRACTOR tashkilot. Izlash tartibi: ERP kartasi id (externalRef) → INN → nom.
   * externalRef birinchi o'rinda, chunki ERP'da mijoz nomi yoki INN'i o'zgarishi mumkin,
   * id esa o'zgarmaydi. Telefon bo'lsa — QURUVCHI a'zo (SMS qabul kodi uchun).
   */
  private async ensureClient(c: ErpTripInput['customer']) {
    let org = c.externalRef ? await this.prisma.organization.findUnique({ where: { externalRef: c.externalRef } }) : null;
    if (!org && c.inn) org = await this.prisma.organization.findUnique({ where: { inn: c.inn } });
    if (!org) org = await this.prisma.organization.findFirst({ where: { type: 'CONTRACTOR', name: c.name, deletedAt: null } });
    if (!org) org = await this.prisma.organization.create({ data: { type: 'CONTRACTOR', name: c.name, inn: c.inn, externalRef: c.externalRef } });
    else if (c.externalRef && !org.externalRef) {
      // Eski yozuv — endi ERP kartasiga bog'lanadi
      org = await this.prisma.organization.update({ where: { id: org.id }, data: { externalRef: c.externalRef } });
    }
    if (c.phone) {
      try {
        const user = await this.prisma.user.upsert({ where: { phone: c.phone }, create: { phone: c.phone, fullName: c.name }, update: {} });
        await this.prisma.membership.upsert({
          where: { userId_organizationId_role: { userId: user.id, organizationId: org.id, role: 'QURUVCHI' } },
          create: { userId: user.id, organizationId: org.id, role: 'QURUVCHI', invitedByPhone: true },
          update: {},
        });
      } catch (e) {
        this.logger.warn(`client membership skipped for ${c.name}: ${(e as Error).message}`);
      }
    }
    return org;
  }

  private async ensureMix(orgId: string, p: ErpTripInput['product']) {
    const mix = await this.prisma.concreteMix.findFirst({ where: { organizationId: orgId, grade: p.grade, deletedAt: null } });
    if (mix) return mix;
    return this.prisma.concreteMix.create({ data: { organizationId: orgId, grade: p.grade, name: p.name, unitPrice: new D(p.unitPrice) } });
  }

  private async resolveDriver(a: AuthContext, input: ErpTripInput) {
    if (!input.driverPhone) return null;
    let profile = await this.prisma.driverProfile.findFirst({
      where: { user: { phone: input.driverPhone, memberships: { some: { organizationId: a.orgId!, role: 'HAYDOVCHI', isActive: true } } } },
    });
    if (!profile) {
      // ERP'dagi haydovchi ECO'da yo'q — taklif qilamiz (birinchi kirishda rol tayyor)
      await this.orgs.invite(a.orgId!, input.driverPhone, 'HAYDOVCHI', input.driverName);
      profile = await this.prisma.driverProfile.findFirstOrThrow({ where: { user: { phone: input.driverPhone } } });
    }
    return profile;
  }

  private async resolveVehicle(orgId: string, input: ErpTripInput) {
    if (!input.vehiclePlate) return null;
    const plateNumber = input.vehiclePlate.toUpperCase().replace(/\s+/g, '');
    return this.prisma.vehicle.upsert({
      where: { organizationId_plateNumber: { organizationId: orgId, plateNumber } },
      create: { organizationId: orgId, plateNumber, capacityM3: new D(input.vehicleCapacityM3 ?? 8), type: 'MIXER' },
      update: { isActive: true, ...(input.vehicleCapacityM3 ? { capacityM3: new D(input.vehicleCapacityM3) } : {}) },
    });
  }
}
