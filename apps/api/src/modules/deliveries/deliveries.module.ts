import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersModule } from '../orders/orders.module';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { SlaProcessor } from './sla.processor';

export const SLA_QUEUE = 'sla';

/** ioredis `url` kalitini qabul qilmaydi — REDIS_URL ni host/port ga ajratamiz. */
export function redisConnection() {
  const u = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return { host: u.hostname, port: Number(u.port || 6379), password: u.password || undefined, db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0 };
}

@Module({
  imports: [
    OrdersModule,
    // forRoot — AppModule'da (global config); bu yerda connection aniq beriladi, chunki registerQueue root configni faqat AppModule'dan oladi
    BullModule.registerQueue({ name: SLA_QUEUE, connection: redisConnection() }),
  ],
  controllers: [DeliveriesController],
  providers: [DeliveriesService, SlaProcessor],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
