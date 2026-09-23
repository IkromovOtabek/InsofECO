import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { InventoryAdjustSchema, MaterialCreateSchema, MaterialRequestApproveSchema, MaterialRequestCreateSchema } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';

const D = Prisma.Decimal;

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Katalog + umumiy zaxira + past zaxira bayrog'i. */
  async list(a: AuthContext) {
    const ms = await this.prisma.material.findMany({ where: { organizationId: a.orgId! }, include: { inventory: { include: { warehouse: { select: { id: true, name: true } } } } }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    return ms.map((m) => {
      const stock = m.inventory.reduce((s, i) => s.plus(i.quantity), new D(0));
      return { ...m, stock, low: stock.lte(m.minStock) };
    });
  }

  create(a: AuthContext, input: z.infer<typeof MaterialCreateSchema>) {
    return this.prisma.material.create({ data: { organizationId: a.orgId!, ...input, price: new D(input.price), minStock: new D(input.minStock) } });
  }

  async update(a: AuthContext, id: string, input: Partial<z.infer<typeof MaterialCreateSchema>>) {
    const r = await this.prisma.material.updateMany({ where: { id, organizationId: a.orgId! }, data: { ...input, ...(input.price !== undefined ? { price: new D(input.price) } : {}), ...(input.minStock !== undefined ? { minStock: new D(input.minStock) } : {}) } });
    if (r.count === 0) throw DomainError.notFound('Material');
    return this.prisma.material.findUnique({ where: { id } });
  }

  warehouses(a: AuthContext) {
    return this.prisma.warehouse.findMany({ where: { organizationId: a.orgId! }, include: { inventory: { include: { material: true } } } });
  }

  /** Kirim/chiqim (qo'lda): ombor zaxirasi ± delta; MATERIAL xarajat kirim bo'lsa. */
  async adjust(a: AuthContext, input: z.infer<typeof InventoryAdjustSchema>) {
    const w = await this.prisma.warehouse.findFirst({ where: { id: input.warehouseId, organizationId: a.orgId! } });
    const m = await this.prisma.material.findFirst({ where: { id: input.materialId, organizationId: a.orgId! } });
    if (!w || !m) throw DomainError.notFound('Ombor yoki material');
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.upsert({
        where: { warehouseId_materialId: { warehouseId: w.id, materialId: m.id } },
        create: { warehouseId: w.id, materialId: m.id, quantity: new D(input.delta) },
        update: { quantity: { increment: input.delta } },
      });
      if (input.delta > 0) {
        await tx.expense.create({ data: { organizationId: a.orgId!, category: 'MATERIAL', amount: m.price.mul(input.delta), description: `Omborga kirim: ${m.name} ${input.delta} ${m.unit}${input.note ? ` (${input.note})` : ''}`, createdByUserId: a.userId } });
      }
      return item;
    });
  }

  // ───── Material so'rovlari ─────
  listRequests(a: AuthContext, status?: string) {
    return this.prisma.materialRequest.findMany({
      where: { organizationId: a.orgId!, ...(a.role === 'QURUVCHI' ? { requestedByUserId: a.userId } : {}), ...(status ? { status: { in: status.split(',') as never[] } } : {}) },
      include: { material: true, project: { select: { id: true, name: true } }, shipment: { include: { driver: { select: { fullName: true, phone: true } }, vehicle: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRequest(a: AuthContext, input: z.infer<typeof MaterialRequestCreateSchema>) {
    const [p, m] = await Promise.all([
      this.prisma.project.findFirst({ where: { id: input.projectId, organizationId: a.orgId! } }),
      this.prisma.material.findFirst({ where: { id: input.materialId, organizationId: a.orgId! } }),
    ]);
    if (!p || !m) throw DomainError.notFound('Loyiha yoki material');
    const r = await this.prisma.materialRequest.create({ data: { organizationId: a.orgId!, projectId: p.id, materialId: m.id, quantity: new D(input.quantity), reason: input.reason, requestedByUserId: a.userId }, include: { material: true, project: true } });
    this.events.emit('material_request.created', { requestId: r.id, number: r.number, orgId: a.orgId, material: m.name, quantity: input.quantity, unit: m.unit, project: p.name, byUserId: a.userId });
    return r;
  }

  /**
   * Tadbirkor tasdiqlaydi → Shipment (NEW yoki haydovchi bilan ACCEPTED kutish) yaratiladi.
   * Zaxira yetarli bo'lmasa — xato (ombor boshqaruvi).
   */
  async approve(a: AuthContext, id: string, input: z.infer<typeof MaterialRequestApproveSchema>) {
    const r = await this.prisma.materialRequest.findFirst({ where: { id, organizationId: a.orgId! }, include: { material: true, project: true } });
    if (!r) throw DomainError.notFound("So'rov");
    if (r.status !== 'PENDING') throw new DomainError('ORDER_INVALID_TRANSITION', "So'rov allaqachon ko'rib chiqilgan");
    const warehouse = input.warehouseId
      ? await this.prisma.warehouse.findFirst({ where: { id: input.warehouseId, organizationId: a.orgId! } })
      : await this.prisma.warehouse.findFirst({ where: { organizationId: a.orgId!, inventory: { some: { materialId: r.materialId, quantity: { gte: r.quantity } } } } });
    if (!warehouse) throw new DomainError('VALIDATION', `Omborda ${r.material.name} yetarli emas`);
    const item = await this.prisma.inventoryItem.findUnique({ where: { warehouseId_materialId: { warehouseId: warehouse.id, materialId: r.materialId } } });
    if (!item || item.quantity.lt(r.quantity)) throw new DomainError('VALIDATION', `Omborda ${r.material.name} yetarli emas (${item?.quantity ?? 0} ${r.material.unit})`);

    const dist = warehouse.lat && r.project.lat ? haversineKm(warehouse.lat, warehouse.lng!, r.project.lat, r.project.lng!) : null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const sh = await tx.shipment.create({
        data: {
          organizationId: a.orgId!, materialRequestId: r.id, projectId: r.projectId, warehouseId: warehouse.id,
          driverUserId: input.driverUserId, vehicleId: input.vehicleId, status: 'NEW',
          cargo: `${r.material.name} — ${r.quantity} ${r.material.unit}`, quantity: r.quantity, unit: r.material.unit,
          distanceKm: dist !== null ? new D(dist.toFixed(1)) : null, driverFee: new D(input.driverFee ?? (dist ? Math.round(dist * 15_000) : 150_000)),
        },
      });
      return tx.materialRequest.update({ where: { id }, data: { status: 'APPROVED', decidedByUserId: a.userId, decidedAt: new Date() }, include: { material: true, project: true, shipment: true } });
    });
    this.events.emit('material_request.approved', { requestId: id, number: r.number, byUserId: r.requestedByUserId, material: r.material.name, shipmentId: updated.shipment?.id, driverUserId: input.driverUserId });
    return updated;
  }

  async reject(a: AuthContext, id: string, reason: string) {
    const r = await this.prisma.materialRequest.findFirst({ where: { id, organizationId: a.orgId!, status: 'PENDING' } });
    if (!r) throw DomainError.notFound("So'rov");
    const u = await this.prisma.materialRequest.update({ where: { id }, data: { status: 'REJECTED', rejectReason: reason, decidedByUserId: a.userId, decidedAt: new Date() } });
    this.events.emit('material_request.rejected', { requestId: id, number: r.number, byUserId: r.requestedByUserId, reason });
    return u;
  }
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
