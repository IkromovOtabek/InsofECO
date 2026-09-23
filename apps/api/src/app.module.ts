import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { SmsModule } from './infra/sms/sms.module';
import { PushModule } from './infra/push/push.module';
import { StorageModule } from './infra/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { SitesModule } from './modules/sites/sites.module';
import { OrdersModule } from './modules/orders/orders.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { DeliveriesModule, redisConnection } from './modules/deliveries/deliveries.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { BillingModule } from './modules/billing/billing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
import { WorkersModule } from './modules/workers/workers.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { FinanceModule } from './modules/finance/finance.module';
import { MessagesModule } from './modules/messages/messages.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ErpIntegrationModule } from './modules/integrations/erp/erp.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { PolicyGuard } from './common/auth/policy.guard';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: ['req.headers.authorization', 'req.body.phone', 'req.body.code'],
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    BullModule.forRoot({ connection: redisConnection() }),
    PrismaModule,
    RedisModule,
    SmsModule,
    PushModule,
    StorageModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    CatalogModule,
    SitesModule,
    OrdersModule,
    DispatchModule,
    DeliveriesModule,
    TrackingModule,
    BillingModule,
    NotificationsModule,
    ProjectsModule,
    WorkOrdersModule,
    WorkersModule,
    MaterialsModule,
    ShipmentsModule,
    FinanceModule,
    MessagesModule,
    DashboardModule,
    ErpIntegrationModule,
  ],
  controllers: [HealthController],
  providers: [
    // Dev/smoke-test uchun o'chirish mumkin; prod'da har doim yoqiq
    ...(process.env.THROTTLE_DISABLED === 'true' && process.env.NODE_ENV !== 'production' ? [] : [{ provide: APP_GUARD, useClass: ThrottlerGuard }]),
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PolicyGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
