import { Body, Controller, Get, Put } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { PushTokenSchema } from '@insof/shared';
import { AuthContext, CurrentUser } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ORG_EVENTS, UserUpdatedEvent } from '../organizations/organizations.events';

const ProfileSchema = z.object({ fullName: z.string().min(2).max(80).optional(), locale: z.enum(['uz', 'uz-Cyrl', 'ru']).optional() });

@Controller({ path: 'me', version: '1' })
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  me(@CurrentUser() a: AuthContext) {
    return this.auth.profile(a.userId);
  }

  @Put()
  async update(@CurrentUser() a: AuthContext, @Body(Zod(ProfileSchema)) body: z.infer<typeof ProfileSchema>) {
    const before = await this.prisma.user.findUnique({ where: { id: a.userId }, select: { fullName: true } });
    await this.prisma.user.update({ where: { id: a.userId }, data: body });
    if (body.fullName && body.fullName !== before?.fullName) this.events.emit(ORG_EVENTS.userUpdated, { userId: a.userId, byUserId: a.userId } satisfies UserUpdatedEvent);
    return this.auth.profile(a.userId);
  }

  @Put('devices')
  async pushToken(@CurrentUser() a: AuthContext, @Body(Zod(PushTokenSchema)) body: z.infer<typeof PushTokenSchema>) {
    await this.prisma.device.updateMany({
      where: { userId: a.userId, deviceId: body.deviceId },
      data: { expoPushToken: body.expoPushToken, lastSeenAt: new Date() },
    });
    return { ok: true };
  }
}
