import { Module } from '@nestjs/common';
import { DriversController, ReviewsController, WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({ controllers: [WorkersController, DriversController, ReviewsController], providers: [WorkersService] })
export class WorkersModule {}
