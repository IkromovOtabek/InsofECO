import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthContext, CurrentUser } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { NotificationsService } from './notifications.service';

const ReadSchema = z.object({ ids: z.array(z.string()).min(1).max(100) });

@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly n: NotificationsService) {}

  @Get()
  list(@CurrentUser() a: AuthContext) {
    return this.n.list(a.userId);
  }

  @Post('read') @HttpCode(204)
  async read(@CurrentUser() a: AuthContext, @Body(Zod(ReadSchema)) b: { ids: string[] }) {
    await this.n.markRead(a.userId, b.ids);
  }
}
