import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SuperAdminGuard } from '../../common/auth/superadmin';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminController, AppConfigController } from './admin.controller';
import { AdminHealthService } from './admin-health.service';
import { AdminService } from './admin.service';
import { ErrorStatsInterceptor } from './error-stats';

/**
 * Superadmin (platforma boshqaruvi). PrismaModule, RedisModule, PushModule global.
 * ErrorStatsInterceptor global — /admin/health dagi xatolar sanog'i uchun barcha so'rovlarni kuzatadi.
 */
@Module({
  controllers: [AdminController, AppConfigController],
  providers: [AdminService, AdminHealthService, SuperAdminGuard, AdminAuditInterceptor, { provide: APP_INTERCEPTOR, useClass: ErrorStatsInterceptor }],
})
export class AdminModule {}
