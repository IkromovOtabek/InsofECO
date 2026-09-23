import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { PhoneSchema } from '@insof/shared';
import { AuthContext, CurrentUser, Public, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { OrganizationsService } from './organizations.service';

const CreateOrgSchema = z.object({
  type: z.enum(['PLANT', 'CONTRACTOR']),
  name: z.string().min(2).max(120),
  inn: z.string().regex(/^\d{9}$/).optional(),
  address: z.string().max(200).optional(),
});
const InviteSchema = z.object({ phone: PhoneSchema, role: z.enum(['TADBIRKOR', 'QURUVCHI', 'HAYDOVCHI']), fullName: z.string().max(80).optional() });
const VehicleSchema = z.object({ plateNumber: z.string().min(5).max(12), capacityM3: z.number().positive().max(20), type: z.enum(['MIXER', 'PUMP', 'DUMP']).optional() });

@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  create(@CurrentUser() a: AuthContext, @Body(Zod(CreateOrgSchema)) body: z.infer<typeof CreateOrgSchema>) {
    return this.orgs.create(a.userId, body);
  }

  /** Ro'yxatdan o'tishda (tokensiz) ham kerak. */
  @Public()
  @Get('plants')
  plants() {
    return this.orgs.plants();
  }

  @Roles('TADBIRKOR')
  @Get('members')
  members(@CurrentUser() a: AuthContext) {
    return this.orgs.members(a.orgId!);
  }

  @Roles('TADBIRKOR')
  @Post('members/invite')
  invite(@CurrentUser() a: AuthContext, @Body(Zod(InviteSchema)) body: z.infer<typeof InviteSchema>) {
    return this.orgs.invite(a.orgId!, body.phone, body.role, body.fullName, a.userId);
  }

  @Roles('TADBIRKOR') @Post('members/:id/approve') @HttpCode(200)
  approve(@CurrentUser() a: AuthContext, @Param('id') id: string) { return this.orgs.approve(a.orgId!, id, a.userId); }

  @Roles('TADBIRKOR') @Post('members/:id/remove') @HttpCode(200)
  remove(@CurrentUser() a: AuthContext, @Param('id') id: string) { return this.orgs.remove(a.orgId!, id, a.userId); }

  @Roles('TADBIRKOR', 'HAYDOVCHI')
  @Get('vehicles')
  vehicles(@CurrentUser() a: AuthContext) {
    return this.orgs.vehicles(a.orgId!);
  }

  @Roles('TADBIRKOR')
  @Post('vehicles')
  addVehicle(@CurrentUser() a: AuthContext, @Body(Zod(VehicleSchema)) body: z.infer<typeof VehicleSchema>) {
    return this.orgs.addVehicle(a.orgId!, body, a.userId);
  }
}
