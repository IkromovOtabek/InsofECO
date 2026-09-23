import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  CreateOrderInput,
  DEFAULT_RULES,
  ORDER_TRANSITIONS,
  OrderStatus,
  Role,
  canTransition,
  cancellationPenalty,
} from '@insof/shared';
import { z } from 'zod';
import { ConfirmOrderSchema } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';
import { ORDER_EVENTS, OrderStatusChangedEvent } from './orders.events';

const D = Prisma.Decimal;
const ALL_STATUSES = Object.values(OrderStatus) as OrderStatus[];
type ConfirmInput = z.infer<typeof ConfirmOrderSchema>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  // ───────── so'rovlar ─────────

  /** Tadbirkor (PLANT) — zavodga kelgan; Quruvchi/Tadbirkor (CONTRACTOR) — o'z tashkiloti bergan. */
  async list(a: AuthContext, q: { status?: string; date?: Date; since?: Date; cursor?: string; limit: number }) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: a.orgId! }, select: { type: true } });
    const requested = q.status ? (q.status.split(',') as OrderStatus[]) : null;
    // PLANT ko'rmaydi: mijoz hali yubormagan qoralamalar
    const statusFilter: Prisma.OrderWhereInput['status'] =
      org.type === 'PLANT' ? { in: (requested ?? ALL_STATUSES).filter((s) => s !== 'DRAFT') } : requested ? { in: requested } : undefined;
    const where: Prisma.OrderWhereInput = {
      ...(org.type === 'PLANT' ? { plantOrgId: a.orgId! } : { clientOrgId: a.orgId! }),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q.date ? { scheduledAt: { gte: startOfDay(q.date), lt: endOfDay(q.date) } } : {}),
      ...(q.since ? { updatedAt: { gt: q.since } } : {}),
    };
    const rows = await this.prisma.order.findMany({
      where,
      include: this.include,
      orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > q.limit;
    const items = hasMore ? rows.slice(0, q.limit) : rows;
    return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
  }

  async get(a: AuthContext, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, OR: [{ plantOrgId: a.orgId! }, { clientOrgId: a.orgId! }] },
      include: { ...this.include, deliveries: { orderBy: { sequence: 'asc' }, include: { driver: { include: { user: { select: { fullName: true, phone: true } } } }, vehicle: true } } },
    });
    if (!order) throw DomainError.notFound('Buyurtma');
    return order;
  }

  // ───────── buyruqlar ─────────

  /** Quruvchi (CONTRACTOR a'zosi) yoki Tadbirkor (mijoz nomidan — clientOrgId beriladi). */
  async create(a: AuthContext, input: CreateOrderInput, clientOrgIdOverride?: string) {
    const clientOrgId = clientOrgIdOverride ?? a.orgId!;
    const mixes = await this.prisma.concreteMix.findMany({
      where: { id: { in: input.items.map((i) => i.mixId) }, organizationId: input.plantOrgId, isActive: true },
    });
    if (mixes.length !== new Set(input.items.map((i) => i.mixId)).size) throw new DomainError('VALIDATION', 'Marka topilmadi yoki faol emas');
    if (input.siteId) {
      const site = await this.prisma.constructionSite.findFirst({ where: { id: input.siteId, organizationId: clientOrgId } });
      if (!site) throw DomainError.notFound('Obyekt');
    }

    const items = input.items.map((i) => {
      const mix = mixes.find((m) => m.id === i.mixId)!;
      return {
        mixId: mix.id,
        gradeSnapshot: mix.grade,
        nameSnapshot: mix.name,
        volumeM3: new D(i.volumeM3),
        unitPriceSnapshot: mix.unitPrice, // narx snapshot — katalog keyin o'zgarsa ta'sir qilmaydi
      };
    });
    const totalVolume = items.reduce((s, i) => s.plus(i.volumeM3), new D(0));
    const totalAmount = items.reduce((s, i) => s.plus(i.volumeM3.mul(i.unitPriceSnapshot)), new D(0));

    return this.prisma.order.create({
      data: {
        plantOrgId: input.plantOrgId,
        clientOrgId,
        siteId: input.siteId,
        createdByUserId: a.userId,
        address: input.address,
        lat: input.location.lat,
        lng: input.location.lng,
        scheduledAt: input.scheduledAt,
        intervalMinutes: input.intervalMinutes,
        needsPump: input.needsPump,
        note: input.note,
        totalVolumeM3: totalVolume,
        totalAmount,
        items: { create: items },
      },
      include: this.include,
    });
  }

  async submit(a: AuthContext, id: string) {
    const order = await this.transition(a, id, 'SUBMITTED');
    // Kredit limiti — bloklamaydi, faqat bayroq; Tadbirkor tasdiqlashda ko'radi
    const credit = await this.creditCheck(order.plantOrgId, order.clientOrgId, order.totalAmount);
    this.events.emit(ORDER_EVENTS.submitted, { orderId: id, ...credit });
    return { ...order, credit };
  }

  async confirm(a: AuthContext, id: string, input: ConfirmInput) {
    const order = await this.get(a, id);
    if (order.plantOrgId !== a.orgId) throw DomainError.forbidden();
    this.assertTransition(order.status as OrderStatus, 'CONFIRMED', a.role!);

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const po of input.priceOverrides ?? []) {
        await tx.orderItem.updateMany({ where: { id: po.itemId, orderId: id }, data: { unitPriceSnapshot: new D(po.unitPrice) } });
      }
      const items = await tx.orderItem.findMany({ where: { orderId: id } });
      const fee = input.deliveryFee !== undefined ? new D(input.deliveryFee) : order.deliveryFee;
      const total = items.reduce((s, i) => s.plus(i.volumeM3.mul(i.unitPriceSnapshot)), new D(0)).plus(fee);
      return tx.order.update({
        where: { id },
        data: { status: 'CONFIRMED', confirmedAt: new Date(), scheduledAt: input.scheduledAt ?? order.scheduledAt, deliveryFee: fee, totalAmount: total, note: input.note ?? order.note },
        include: this.include,
      });
    });
    this.emitStatus(updated, order.status as OrderStatus, 'CONFIRMED', a.userId);
    this.events.emit(ORDER_EVENTS.confirmed, { orderId: id });
    return updated;
  }

  async reject(a: AuthContext, id: string, reason: string) {
    const order = await this.transition(a, id, 'REJECTED', { rejectReason: reason });
    this.events.emit(ORDER_EVENTS.rejected, { orderId: id, reason });
    return order;
  }

  async cancel(a: AuthContext, id: string, reason?: string) {
    const order = await this.get(a, id);
    const penalty = ['CONFIRMED', 'SCHEDULED'].includes(order.status)
      ? cancellationPenalty(order.totalAmount.toNumber(), order.scheduledAt, new Date(), await this.rules(order.plantOrgId))
      : 0;
    const updated = await this.transition(a, id, 'CANCELLED', { cancelReason: reason, cancelPenalty: new D(penalty) });
    this.events.emit(ORDER_EVENTS.cancelled, { orderId: id, penalty });
    return updated;
  }

  /** Tizim tomonidan (deliveries moduli hodisalari): SCHEDULED→IN_PROGRESS, IN_PROGRESS→DELIVERED. */
  async systemTransition(orderId: string, to: OrderStatus, byUserId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status === to) return order;
    if (!ORDER_TRANSITIONS.some((t) => t.from === order.status && t.to === to)) return order; // tizim o'tishi — jim
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: to, ...(to === 'DELIVERED' ? { completedAt: new Date() } : {}) },
    });
    this.emitStatus(updated, order.status as OrderStatus, to, byUserId);
    if (to === 'DELIVERED') this.events.emit(ORDER_EVENTS.delivered, { orderId });
    return updated;
  }

  async rules(plantOrgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: plantOrgId }, select: { settings: true } });
    return { ...DEFAULT_RULES, ...((org?.settings as object) ?? {}) };
  }

  // ───────── ichki ─────────

  private readonly include = {
    items: true,
    client: { select: { id: true, name: true } },
    plant: { select: { id: true, name: true } },
    site: { select: { id: true, name: true } },
  } satisfies Prisma.OrderInclude;

  private async transition(a: AuthContext, id: string, to: OrderStatus, extra: Prisma.OrderUpdateInput = {}) {
    const order = await this.get(a, id);
    // Egalik: Quruvchi faqat o'z tashkiloti buyurtmasini; Tadbirkor PLANT/CONTRACTOR — o'z tomonini
    this.assertTransition(order.status as OrderStatus, to, a.role!);
    const updated = await this.prisma.order.update({ where: { id }, data: { status: to, ...extra }, include: this.include });
    this.emitStatus(updated, order.status as OrderStatus, to, a.userId);
    return updated;
  }

  private assertTransition(from: OrderStatus, to: OrderStatus, role: Role) {
    if (!canTransition(ORDER_TRANSITIONS, from, to, role)) {
      throw new DomainError('ORDER_INVALID_TRANSITION', `${from} → ${to} (${role}) mumkin emas`, { from, to, role });
    }
  }

  private async creditCheck(plantOrgId: string, clientOrgId: string, newAmount: Prisma.Decimal) {
    const limit = await this.prisma.creditLimit.findUnique({ where: { plantOrgId_clientOrgId: { plantOrgId, clientOrgId } } });
    const agg = await this.prisma.invoice.aggregate({
      where: { clientOrgId, status: { in: ['OPEN', 'PARTIALLY_PAID'] }, order: { plantOrgId } },
      _sum: { amount: true, paidAmount: true },
    });
    const debt = (agg._sum.amount ?? new D(0)).minus(agg._sum.paidAmount ?? new D(0));
    const exceeded = limit ? debt.plus(newAmount).gt(limit.limitAmount) : false;
    return { debt: debt.toNumber(), limit: limit?.limitAmount.toNumber() ?? null, exceeded };
  }

  private emitStatus(order: { id: string; plantOrgId: string; clientOrgId: string }, from: OrderStatus, to: OrderStatus, byUserId: string) {
    const ev: OrderStatusChangedEvent = { orderId: order.id, plantOrgId: order.plantOrgId, clientOrgId: order.clientOrgId, from, to, byUserId };
    this.events.emit(ORDER_EVENTS.statusChanged, ev);
  }
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = startOfDay(d); x.setDate(x.getDate() + 1); return x; }
