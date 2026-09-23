import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ProjectCreateSchema, ProjectUpdateSchema, TaskCreateSchema, TaskUpdateSchema } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';

const D = Prisma.Decimal;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Tadbirkor — tashkilotning barcha loyihalari; Quruvchi — a'zo bo'lgan loyihalar. */
  list(a: AuthContext) {
    return this.prisma.project.findMany({
      where: { organizationId: a.orgId!, ...(a.role === 'QURUVCHI' ? { members: { some: { userId: a.userId } } } : {}) },
      include: { _count: { select: { members: true, tasks: true, workOrders: true } }, tasks: { select: { status: true } } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async get(a: AuthContext, id: string) {
    const p = await this.prisma.project.findFirst({
      where: { id, organizationId: a.orgId!, ...(a.role === 'QURUVCHI' ? { members: { some: { userId: a.userId } } } : {}) },
      include: {
        tasks: { orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }], include: { assignee: { select: { id: true, fullName: true } } } },
        members: { include: { user: { select: { id: true, fullName: true, phone: true, workerProfile: true } } } },
        workOrders: { orderBy: { createdAt: 'desc' }, include: { worker: { select: { id: true, fullName: true } } } },
        materialRequests: { orderBy: { createdAt: 'desc' }, include: { material: true } },
        shipments: { orderBy: { createdAt: 'desc' }, take: 20, include: { driver: { select: { fullName: true } }, vehicle: true } },
        expenses: { orderBy: { date: 'desc' }, take: 50 },
        incomes: { orderBy: { date: 'desc' }, take: 50 },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!p) throw DomainError.notFound('Loyiha');
    const byCat = await this.prisma.expense.groupBy({ by: ['category'], where: { projectId: id }, _sum: { amount: true } });
    const income = await this.prisma.income.aggregate({ where: { projectId: id, isExpected: false }, _sum: { amount: true } });
    const expected = await this.prisma.income.aggregate({ where: { projectId: id, isExpected: true }, _sum: { amount: true } });
    return { ...p, expenseByCategory: byCat.map((c) => ({ category: c.category, amount: c._sum.amount ?? new D(0) })), incomeTotal: income._sum.amount ?? new D(0), expectedIncome: expected._sum.amount ?? new D(0) };
  }

  create(a: AuthContext, input: z.infer<typeof ProjectCreateSchema>) {
    return this.prisma.project.create({ data: { organizationId: a.orgId!, ...input, budget: new D(input.budget) } });
  }

  async update(a: AuthContext, id: string, input: z.infer<typeof ProjectUpdateSchema>) {
    const r = await this.prisma.project.updateMany({ where: { id, organizationId: a.orgId! }, data: { ...input, ...(input.budget !== undefined ? { budget: new D(input.budget) } : {}) } });
    if (r.count === 0) throw DomainError.notFound('Loyiha');
    return this.prisma.project.findUnique({ where: { id } });
  }

  async addMember(a: AuthContext, projectId: string, userId: string) {
    await this.own(a, projectId);
    const m = await this.prisma.membership.findFirst({ where: { userId, organizationId: a.orgId!, isActive: true } });
    if (!m) throw new DomainError('NOT_MEMBER', 'Bu foydalanuvchi tashkilot a\'zosi emas');
    return this.prisma.projectMember.upsert({ where: { projectId_userId: { projectId, userId } }, create: { projectId, userId, role: m.role }, update: {} });
  }

  // ───── Vazifalar ─────
  async createTask(a: AuthContext, projectId: string, input: z.infer<typeof TaskCreateSchema>) {
    await this.own(a, projectId);
    const count = await this.prisma.task.count({ where: { projectId } });
    return this.prisma.task.create({ data: { projectId, ...input, sortOrder: count } });
  }

  /** Quruvchi faqat o'ziga biriktirilgan vazifani (status/foto/izoh) yangilaydi; Tadbirkor hammasini. */
  async updateTask(a: AuthContext, taskId: string, input: z.infer<typeof TaskUpdateSchema>) {
    const t = await this.prisma.task.findFirst({ where: { id: taskId, project: { organizationId: a.orgId! } }, include: { project: true } });
    if (!t) throw DomainError.notFound('Vazifa');
    if (a.role === 'QURUVCHI') {
      if (t.assigneeUserId !== a.userId) throw DomainError.forbidden('Bu vazifa sizga biriktirilmagan');
      const { status, photoKeys, comment } = input;
      input = { status, photoKeys, comment };
    }
    const updated = await this.prisma.task.update({ where: { id: taskId }, data: { ...input, ...(input.status === 'DONE' ? { completedAt: new Date() } : {}) } });
    await this.recalcProgress(t.projectId);
    if (input.status === 'REVIEW') this.events.emit('task.submitted', { taskId, projectId: t.projectId, byUserId: a.userId, orgId: a.orgId });
    return updated;
  }

  myTasks(a: AuthContext) {
    return this.prisma.task.findMany({
      where: { assigneeUserId: a.userId, project: { organizationId: a.orgId! } },
      include: { project: { select: { id: true, name: true, address: true } } },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  /** Progress = bajarilgan vazifalar / jami (qo'lda override ham mumkin). */
  async recalcProgress(projectId: string) {
    const [total, done] = await Promise.all([this.prisma.task.count({ where: { projectId } }), this.prisma.task.count({ where: { projectId, status: 'DONE' } })]);
    if (total > 0) await this.prisma.project.update({ where: { id: projectId }, data: { progress: Math.round((done / total) * 100) } });
  }

  private async own(a: AuthContext, projectId: string) {
    const p = await this.prisma.project.findFirst({ where: { id: projectId, organizationId: a.orgId! } });
    if (!p) throw DomainError.notFound('Loyiha');
    return p;
  }
}
