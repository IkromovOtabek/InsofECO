import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { ACTIVE_DELIVERY_STATUSES, DeliveryStatus, splitVolumeIntoTrips } from '@insof/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DomainError } from '../../common/errors/domain.error';
import { AuthContext } from '../../common/auth/decorators';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly events: EventEmitter2,
  ) {}

  /** CONFIRMED buyurtmani reyslarga bo'ladi: hajm / sig'im, vaqt = scheduledAt + i*interval. → SCHEDULED */
  async plan(a: AuthContext, orderId: string, capacityM3?: number) {
    const order = await this.orders.get(a, orderId);
    if (order.plantOrgId !== a.orgId) throw DomainError.forbidden();
    if (order.status !== 'CONFIRMED') throw new DomainError('ORDER_INVALID_TRANSITION', 'Faqat tasdiqlangan buyurtma rejalashtiriladi');
    if (order.deliveries.length > 0) throw new DomainError('ORDER_INVALID_TRANSITION', 'Reyslar allaqachon yaratilgan');

    const cap = capacityM3 ?? (await this.defaultCapacity(a.orgId!));
    const volumes = splitVolumeIntoTrips(order.totalVolumeM3.toNumber(), cap);

    await this.prisma.$transaction(async (tx) => {
      await tx.delivery.createMany({
        data: volumes.map((v, i) => ({
          orderId,
          sequence: i + 1,
          plannedM3: new Prisma.Decimal(v),
          plannedAt: new Date(order.scheduledAt.getTime() + i * order.intervalMinutes * 60_000),
          status: 'ASSIGNED' as DeliveryStatus, // haydovchi biriktirilmaguncha "kutilmoqda" — driverId null
        })),
      });
      await tx.order.update({ where: { id: orderId }, data: { status: 'SCHEDULED' } });
    });
    return this.orders.get(a, orderId);
  }

  async assign(a: AuthContext, deliveryId: string, driverUserId: string, vehicleId: string) {
    const delivery = await this.prisma.delivery.findFirst({ where: { id: deliveryId, order: { plantOrgId: a.orgId! } }, include: { order: true } });
    if (!delivery) throw DomainError.notFound('Reys');
    if (!['ASSIGNED', 'DECLINED'].includes(delivery.status)) throw new DomainError('DELIVERY_INVALID_TRANSITION', 'Bu reys allaqachon boshlangan');

    const [driver, vehicle] = await Promise.all([
      this.prisma.driverProfile.findFirst({ where: { userId: driverUserId, user: { memberships: { some: { organizationId: a.orgId!, role: 'HAYDOVCHI', isActive: true } } } } }),
      this.prisma.vehicle.findFirst({ where: { id: vehicleId, organizationId: a.orgId!, isActive: true } }),
    ]);
    if (!driver) throw DomainError.notFound('Haydovchi');
    if (!vehicle) throw DomainError.notFound('Mashina');

    // Bir haydovchida bir vaqtda bitta faol reys
    const busy = await this.prisma.delivery.count({ where: { driverId: driver.id, status: { in: ACTIVE_DELIVERY_STATUSES as DeliveryStatus[] } } });
    if (busy > 0) throw new DomainError('DELIVERY_DRIVER_BUSY', 'Haydovchida faol reys bor');

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: { driverId: driver.id, vehicleId, status: 'ASSIGNED' },
      include: { order: { select: { id: true, number: true, address: true } } },
    });
    this.events.emit('delivery.assigned', { deliveryId, driverUserId, orderId: delivery.orderId });
    return updated;
  }

  /** Dispetcher ekrani: bugungi reyslar + bo'sh haydovchilar + mashinalar. */
  async board(a: AuthContext, date: Date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const [deliveries, drivers, vehicles] = await Promise.all([
      this.prisma.delivery.findMany({
        where: { order: { plantOrgId: a.orgId! }, plannedAt: { gte: start, lt: end } },
        include: { order: { select: { id: true, number: true, address: true, client: { select: { name: true } } } }, driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } }, vehicle: true },
        orderBy: { plannedAt: 'asc' },
      }),
      this.prisma.membership.findMany({
        where: { organizationId: a.orgId!, role: 'HAYDOVCHI', isActive: true },
        include: { user: { select: { id: true, fullName: true, phone: true, driverProfile: { include: { deliveries: { where: { status: { in: ACTIVE_DELIVERY_STATUSES as DeliveryStatus[] } }, select: { id: true, status: true } } } } } } },
      }),
      this.prisma.vehicle.findMany({ where: { organizationId: a.orgId!, isActive: true } }),
    ]);
    return {
      deliveries,
      drivers: drivers.map((m) => ({ userId: m.user.id, fullName: m.user.fullName, phone: m.user.phone, activeDelivery: m.user.driverProfile?.deliveries[0] ?? null })),
      vehicles,
    };
  }

  private async defaultCapacity(orgId: string) {
    const v = await this.prisma.vehicle.findFirst({ where: { organizationId: orgId, type: 'MIXER', isActive: true }, orderBy: { capacityM3: 'desc' } });
    return v?.capacityM3.toNumber() ?? 8;
  }
}
