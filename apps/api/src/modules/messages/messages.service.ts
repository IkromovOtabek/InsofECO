import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ConversationCreateSchema } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';
import { VISIBLE_MEMBER } from '../../common/auth/superadmin';

/** Kontaktlar qoidasi (ro'yxat ham, suhbat ochish ham shu bitta predikatdan): shu tashkilotning faol, ko'rinadigan a'zolari. */
export function contactsWhere(a: AuthContext): Prisma.MembershipWhereInput {
  return { organizationId: a.orgId!, isActive: true, ...VISIBLE_MEMBER };
}

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
    const unreadBy = await this.unreadCounts(a.userId, cs.map((c) => c.id));
    return cs.map((c) => {
      const unread = unreadBy.get(c.id) ?? 0;
      const others = c.participants.filter((p) => p.userId !== a.userId).map((p) => ({ id: p.user.id, fullName: p.user.fullName, role: p.user.memberships[0]?.role ?? null }));
      return { id: c.id, type: c.type, title: c.title ?? c.project?.name ?? others.map((o) => o.fullName).join(', '), others, lastMessage: c.messages[0] ?? null, lastMessageAt: c.lastMessageAt, unread };
    });
  }

  /**
   * O'qilmaganlar soni — BITTA guruhlangan so'rov (avval har suhbat uchun alohida `count` — N+1 edi).
   * Parametrlar Prisma.sql orqali bog'lanadi (SQL injection yo'q).
   */
  async unreadCounts(userId: string, conversationIds: string[]): Promise<Map<string, number>> {
    if (!conversationIds.length) return new Map();
    const rows = await this.prisma.$queryRaw<{ conversationId: string; unread: bigint | number }[]>(Prisma.sql`
      SELECT m."conversationId" AS "conversationId", COUNT(*) AS "unread"
      FROM "Message" m
      JOIN "ConversationParticipant" p ON p."conversationId" = m."conversationId" AND p."userId" = ${userId}
      WHERE m."conversationId" IN (${Prisma.join(conversationIds)})
        AND m."createdAt" > p."lastReadAt"
        AND m."senderId" <> ${userId}
      GROUP BY m."conversationId"`);
    return new Map(rows.map((r) => [r.conversationId, Number(r.unread)]));
  }

  /** DIRECT: mavjud bo'lsa qaytaradi. */
  async create(a: AuthContext, input: z.infer<typeof ConversationCreateSchema>) {
    // IDOR: suhbatdosh faqat kontaktlar ro'yxatidagi odam bo'la oladi (shu tashkilotning faol, ko'rinadigan a'zosi).
    // Superadmin ham shu qoida bilan chiqib ketadi (VISIBLE_MEMBER).
    const requested = Array.from(new Set(input.participantUserIds.filter((id) => id !== a.userId)));
    if (requested.length) {
      const allowed = await this.prisma.membership.findMany({ where: { ...contactsWhere(a), userId: { in: requested } }, select: { userId: true }, distinct: ['userId'] });
      if (allowed.length !== requested.length) throw DomainError.forbidden("Suhbatdosh kontaktlaringiz ro'yxatida yo'q");
    }
    if (input.projectId) {
      const p = await this.prisma.project.findFirst({ where: { id: input.projectId, organizationId: a.orgId! }, select: { id: true } });
      if (!p) throw DomainError.notFound('Loyiha');
    }
    const ids = [a.userId, ...requested];
    if (input.type === 'DIRECT' && ids.length === 2) {
      const existing = await this.prisma.conversation.findFirst({ where: { organizationId: a.orgId!, type: 'DIRECT', AND: ids.map((id) => ({ participants: { some: { userId: id } } })) } });
      if (existing) return existing;
    }
    return this.prisma.conversation.create({ data: { organizationId: a.orgId!, type: input.type, title: input.title, projectId: input.projectId, participants: { create: ids.map((userId) => ({ userId })) } } });
  }

  async messages(a: AuthContext, conversationId: string, since?: Date) {
    await this.member(a, conversationId);
    // `since` siz — OXIRGI 200 ta (eskisidan yangisiga). Avval `asc + take` ENG ESKI 200 tani berardi:
    // 200 dan oshgan suhbatda yangi xabarlar umuman ko'rinmay qolardi.
    const msgs = since
      ? await this.prisma.message.findMany({ where: { conversationId, createdAt: { gt: since } }, include: { sender: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' }, take: 200 })
      : (await this.prisma.message.findMany({ where: { conversationId }, include: { sender: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 200 })).reverse();
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
    return this.prisma.membership.findMany({ where: { ...contactsWhere(a), userId: { not: a.userId } }, select: { role: true, user: { select: { id: true, fullName: true, phone: true } } }, orderBy: { role: 'asc' } });
  }

  private async member(a: AuthContext, conversationId: string) {
    const p = await this.prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId: a.userId } } });
    if (!p) throw DomainError.notFound('Suhbat');
  }
}
