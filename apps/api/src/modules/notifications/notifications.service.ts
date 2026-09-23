import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PushService } from '../../infra/push/push.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /** In-app yozuv + push (barcha qurilmalarga). */
  async notifyUsers(userIds: string[], n: { type: string; title: string; body: string; data?: Record<string, unknown> }) {
    if (userIds.length === 0) return;
    await this.prisma.notification.createMany({ data: userIds.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body, data: (n.data ?? {}) as Prisma.InputJsonObject })) });
    const devices = await this.prisma.device.findMany({ where: { userId: { in: userIds }, expoPushToken: { not: null } }, select: { expoPushToken: true } });
    await this.push.send({ to: devices.map((d) => d.expoPushToken!), title: n.title, body: n.body, data: n.data });
  }

  /** Tashkilotdagi rol egalariga. */
  async notifyOrgRole(orgId: string, role: Role, n: Parameters<NotificationsService['notifyUsers']>[1]) {
    const ms = await this.prisma.membership.findMany({ where: { organizationId: orgId, role, isActive: true }, select: { userId: true } });
    return this.notifyUsers(ms.map((m) => m.userId), n);
  }

  list(userId: string) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async markRead(userId: string, ids: string[]) {
    await this.prisma.notification.updateMany({ where: { userId, id: { in: ids } }, data: { readAt: new Date() } });
  }
}
