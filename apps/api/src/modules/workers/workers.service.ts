import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ReviewCreateSchema, Specialty, WorkerProfileUpdateSchema } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';

const D = Prisma.Decimal;

@Injectable()
export class WorkersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tashkilot quruvchilari + hozirgi loyiha + faol ish. */
  async listWorkers(a: AuthContext, specialty?: Specialty) {
    const ms = await this.prisma.membership.findMany({
      where: { organizationId: a.orgId!, role: 'QURUVCHI', isActive: true, ...(specialty ? { user: { workerProfile: { specialty } } } : {}) },
      include: {
        user: {
          select: {
            id: true, fullName: true, phone: true, workerProfile: true,
            projectMembers: { where: { project: { status: { in: ['ACTIVE', 'DELAYED'] } } }, include: { project: { select: { id: true, name: true } } }, take: 1 },
            workOrders: { where: { status: { in: ['WORKER_ASSIGNED', 'IN_PROGRESS', 'REVIEW'] } }, select: { id: true, title: true, status: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return ms.map((m) => ({
      membershipId: m.id, userId: m.user.id, fullName: m.user.fullName, phone: m.user.phone, profile: m.user.workerProfile,
      currentProject: m.user.projectMembers[0]?.project ?? null, activeWork: m.user.workOrders[0] ?? null,
    }));
  }

  async workerDetail(a: AuthContext, userId: string) {
    const u = await this.prisma.user.findFirst({
      where: { id: userId, memberships: { some: { organizationId: a.orgId!, role: 'QURUVCHI' } } },
      include: {
        workerProfile: true,
        workOrders: { where: { organizationId: a.orgId! }, orderBy: { createdAt: 'desc' }, take: 30, include: { project: { select: { name: true } } } },
        reviewsReceived: { orderBy: { createdAt: 'desc' }, take: 20 },
        projectMembers: { include: { project: { select: { id: true, name: true, status: true } } } },
        payouts: { where: { organizationId: a.orgId! }, orderBy: { earnedAt: 'desc' }, take: 30 },
      },
    });
    if (!u) throw DomainError.notFound('Quruvchi');
    const stats = {
      total: u.workOrders.length,
      done: u.workOrders.filter((w) => ['DONE', 'PAID'].includes(w.status)).length,
      late: u.workOrders.filter((w) => ['DONE', 'PAID'].includes(w.status) && w.completedAt && w.completedAt > w.deadline).length,
      cancelled: u.workOrders.filter((w) => w.status === 'CANCELLED').length,
      earned: u.payouts.reduce((s, p) => s.plus(p.amount), new D(0)),
    };
    return { id: u.id, fullName: u.fullName, phone: u.phone, profile: u.workerProfile, workOrders: u.workOrders, reviews: u.reviewsReceived, projects: u.projectMembers.map((p) => p.project), payouts: u.payouts, stats };
  }

  updateMyProfile(a: AuthContext, input: z.infer<typeof WorkerProfileUpdateSchema>) {
    const data = { ...input, ...(input.dailyRate !== undefined ? { dailyRate: new D(input.dailyRate) } : {}) };
    return this.prisma.workerProfile.upsert({ where: { userId: a.userId }, create: { userId: a.userId, ...data }, update: data });
  }

  /** Haydovchilar: transport, joriy yuk, reyting. */
  async listDrivers(a: AuthContext) {
    const ms = await this.prisma.membership.findMany({
      where: { organizationId: a.orgId!, role: 'HAYDOVCHI', isActive: true },
      include: {
        user: {
          select: {
            id: true, fullName: true, phone: true, driverProfile: true,
            shipments: { where: { status: { in: ['ACCEPTED', 'LOADING', 'EN_ROUTE', 'DELIVERED'] } }, select: { id: true, number: true, cargo: true, status: true, project: { select: { name: true } } }, take: 1 },
            reviewsReceived: { select: { scoreOverall: true } },
            _count: { select: { shipments: { where: { status: 'CONFIRMED' } } } },
          },
        },
      },
    });
    const vehicles = await this.prisma.vehicle.findMany({ where: { organizationId: a.orgId!, isActive: true } });
    return ms.map((m) => {
      const rs = m.user.reviewsReceived;
      return {
        membershipId: m.id, userId: m.user.id, fullName: m.user.fullName, phone: m.user.phone,
        vehicle: vehicles.find((v) => v.driverUserId === m.user.id) ?? null,
        currentShipment: m.user.shipments[0] ?? null,
        deliveredCount: m.user._count.shipments,
        rating: rs.length ? +(rs.reduce((s, r) => s + r.scoreOverall, 0) / rs.length).toFixed(1) : null,
      };
    });
  }

  vehicles(a: AuthContext) {
    return this.prisma.vehicle.findMany({ where: { organizationId: a.orgId!, isActive: true }, orderBy: { plateNumber: 'asc' } });
  }

  /** Haydovchi o'z transportini ko'radi. */
  myVehicle(a: AuthContext) {
    return this.prisma.vehicle.findFirst({ where: { organizationId: a.orgId!, driverUserId: a.userId, isActive: true } });
  }

  async createReview(a: AuthContext, input: z.infer<typeof ReviewCreateSchema>) {
    const r = await this.prisma.review.create({ data: { organizationId: a.orgId!, authorUserId: a.userId, ...input } });
    const agg = await this.prisma.review.aggregate({ where: { targetUserId: input.targetUserId }, _avg: { scoreOverall: true }, _count: true });
    await this.prisma.workerProfile.updateMany({ where: { userId: input.targetUserId }, data: { ratingAvg: agg._avg.scoreOverall ?? 0, ratingCount: agg._count } });
    return r;
  }

  reviewsFor(userId: string) {
    return this.prisma.review.findMany({ where: { targetUserId: userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
