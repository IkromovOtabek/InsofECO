import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ExpenseCreateSchema, IncomeCreateSchema } from '@insof/shared';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { FinanceService } from './finance.service';

@Controller({ path: 'finance', version: '1' })
export class FinanceController {
  constructor(private readonly s: FinanceService) {}

  @Roles('TADBIRKOR') @Get('overview')
  overview(@CurrentUser() a: AuthContext) { return this.s.summary(a); }

  @Roles('TADBIRKOR') @Get('expenses')
  expenses(@CurrentUser() a: AuthContext, @Query('projectId') projectId?: string) { return this.s.expenses(a, projectId); }

  @Roles('TADBIRKOR') @Get('incomes')
  incomes(@CurrentUser() a: AuthContext, @Query('projectId') projectId?: string) { return this.s.incomes(a, projectId); }

  @Roles('TADBIRKOR') @Post('expenses')
  addExpense(@CurrentUser() a: AuthContext, @Body(Zod(ExpenseCreateSchema)) b: z.infer<typeof ExpenseCreateSchema>) { return this.s.addExpense(a, b); }

  @Roles('TADBIRKOR') @Post('incomes')
  addIncome(@CurrentUser() a: AuthContext, @Body(Zod(IncomeCreateSchema)) b: z.infer<typeof IncomeCreateSchema>) { return this.s.addIncome(a, b); }

  @Roles('QURUVCHI', 'HAYDOVCHI', 'TADBIRKOR') @Get('my-earnings')
  my(@CurrentUser() a: AuthContext) { return this.s.myEarnings(a); }
}
