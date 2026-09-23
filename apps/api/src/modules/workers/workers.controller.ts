import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ReviewCreateSchema, Specialty, WorkerProfileUpdateSchema } from '@insof/shared';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { WorkersService } from './workers.service';

const VehicleSchema = z.object({
  plateNumber: z.string().min(5).max(12), type: z.enum(['MIXER', 'PUMP', 'DUMP', 'TRUCK', 'PICKUP']).default('TRUCK'), brand: z.string().max(40).optional(),
  capacityM3: z.number().nonnegative().default(0), capacityTons: z.number().nonnegative().optional(), fuelPercent: z.number().int().min(0).max(100).optional(),
  odometerKm: z.number().int().nonnegative().optional(), nextServiceAt: z.coerce.date().optional(), driverUserId: z.string().nullable().optional(),
});

@Controller({ path: 'workers', version: '1' })
export class WorkersController {
  constructor(private readonly s: WorkersService) {}

  @Roles('TADBIRKOR', 'QURUVCHI') @Get()
  list(@CurrentUser() a: AuthContext, @Query('specialty') specialty?: Specialty) { return this.s.listWorkers(a, specialty); }

  @Roles('QURUVCHI') @Patch('me')
  updateMe(@CurrentUser() a: AuthContext, @Body(Zod(WorkerProfileUpdateSchema)) b: z.infer<typeof WorkerProfileUpdateSchema>) { return this.s.updateMyProfile(a, b); }

  @Roles('TADBIRKOR', 'QURUVCHI') @Get(':userId')
  detail(@CurrentUser() a: AuthContext, @Param('userId') userId: string) { return this.s.workerDetail(a, userId); }
}

@Controller({ path: 'drivers', version: '1' })
export class DriversController {
  constructor(private readonly s: WorkersService, private readonly prisma: PrismaService) {}

  @Roles('TADBIRKOR') @Get()
  list(@CurrentUser() a: AuthContext) { return this.s.listDrivers(a); }

  @Roles('TADBIRKOR', 'HAYDOVCHI') @Get('vehicles')
  vehicles(@CurrentUser() a: AuthContext) { return this.s.vehicles(a); }

  @Roles('HAYDOVCHI') @Get('vehicles/mine')
  mine(@CurrentUser() a: AuthContext) { return this.s.myVehicle(a); }

  @Roles('TADBIRKOR') @Post('vehicles')
  create(@CurrentUser() a: AuthContext, @Body(Zod(VehicleSchema)) b: z.infer<typeof VehicleSchema>) { return this.prisma.vehicle.create({ data: { organizationId: a.orgId!, ...b } }); }

  @Roles('TADBIRKOR') @Patch('vehicles/:id')
  async update(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(VehicleSchema.partial())) b: Partial<z.infer<typeof VehicleSchema>>) {
    await this.prisma.vehicle.updateMany({ where: { id, organizationId: a.orgId! }, data: b });
    return this.prisma.vehicle.findUnique({ where: { id } });
  }
}

@Controller({ path: 'reviews', version: '1' })
export class ReviewsController {
  constructor(private readonly s: WorkersService) {}

  @Roles('TADBIRKOR', 'QURUVCHI') @Post()
  create(@CurrentUser() a: AuthContext, @Body(Zod(ReviewCreateSchema)) b: z.infer<typeof ReviewCreateSchema>) { return this.s.createReview(a, b); }

  @Get()
  list(@Query('targetUserId') targetUserId: string) { return this.s.reviewsFor(targetUserId); }
}
