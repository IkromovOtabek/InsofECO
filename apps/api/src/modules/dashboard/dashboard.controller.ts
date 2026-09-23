import { Controller, Get } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';

const D = Prisma.Decimal;

/** Rolga qarab bosh sahifa KPI'lari — bitta so'rovda. */
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly prisma: PrismaService, private readonly finance: FinanceService) {}

  @Roles('TADBIRKOR') @Get('tadbirkor')
  async tadbirkor(@CurrentUser() a: AuthContext) {
    const orgId = a.orgId!;
    const now = new Date();
    const [projects, activeOrders, openOrders, finishing, workers, drivers, materials, shipmentsEnRoute, workingWorkers, fin, pendingRequests, lateProjects, recentNotifs, tasksByStatus] = await Promise.all([
      this.prisma.project.groupBy({ by: ['status'], where: { organizationId: orgId }, _count: true }),
      this.prisma.workOrder.count({ where: { organizationId: orgId, status: { in: ['ACCEPTED', 'WORKER_ASSIGNED', 'IN_PROGRESS', 'REVIEW'] } } }),
      this.prisma.workOrder.count({ where: { organizationId: orgId, status: 'NEW' } }),
      this.prisma.workOrder.count({ where: { organizationId: orgId, status: 'REVIEW' } }),
      this.prisma.membership.count({ where: { organizationId: orgId, role: 'QURUVCHI', isActive: true } }),
      this.prisma.membership.count({ where: { organizationId: orgId, role: 'HAYDOVCHI', isActive: true } }),
      this.prisma.material.findMany({ where: { organizationId: orgId }, include: { inventory: true } }),
      this.prisma.shipment.count({ where: { organizationId: orgId, status: { in: ['LOADING', 'EN_ROUTE'] } } }),
      this.prisma.workOrder.findMany({ where: { organizationId: orgId, status: 'IN_PROGRESS', workerUserId: { not: null } }, select: { workerUserId: true }, distinct: ['workerUserId'] }),
      this.finance.summary(a),
      this.prisma.materialRequest.count({ where: { organizationId: orgId, status: 'PENDING' } }),
      this.prisma.project.count({ where: { organizationId: orgId, OR: [{ status: 'DELAYED' }, { status: 'ACTIVE', deadline: { lt: now } }] } }),
      this.prisma.notification.findMany({ where: { userId: a.userId }, orderBy: { createdAt: 'desc' }, take: 5 }),
      this.prisma.task.groupBy({ by: ['status'], where: { project: { organizationId: orgId } }, _count: true }),
    ]);
    const lowMaterials = materials.filter((m) => m.inventory.reduce((s, i) => s.plus(i.quantity), new D(0)).lte(m.minStock));
    const projList = await this.prisma.project.findMany({ where: { organizationId: orgId, status: { in: ['ACTIVE', 'DELAYED'] } }, select: { id: true, name: true, progress: true, status: true, budget: true, spent: true, deadline: true }, orderBy: { updatedAt: 'desc' }, take: 6 });
    const count = (s: string) => projects.find((p) => p.status === s)?._count ?? 0;
    return {
      kpi: {
        activeProjects: count('ACTIVE') + count('DELAYED'), delayedProjects: lateProjects, activeOrders, openOrders, finishingOrders: finishing,
        workers, workingWorkers: workingWorkers.length, drivers, shipmentsEnRoute, lowMaterials: lowMaterials.length, pendingRequests,
        todayExpense: fin.todayExpense, income: fin.income, expense: fin.expense, profit: fin.profit, expectedIncome: fin.expectedIncome,
      },
      statusLines: [
        { icon: '🟢', text: `${count('ACTIVE')} ta loyiha faol` },
        { icon: '🟡', text: `${lateProjects} ta loyiha kechikmoqda` },
        { icon: '🔴', text: `${lowMaterials.length} ta material yetishmayapti` },
        { icon: '🚚', text: `${shipmentsEnRoute} ta transport yo'lda` },
        { icon: '👷', text: `${workingWorkers.length} ta quruvchi ishlamoqda` },
      ],
      months: fin.months, expenseByCategory: fin.expenseByCategory, projects: projList,
      lowMaterials: lowMaterials.map((m) => ({ id: m.id, name: m.name, unit: m.unit, stock: m.inventory.reduce((s, i) => s.plus(i.quantity), new D(0)), minStock: m.minStock })),
      tasks: tasksByStatus.map((t) => ({ status: t.status, count: t._count })), notifications: recentNotifs,
    };
  }

  @Roles('QURUVCHI') @Get('quruvchi')
  async quruvchi(@CurrentUser() a: AuthContext) {
    const day = new Date(); day.setHours(0, 0, 0, 0);
    const [todayTasks, activeOrders, done, earnings, profile, openOrders] = await Promise.all([
      this.prisma.task.findMany({ where: { assigneeUserId: a.userId, status: { not: 'DONE' }, OR: [{ dueDate: { lte: new Date(day.getTime() + 86_400_000) } }, { dueDate: null }] }, include: { project: { select: { name: true } } }, orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }], take: 10 }),
      this.prisma.workOrder.findMany({ where: { workerUserId: a.userId, status: { in: ['WORKER_ASSIGNED', 'IN_PROGRESS', 'REVIEW'] } }, include: { project: { select: { name: true } } } }),
      this.prisma.workOrder.count({ where: { workerUserId: a.userId, status: { in: ['DONE', 'PAID'] } } }),
      this.finance.myEarnings(a),
      this.prisma.workerProfile.findUnique({ where: { userId: a.userId } }),
      this.prisma.workOrder.count({ where: { organizationId: a.orgId!, status: 'ACCEPTED', workerUserId: null } }),
    ]);
    return { todayTasks, activeOrders, doneCount: done, openOrders, earnings, profile };
  }

  @Roles('HAYDOVCHI') @Get('haydovchi')
  async haydovchi(@CurrentUser() a: AuthContext) {
    const day = new Date(); day.setHours(0, 0, 0, 0);
    const [todayAll, active, vehicle, earnings, open] = await Promise.all([
      this.prisma.shipment.findMany({ where: { driverUserId: a.userId, OR: [{ createdAt: { gte: day } }, { status: { in: ['ACCEPTED', 'LOADING', 'EN_ROUTE'] } }] }, select: { id: true, status: true } }),
      this.prisma.shipment.findFirst({ where: { driverUserId: a.userId, status: { in: ['ACCEPTED', 'LOADING', 'EN_ROUTE'] } }, include: { project: { select: { name: true, address: true } }, warehouse: { select: { name: true } } } }),
      this.prisma.vehicle.findFirst({ where: { driverUserId: a.userId, isActive: true } }),
      this.finance.myEarnings(a),
      this.prisma.shipment.findMany({ where: { organizationId: a.orgId!, status: 'NEW', driverUserId: null }, include: { project: { select: { name: true } }, warehouse: { select: { name: true } } }, take: 5 }),
    ]);
    return { todayCount: todayAll.length, doneToday: todayAll.filter((s) => ['DELIVERED', 'CONFIRMED'].includes(s.status)).length, pending: todayAll.filter((s) => !['DELIVERED', 'CONFIRMED', 'CANCELLED'].includes(s.status)).length, active, vehicle, earnings, open };
  }
}
