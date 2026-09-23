import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { ConversationCreateSchema } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(a: AuthContext) {
    const cs = await this.prisma.conversation.findMany({
      where: { organizationId: a.orgId!, participants: { some: { userId: a.userId } } },
      include: {
        participants: { include: { user: { select: { id: true, fullName: true, phone: true, memberships: { where: { organizationId: a.orgId! }, select: { role: true } } } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { fullName: true } } } },
        project: { select: { name: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
    return Promise.all(cs.map(async (c) => {
      const me = c.participants.find((p) => p.userId === a.userId)!;
      const unread = await this.prisma.message.count({ where: { conversationId: c.id, createdAt: { gt: me.lastReadAt }, senderId: { not: a.userId } } });
      const others = c.participants.filter((p) => p.userId !== a.userId).map((p) => ({ id: p.user.id, fullName: p.user.fullName, role: p.user.memberships[0]?.role ?? null }));
      return { id: c.id, type: c.type, title: c.title ?? c.project?.name ?? others.map((o) => o.fullName).join(', '), others, lastMessage: c.messages[0] ?? null, lastMessageAt: c.lastMessageAt, unread };
    }));
  }

  /** DIRECT: mavjud bo'lsa qaytaradi. */
  async create(a: AuthContext, input: z.infer<typeof ConversationCreateSchema>) {
    const ids = Array.from(new Set([a.userId, ...input.participantUserIds]));
    if (input.type === 'DIRECT' && ids.length === 2) {
      const existing = await this.prisma.conversation.findFirst({ where: { organizationId: a.orgId!, type: 'DIRECT', AND: ids.map((id) => ({ participants: { some: { userId: id } } })) } });
      if (existing) return existing;
    }
    return this.prisma.conversation.create({ data: { organizationId: a.orgId!, type: input.type, title: input.title, projectId: input.projectId, participants: { create: ids.map((userId) => ({ userId })) } } });
  }

  async messages(a: AuthContext, conversationId: string, since?: Date) {
    await this.member(a, conversationId);
    const msgs = await this.prisma.message.findMany({ where: { conversationId, ...(since ? { createdAt: { gt: since } } : {}) }, include: { sender: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' }, take: 200 });
    await this.prisma.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId: a.userId } }, data: { lastReadAt: new Date() } });
    return msgs;
  }

  async send(a: AuthContext, conversationId: string, text: string) {
    await this.member(a, conversationId);
    const m = await this.prisma.message.create({ data: { conversationId, senderId: a.userId, text }, include: { sender: { select: { id: true, fullName: true } } } });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: m.createdAt } });
    const others = await this.prisma.conversationParticipant.findMany({ where: { conversationId, userId: { not: a.userId } }, select: { userId: true } });
    this.events.emit('message.sent', { conversationId, text, senderName: m.sender.fullName, toUserIds: others.map((o) => o.userId) });
    return m;
  }

  /** Suhbatdoshlar ro'yxati (tashkilot a'zolari). */
  contacts(a: AuthContext) {
    return this.prisma.membership.findMany({ where: { organizationId: a.orgId!, isActive: true, userId: { not: a.userId } }, select: { role: true, user: { select: { id: true, fullName: true, phone: true } } }, orderBy: { role: 'asc' } });
  }

  private async member(a: AuthContext, conversationId: string) {
    const p = await this.prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId: a.userId } } });
    if (!p) throw DomainError.notFound('Suhbat');
  }
}
