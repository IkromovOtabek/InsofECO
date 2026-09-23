import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { DashboardController } from './dashboard.controller';

@Module({ imports: [FinanceModule], controllers: [DashboardController] })
export class DashboardModule {}
