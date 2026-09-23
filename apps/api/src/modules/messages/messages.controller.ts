import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ConversationCreateSchema, MessageCreateSchema } from '@insof/shared';
import { AuthContext, CurrentUser, Roles } from '../../common/auth/decorators';
import { Zod } from '../../common/validation/zod-validation.pipe';
import { MessagesService } from './messages.service';

@Controller({ path: 'conversations', version: '1' })
@Roles('TADBIRKOR', 'QURUVCHI', 'HAYDOVCHI')
export class MessagesController {
  constructor(private readonly s: MessagesService) {}

  @Get() list(@CurrentUser() a: AuthContext) { return this.s.list(a); }
  @Get('contacts') contacts(@CurrentUser() a: AuthContext) { return this.s.contacts(a); }
  @Post() create(@CurrentUser() a: AuthContext, @Body(Zod(ConversationCreateSchema)) b: z.infer<typeof ConversationCreateSchema>) { return this.s.create(a, b); }
  @Get(':id/messages') messages(@CurrentUser() a: AuthContext, @Param('id') id: string, @Query('since') since?: string) { return this.s.messages(a, id, since ? new Date(since) : undefined); }
  @Post(':id/messages') send(@CurrentUser() a: AuthContext, @Param('id') id: string, @Body(Zod(MessageCreateSchema)) b: { text: string }) { return this.s.send(a, id, b.text); }
}
