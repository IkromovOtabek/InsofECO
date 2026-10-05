import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { SHIPMENT_TRANSITIONS, ShipmentStatus, ShipmentTransitionSchema, canTransition } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';
import { assertAtSite, knownPoint } from '../deliveries/geofence';

const include = {
  project: { select: { id: true, name: true, address: true, lat: true, lng: true } },
  warehouse: { select: { id: true, name: true, address: true, lat: true, lng: true } },
  driver: { select: { id: true, fullName: true, phone: true } },
  vehicle: true,
  request: { include: { material: true } },
} satisfies Prisma.ShipmentInclude;

/**
 * Yuk yetkazish zanjiri. CONFIRMED (qabul qiluvchi tasdiqladi) — bitta tranzaksiyada:
 * Inventory −qty · MaterialRequest CONFIRMED · Expense(MATERIAL) · Project.spent + · Payout(haydovchi) · Expense(DRIVER)
 */
@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  list(a: AuthContext, status?: string) {
    return this.prisma.shipment.findMany({
      where: {
        organizationId: a.orgId!,
        ...(a.role === 'HAYDOVCHI' ? { OR: [{ driverUserId: a.userId }, { driverUserId: null, status: 'NEW' }] } : {}),
        ...(a.role === 'QURUVCHI' ? { project: { members: { some: { userId: a.userId } } } } : {}),
        ...(status ? { status: { in: status.split(',') as ShipmentStatus[] } } : {}),
      },
      include,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async get(a: AuthContext, id: string) {
    const s = await this.prisma.shipment.findFirst({ where: { id, organizationId: a.orgId! }, include: { ...include, payouts: true } });
    if (!s) throw DomainError.notFound('Yuk');
    // Haydovchi uchun "Qo'ng'iroq": so'rov bergan quruvchi, bo'lmasa tashkilot tadbirkori
    const contactUser = s.request?.requestedByUserId
      ? await this.prisma.user.findUnique({ where: { id: s.request.requestedByUserId }, select: { fullName: true, phone: true } })
      : null;
    const fallback = contactUser ?? (await this.prisma.membership.findFirst({ where: { organizationId: s.organizationId, role: 'TADBIRKOR', isActive: true, user: { isSuperAdmin: false } }, select: { user: { select: { fullName: true, phone: true } } } }))?.user ?? null;
    return { ...s, contact: fallback };
  }

  async transition(a: AuthContext, id: string, input: z.infer<typeof ShipmentTransitionSchema>) {
    const s = await this.get(a, id);
    const from = s.status as ShipmentStatus;
    if (a.role === 'HAYDOVCHI' && s.driverUserId && s.driverUserId !== a.userId) throw DomainError.forbidden('Bu yuk boshqa haydovchiga biriktirilgan');
    if (!canTransition(SHIPMENT_TRANSITIONS, from, input.to, a.role!)) throw new DomainError('DELIVERY_INVALID_TRANSITION', `${from} → ${input.to} (${a.role}) mumkin emas`);
    // Quruvchi faqat o'zi a'zo loyihaga kelgan yukni tasdiqlaydi (ro'yxat ham shunday filtrlanadi)
    if (a.role === 'QURUVCHI' && s.request?.requestedByUserId !== a.userId) {
      const member = await this.prisma.project.count({ where: { id: s.projectId, members: { some: { userId: a.userId } } } });
      if (!member) throw DomainError.forbidden('Bu yuk sizning loyihangizga tegishli emas');
    }

    // "Yetkazdim" — faqat obyekt yonida. Ilgari ilova koordinata yubormas, server esa
    // tekshirmas edi: haydovchi yo'lning yarmida bossa ham yuk "Yetkazildi" bo'lib qolardi.
    // DELIVERED faqat haydovchiniki (SHIPMENT_TRANSITIONS) — dispetcher override'i bu holat uchun yo'q.
    if (input.to === 'DELIVERED' && a.role === 'HAYDOVCHI') {
      assertAtSite(input.location, knownPoint(s.project.lat, s.project.lng), 'Yetkazdim');
    }
    if (input.to === 'ACCEPTED') {
      const busy = await this.prisma.shipment.count({ where: { driverUserId: a.userId, status: { in: ['ACCEPTED', 'LOADING', 'EN_ROUTE'] } } });
      if (busy > 0) throw new DomainError('DELIVERY_DRIVER_BUSY', 'Avval joriy yukni yetkazing');
    }
    const now = new Date();
    const stamps: Prisma.ShipmentUncheckedUpdateManyInput = { ACCEPTED: { acceptedAt: now, driverUserId: a.userId }, LOADING: { loadedAt: now }, EN_ROUTE: { departedAt: now }, DELIVERED: { deliveredAt: now, photoKey: input.photoKey, receiverName: input.receiverName, deliveredLat: input.location?.lat, deliveredLng: input.location?.lng }, CONFIRMED: { confirmedAt: now } }[input.to as string] ?? {};

    // Holat o'tishi atomar (compare-and-set): ikki haydovchi bir vaqtda "Qabul qilaman" bossa yoki
    // qabul qiluvchi "Tasdiqlash"ni ikki marta yuborsa — faqat bittasi o'tadi. Ilgari ikkalasi ham
    // o'tardi: yuk oxirgi bosganga yozilardi, CONFIRMED esa ombordan ikki marta ayirib, haydovchiga
    // ikki marta haq yozardi.
    const claim = (tx: Prisma.TransactionClient) =>
      tx.shipment.updateMany({
        where: { id, status: from, ...(input.to === 'ACCEPTED' ? { OR: [{ driverUserId: null }, { driverUserId: a.userId }] } : {}) },
        data: { status: input.to, ...stamps },
      });
    const lost = () => new DomainError('DELIVERY_INVALID_TRANSITION', input.to === 'ACCEPTED' ? 'Bu yukni boshqa haydovchi oldi' : 'Yuk holati allaqachon o\'zgargan — sahifani yangilang', { from, to: input.to });

    if (input.to === 'CONFIRMED') {
      await this.prisma.$transaction(async (tx) => {
        if ((await claim(tx)).count !== 1) throw lost();
        if (s.request) {
          await tx.inventoryItem.update({ where: { warehouseId_materialId: { warehouseId: s.warehouseId, materialId: s.request.materialId } }, data: { quantity: { decrement: s.quantity } } });
          await tx.materialRequest.update({ where: { id: s.request.id }, data: { status: 'CONFIRMED' } });
          const cost = s.request.material.price.mul(s.quantity);
          await tx.expense.create({ data: { organizationId: s.organizationId, projectId: s.projectId, category: 'MATERIAL', amount: cost, description: `${s.cargo} → ${s.project.name}`, refType: 'MATERIAL_REQUEST', refId: s.request.id, createdByUserId: a.userId } });
          await tx.project.update({ where: { id: s.projectId }, data: { spent: { increment: cost } } });
        }
        if (s.driverUserId && s.driverFee.gt(0)) {
          await tx.payout.create({ data: { organizationId: s.organizationId, userId: s.driverUserId, shipmentId: id, amount: s.driverFee, description: `Yuk №${s.number}: ${s.cargo}` } });
          await tx.expense.create({ data: { organizationId: s.organizationId, projectId: s.projectId, category: 'DRIVER', amount: s.driverFee, description: `Yetkazish №${s.number}`, refType: 'SHIPMENT', refId: id, createdByUserId: a.userId } });
          await tx.project.update({ where: { id: s.projectId }, data: { spent: { increment: s.driverFee } } });
        }
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        if ((await claim(tx)).count !== 1) throw lost();
        if (s.request && (input.to === 'LOADING' || input.to === 'DELIVERED')) {
          await tx.materialRequest.update({ where: { id: s.request.id }, data: { status: input.to === 'LOADING' ? 'LOADING' : 'DELIVERED' } });
        }
      });
    }
    const updated = await this.get(a, id);
    this.events.emit('shipment.status_changed', { shipmentId: id, number: s.number, cargo: s.cargo, from, to: input.to, orgId: s.organizationId, driverUserId: updated.driverUserId, requesterUserId: s.request?.requestedByUserId ?? null, byUserId: a.userId });
    return updated;
  }

  /** Haydovchi tarixi va daromadi. */
  async history(a: AuthContext) {
    return this.prisma.shipment.findMany({ where: { driverUserId: a.userId, status: { in: ['DELIVERED', 'CONFIRMED', 'CANCELLED'] } }, include, orderBy: { deliveredAt: 'desc' }, take: 100 });
  }
}
