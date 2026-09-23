import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { WORK_ORDER_TRANSITIONS, WorkOrderCreateSchema, WorkOrderReviewSchema, WorkOrderStatus, WorkOrderSubmitSchema, canTransition } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';

const D = Prisma.Decimal;
const include = { project: { select: { id: true, name: true } }, worker: { select: { id: true, fullName: true, phone: true, workerProfile: true } } } satisfies Prisma.WorkOrderInclude;

/**
 * Ish buyurtmasi zanjiri: NEW → ACCEPTED → WORKER_ASSIGNED → IN_PROGRESS → REVIEW → DONE → PAID.
 * DONE: Payout (quruvchi daromadi) + Expense(WORKER) + Project.spent — bitta tranzaksiya.
 */
@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  list(a: AuthContext, status?: string) {
    return this.prisma.workOrder.findMany({
      where: {
        organizationId: a.orgId!,
        ...(a.role === 'QURUVCHI' ? { OR: [{ workerUserId: a.userId }, { workerUserId: null, status: 'ACCEPTED' }] } : {}),
        ...(status ? { status: { in: status.split(',') as WorkOrderStatus[] } } : {}),
      },
      include,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async get(a: AuthContext, id: string) {
    const wo = await this.prisma.workOrder.findFirst({ where: { id, organizationId: a.orgId! }, include: { ...include, payouts: true, reviews: true } });
    if (!wo) throw DomainError.notFound('Buyurtma');
    if (a.role === 'QURUVCHI' && wo.workerUserId && wo.workerUserId !== a.userId) throw DomainError.forbidden();
    return wo;
  }

  async create(a: AuthContext, input: z.infer<typeof WorkOrderCreateSchema>) {
    const wo = await this.prisma.workOrder.create({
      data: { organizationId: a.orgId!, createdByUserId: a.userId, ...input, price: new D(input.price), status: input.workerUserId ? 'WORKER_ASSIGNED' : 'NEW', acceptedAt: input.workerUserId ? new Date() : null },
      include,
    });
    if (input.workerUserId) this.events.emit('work_order.assigned', { workOrderId: wo.id, workerUserId: input.workerUserId, number: wo.number, title: wo.title });
    return wo;
  }

  async transition(a: AuthContext, id: string, to: WorkOrderStatus, extra: Prisma.WorkOrderUpdateInput = {}) {
    const wo = await this.get(a, id);
    if (!canTransition(WORK_ORDER_TRANSITIONS, wo.status as WorkOrderStatus, to, a.role!)) {
      throw new DomainError('ORDER_INVALID_TRANSITION', `${wo.status} → ${to} (${a.role}) mumkin emas`);
    }
    const stamps: Prisma.WorkOrderUpdateInput = { ACCEPTED: { acceptedAt: new Date() }, IN_PROGRESS: { startedAt: new Date() }, REVIEW: { submittedAt: new Date() }, DONE: { completedAt: new Date() }, PAID: { paidAt: new Date() } }[to as string] ?? {};
    const updated = await this.prisma.workOrder.update({ where: { id }, data: { status: to, ...stamps, ...extra }, include });
    this.events.emit('work_order.status_changed', { workOrderId: id, number: wo.number, title: wo.title, from: wo.status, to, orgId: a.orgId, workerUserId: updated.workerUserId, byUserId: a.userId });
    return updated;
  }

  async assign(a: AuthContext, id: string, workerUserId: string) {
    const w = await this.prisma.membership.findFirst({ where: { userId: workerUserId, organizationId: a.orgId!, role: 'QURUVCHI', isActive: true } });
    if (!w) throw DomainError.notFound('Quruvchi');
    const wo = await this.transition(a, id, 'WORKER_ASSIGNED', { worker: { connect: { id: workerUserId } } });
    this.events.emit('work_order.assigned', { workOrderId: id, workerUserId, number: wo.number, title: wo.title });
    return wo;
  }

  /** Quruvchi ochiq (ACCEPTED, workerUserId=null) buyurtmani o'ziga oladi va boshlaydi. */
  async take(a: AuthContext, id: string) {
    const wo = await this.get(a, id);
    if (wo.status === 'ACCEPTED' && !wo.workerUserId) {
      await this.prisma.workOrder.update({ where: { id }, data: { status: 'WORKER_ASSIGNED', workerUserId: a.userId } });
    }
    return this.transition(a, id, 'IN_PROGRESS');
  }

  submit(a: AuthContext, id: string, input: z.infer<typeof WorkOrderSubmitSchema>) {
    return this.transition(a, id, 'REVIEW', { photoKeys: input.photoKeys, workerComment: input.comment });
  }

  /** Tadbirkor tekshiradi: approve → DONE (+Payout +Expense +Project.spent +reyting), aks holda → IN_PROGRESS. */
  async review(a: AuthContext, id: string, input: z.infer<typeof WorkOrderReviewSchema>) {
    if (!input.approve) return this.transition(a, id, 'IN_PROGRESS', { reviewComment: input.comment });
    const wo = await this.get(a, id);
    if (wo.status !== 'REVIEW') throw new DomainError('ORDER_INVALID_TRANSITION', 'Faqat tekshiruvdagi ish yakunlanadi');
    await this.prisma.$transaction(async (tx) => {
      await tx.workOrder.update({ where: { id }, data: { status: 'DONE', completedAt: new Date(), reviewComment: input.comment } });
      if (wo.workerUserId) {
        await tx.payout.create({ data: { organizationId: a.orgId!, userId: wo.workerUserId, workOrderId: id, amount: wo.price, description: `№${wo.number} ${wo.title}` } });
        await tx.workerProfile.upsert({ where: { userId: wo.workerUserId }, create: { userId: wo.workerUserId, completedJobs: 1 }, update: { completedJobs: { increment: 1 } } });
        if (input.rating) {
          await tx.review.create({ data: { organizationId: a.orgId!, targetUserId: wo.workerUserId, authorUserId: a.userId, workOrderId: id, scoreOverall: input.rating, comment: input.comment } });
          const agg = await tx.review.aggregate({ where: { targetUserId: wo.workerUserId }, _avg: { scoreOverall: true }, _count: true });
          await tx.workerProfile.update({ where: { userId: wo.workerUserId }, data: { ratingAvg: agg._avg.scoreOverall ?? 0, ratingCount: agg._count } });
        }
      }
      await tx.expense.create({ data: { organizationId: a.orgId!, projectId: wo.projectId, category: 'WORKER', amount: wo.price, description: `Ish haqi: №${wo.number} ${wo.title}`, refType: 'WORK_ORDER', refId: id, createdByUserId: a.userId } });
      if (wo.projectId) await tx.project.update({ where: { id: wo.projectId }, data: { spent: { increment: wo.price } } });
    });
    this.events.emit('work_order.status_changed', { workOrderId: id, number: wo.number, title: wo.title, from: 'REVIEW', to: 'DONE', orgId: a.orgId, workerUserId: wo.workerUserId, byUserId: a.userId });
    return this.get(a, id);
  }

  /** To'lov: DONE → PAID, payout PAID. */
  async pay(a: AuthContext, id: string) {
    const wo = await this.transition(a, id, 'PAID');
    await this.prisma.payout.updateMany({ where: { workOrderId: id, status: 'PENDING' }, data: { status: 'PAID', paidAt: new Date() } });
    return wo;
  }
}
