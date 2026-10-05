import { MessagesService } from './messages.service';

const a = { userId: 'u1', role: 'TADBIRKOR' as const, orgId: 'org', sessionId: 'x' };

describe('MessagesService', () => {
  it('list: o\'qilmaganlar bitta guruhlangan so\'rov bilan (N+1 yo\'q)', async () => {
    const conv = (id: string) => ({ id, type: 'DIRECT', title: null, project: null, lastMessageAt: new Date(), messages: [], participants: [{ userId: 'u1', user: { id: 'u1', fullName: 'Men', memberships: [] } }, { userId: 'u2', user: { id: 'u2', fullName: 'U2', memberships: [{ role: 'QURUVCHI' }] } }] });
    const prisma = {
      conversation: { findMany: jest.fn().mockResolvedValue([conv('c1'), conv('c2'), conv('c3')]) },
      message: { count: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ conversationId: 'c1', unread: BigInt(3) }, { conversationId: 'c3', unread: BigInt(1) }]),
    };
    const svc = new MessagesService(prisma as never, { emit: jest.fn() } as never);
    const res = await svc.list(a);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.message.count).not.toHaveBeenCalled();
    expect(res.map((r) => r.unread)).toEqual([3, 0, 1]);
    const sql = prisma.$queryRaw.mock.calls[0][0];
    expect(sql.values).toEqual(expect.arrayContaining(['u1', 'c1', 'c2', 'c3']));
  });

  it('create: kontaktlarda yo\'q foydalanuvchi bilan suhbat — rad etiladi', async () => {
    const prisma = {
      membership: { findMany: jest.fn().mockResolvedValue([{ userId: 'u2' }]) },
      conversation: { findFirst: jest.fn(), create: jest.fn() },
    };
    const svc = new MessagesService(prisma as never, { emit: jest.fn() } as never);
    await expect(svc.create(a, { type: 'GROUP', participantUserIds: ['u2', 'stranger'] } as never)).rejects.toThrow();
    expect(prisma.membership.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org', isActive: true, user: { isSuperAdmin: false }, userId: { in: ['u2', 'stranger'] } }),
    }));
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });
});
