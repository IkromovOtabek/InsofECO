import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AuthContext, CurrentUser } from '../../common/auth/decorators';
import { SuperAdminGuard } from '../../common/auth/superadmin';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminHealthService } from './admin-health.service';
import { AdminService } from './admin.service';
import {
  BlockInput, BlockSchema, BroadcastInput, BroadcastSchema, ConfigKey, ConfigSetInput, ConfigSetSchema,
  MembershipPatchSchema, MembershipSetInput, MembershipSetSchema, OrgListQuery, PageQuery, UserListQuery,
} from './admin.schemas';

const Id = z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/);
/** Mutatsiyalar uchun qattiqroq chegara. */
const WRITE = { default: { limit: 20, ttl: 60_000 } };

/**
 * Superadmin API — /v1/admin/*.
 * Himoya qatlamlari: global JwtAuthGuard (token, bloklanmagan foydalanuvchi) → PolicyGuard →
 * SuperAdminGuard (har so'rovda bazadan `isSuperAdmin`, aks holda 404) → audit jurnali.
 * Rate limit: o'qish 60/daq, yozish 20/daq, ommaviy xabar 3/daq.
 */
@Controller({ path: 'admin', version: '1' })
@UseGuards(SuperAdminGuard)
@UseInterceptors(AdminAuditInterceptor)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly health: AdminHealthService,
  ) {}

  @Get('health')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getHealth() {
    return this.health.snapshot();
  }

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  // ── Tashkilotlar ──
  @Get('organizations')
  organizations(@Query(Zod(OrgListQuery)) q: OrgListQuery) {
    return this.admin.organizations(q);
  }

  @Get('organizations/:id')
  organization(@Param('id', Zod(Id)) id: string) {
    return this.admin.organization(id);
  }

  @Post('organizations/:id/block')
  @HttpCode(200)
  @Throttle(WRITE)
  blockOrg(@Param('id', Zod(Id)) id: string, @Body(Zod(BlockSchema)) body: BlockInput) {
    return this.admin.blockOrganization(id, body);
  }

  @Post('organizations/:id/unblock')
  @HttpCode(200)
  @Throttle(WRITE)
  unblockOrg(@Param('id', Zod(Id)) id: string) {
    return this.admin.unblockOrganization(id);
  }

  // ── Foydalanuvchilar ──
  @Get('users')
  users(@Query(Zod(UserListQuery)) q: UserListQuery) {
    return this.admin.users(q);
  }

  @Get('users/:id')
  user(@Param('id', Zod(Id)) id: string) {
    return this.admin.user(id);
  }

  @Post('users/:id/block')
  @HttpCode(200)
  @Throttle(WRITE)
  blockUser(@CurrentUser() a: AuthContext, @Param('id', Zod(Id)) id: string, @Body(Zod(BlockSchema)) body: BlockInput) {
    return this.admin.blockUser(a.userId, id, body);
  }

  @Post('users/:id/unblock')
  @HttpCode(200)
  @Throttle(WRITE)
  unblockUser(@CurrentUser() a: AuthContext, @Param('id', Zod(Id)) id: string) {
    return this.admin.unblockUser(a.userId, id);
  }

  @Post('users/:id/sessions/revoke')
  @HttpCode(200)
  @Throttle(WRITE)
  revokeSessions(@CurrentUser() a: AuthContext, @Param('id', Zod(Id)) id: string) {
    return this.admin.revokeSessions(a.userId, id);
  }

  @Post('users/:id/memberships')
  @HttpCode(200)
  @Throttle(WRITE)
  setMembership(@CurrentUser() a: AuthContext, @Param('id', Zod(Id)) id: string, @Body(Zod(MembershipSetSchema)) body: MembershipSetInput) {
    return this.admin.setMembership(a.userId, id, body);
  }

  @Patch('users/:id/memberships/:membershipId')
  @Throttle(WRITE)
  patchMembership(@CurrentUser() a: AuthContext, @Param('id', Zod(Id)) id: string, @Param('membershipId', Zod(Id)) membershipId: string, @Body(Zod(MembershipPatchSchema)) body: { isActive: boolean }) {
    return this.admin.patchMembership(a.userId, id, membershipId, body.isActive);
  }

  // ── Ommaviy bildirishnoma ──
  @Post('broadcast')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  broadcast(@CurrentUser() a: AuthContext, @Body(Zod(BroadcastSchema)) body: BroadcastInput) {
    return this.admin.broadcast(a.userId, body);
  }

  // ── Sozlamalar / feature flag ──
  @Get('config')
  config() {
    return this.admin.configList();
  }

  @Put('config/:key')
  @Throttle(WRITE)
  setConfig(@CurrentUser() a: AuthContext, @Param('key', Zod(ConfigKey)) key: string, @Body(Zod(ConfigSetSchema)) body: ConfigSetInput) {
    return this.admin.configSet(a.userId, key, body);
  }

  @Delete('config/:key')
  @Throttle(WRITE)
  deleteConfig(@Param('key', Zod(ConfigKey)) key: string) {
    return this.admin.configDelete(key);
  }

  // ── Jurnal ──
  @Get('audit')
  audit(@Query(Zod(PageQuery)) q: z.infer<typeof PageQuery>) {
    return this.admin.audit(q.limit, q.offset);
  }
}

/** Ilovaga ochiq sozlamalar (`isPublic`) — har qanday kirgan foydalanuvchi o'qiydi; yozish faqat /admin/config. */
@Controller({ path: 'app-config', version: '1' })
export class AppConfigController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  get() {
    return this.admin.publicConfig();
  }
}
