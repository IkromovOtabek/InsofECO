import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ExpenseCreateSchema, IncomeCreateSchema } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthContext } from '../../common/auth/decorators';

const D = Prisma.Decimal;
const monthStart = (d: Date, shift = 0) => new Date(d.getFullYear(), d.getMonth() + shift, 1);

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tadbirkor: daromad/xarajat/foyda, manba va kategoriya bo'yicha, 6 oylik seriya. */
  async summary(a: AuthContext) {
    const orgId = a.orgId!;
    const now = new Date();
    const from6 = monthStart(now, -5);
    const [incBySrc, expByCat, expected, incomes, expenses, todayExp] = await Promise.all([
      this.prisma.income.groupBy({ by: ['source'], where: { organizationId: orgId, isExpected: false }, _sum: { amount: true } }),
      this.prisma.expense.groupBy({ by: ['category'], where: { organizationId: orgId }, _sum: { amount: true } }),
      this.prisma.income.aggregate({ where: { organizationId: orgId, isExpected: true }, _sum: { amount: true } }),
      this.prisma.income.findMany({ where: { organizationId: orgId, isExpected: false, date: { gte: from6 } }, select: { amount: true, date: true } }),
      this.prisma.expense.findMany({ where: { organizationId: orgId, date: { gte: from6 } }, select: { amount: true, date: true } }),
      this.prisma.expense.aggregate({ where: { organizationId: orgId, date: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } }, _sum: { amount: true } }),
    ]);
    const income = incBySrc.reduce((s, i) => s.plus(i._sum.amount ?? 0), new D(0));
    const expense = expByCat.reduce((s, e) => s.plus(e._sum.amount ?? 0), new D(0));
    const months = Array.from({ length: 6 }, (_, i) => {
      const m = monthStart(now, i - 5);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      const inM = incomes.filter((x) => x.date >= m && x.date < monthStart(m, 1)).reduce((s, x) => s.plus(x.amount), new D(0));
      const exM = expenses.filter((x) => x.date >= m && x.date < monthStart(m, 1)).reduce((s, x) => s.plus(x.amount), new D(0));
      return { month: key, label: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'][m.getMonth()], income: inM, expense: exM };
    });
    return {
      income, expense, profit: income.minus(expense), expectedIncome: expected._sum.amount ?? new D(0), todayExpense: todayExp._sum.amount ?? new D(0),
      incomeBySource: incBySrc.map((i) => ({ source: i.source, amount: i._sum.amount ?? new D(0) })),
      expenseByCategory: expByCat.map((e) => ({ category: e.category, amount: e._sum.amount ?? new D(0) })).sort((x, y) => y.amount.comparedTo(x.amount)),
      months,
    };
  }

  expenses(a: AuthContext, projectId?: string) {
    return this.prisma.expense.findMany({ where: { organizationId: a.orgId!, ...(projectId ? { projectId } : {}) }, include: { project: { select: { name: true } } }, orderBy: { date: 'desc' }, take: 100 });
  }
  incomes(a: AuthContext, projectId?: string) {
    return this.prisma.income.findMany({ where: { organizationId: a.orgId!, ...(projectId ? { projectId } : {}) }, include: { project: { select: { name: true } } }, orderBy: { date: 'desc' }, take: 100 });
  }

  async addExpense(a: AuthContext, input: z.infer<typeof ExpenseCreateSchema>) {
    const e = await this.prisma.expense.create({ data: { organizationId: a.orgId!, createdByUserId: a.userId, ...input, amount: new D(input.amount) } });
    if (input.projectId) await this.prisma.project.update({ where: { id: input.projectId }, data: { spent: { increment: input.amount } } });
    return e;
  }
  addIncome(a: AuthContext, input: z.infer<typeof IncomeCreateSchema>) {
    return this.prisma.income.create({ data: { organizationId: a.orgId!, ...input, amount: new D(input.amount) } });
  }

  /** Quruvchi / Haydovchi: bugun, hafta, oy; to'langan/kutilayotgan; ro'yxat. */
  async myEarnings(a: AuthContext) {
    const now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week = new Date(day); week.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    const month = monthStart(now);
    const all = await this.prisma.payout.findMany({ where: { userId: a.userId, organizationId: a.orgId! }, orderBy: { earnedAt: 'desc' }, include: { workOrder: { select: { number: true, title: true } }, shipment: { select: { number: true, cargo: true } } } });
    const sum = (f: (p: (typeof all)[number]) => boolean) => all.filter(f).reduce((s, p) => s.plus(p.amount), new D(0));
    return {
      today: sum((p) => p.earnedAt >= day), week: sum((p) => p.earnedAt >= week), month: sum((p) => p.earnedAt >= month),
      monthPaid: sum((p) => p.earnedAt >= month && p.status === 'PAID'), monthPending: sum((p) => p.earnedAt >= month && p.status === 'PENDING'),
      total: sum(() => true), items: all.slice(0, 100),
    };
  }
}
