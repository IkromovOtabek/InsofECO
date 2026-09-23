import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { SHIPMENT_TRANSITIONS, ShipmentStatus, ShipmentTransitionSchema, canTransition } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';

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
    const fallback = contactUser ?? (await this.prisma.membership.findFirst({ where: { organizationId: s.organizationId, role: 'TADBIRKOR', isActive: true }, select: { user: { select: { fullName: true, phone: true } } } }))?.user ?? null;
    return { ...s, contact: fallback };
  }

  async transition(a: AuthContext, id: string, input: z.infer<typeof ShipmentTransitionSchema>) {
    const s = await this.get(a, id);
    const from = s.status as ShipmentStatus;
    if (a.role === 'HAYDOVCHI' && s.driverUserId && s.driverUserId !== a.userId) throw DomainError.forbidden('Bu yuk boshqa haydovchiga biriktirilgan');
    if (!canTransition(SHIPMENT_TRANSITIONS, from, input.to, a.role!)) throw new DomainError('DELIVERY_INVALID_TRANSITION', `${from} → ${input.to} (${a.role}) mumkin emas`);

    if (input.to === 'ACCEPTED') {
      const busy = await this.prisma.shipment.count({ where: { driverUserId: a.userId, status: { in: ['ACCEPTED', 'LOADING', 'EN_ROUTE'] } } });
      if (busy > 0) throw new DomainError('DELIVERY_DRIVER_BUSY', 'Avval joriy yukni yetkazing');
    }
    const now = new Date();
    const stamps: Prisma.ShipmentUpdateInput = { ACCEPTED: { acceptedAt: now, driver: { connect: { id: a.userId } } }, LOADING: { loadedAt: now }, EN_ROUTE: { departedAt: now }, DELIVERED: { deliveredAt: now, photoKey: input.photoKey, receiverName: input.receiverName, deliveredLat: input.location?.lat, deliveredLng: input.location?.lng }, CONFIRMED: { confirmedAt: now } }[input.to as string] ?? {};

    if (input.to === 'CONFIRMED') {
      await this.prisma.$transaction(async (tx) => {
        await tx.shipment.update({ where: { id }, data: { status: 'CONFIRMED', ...stamps } });
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
      await this.prisma.shipment.update({ where: { id }, data: { status: input.to, ...stamps } });
      if (s.request && (input.to === 'LOADING' || input.to === 'DELIVERED')) {
        await this.prisma.materialRequest.update({ where: { id: s.request.id }, data: { status: input.to === 'LOADING' ? 'LOADING' : 'DELIVERED' } });
      }
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
