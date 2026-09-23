import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OrderStatusChangedEvent } from '../orders/orders.events';
import { DeliveryStatusChangedEvent } from '../deliveries/deliveries.events';
import { NotificationsService } from './notifications.service';

/** Domen hodisalari → kimga qanday xabar. Matnlar hozircha uz (lotin); i18n keyingi bosqich. */
@Injectable()
export class NotificationsListener {
  constructor(
    private readonly n: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('order.status_changed', { async: true })
  async onOrder(e: OrderStatusChangedEvent) {
    const order = await this.prisma.order.findUnique({ where: { id: e.orderId }, select: { number: true, totalVolumeM3: true } });
    const num = `№${order?.number}`;
    const data = { screen: 'order', orderId: e.orderId };
    switch (e.to) {
      case 'SUBMITTED':
        return this.n.notifyOrgRole(e.plantOrgId, 'TADBIRKOR', { type: 'ORDER_SUBMITTED', title: `Yangi buyurtma ${num}`, body: `${order?.totalVolumeM3} m³ — tasdiqlash kutilmoqda`, data });
      case 'CONFIRMED':
        return this.n.notifyOrgRole(e.clientOrgId, 'QURUVCHI', { type: 'ORDER_CONFIRMED', title: `Buyurtma ${num} tasdiqlandi`, body: 'Zavod buyurtmangizni qabul qildi', data });
      case 'REJECTED':
        return this.n.notifyOrgRole(e.clientOrgId, 'QURUVCHI', { type: 'ORDER_REJECTED', title: `Buyurtma ${num} rad etildi`, body: 'Sababni ilovada ko\'ring', data });
      case 'DELIVERED':
        return this.n.notifyOrgRole(e.clientOrgId, 'QURUVCHI', { type: 'ORDER_DELIVERED', title: `Buyurtma ${num} yetkazildi`, body: 'Barcha reyslar tushirildi', data });
    }
  }

  @OnEvent('delivery.assigned', { async: true })
  async onAssigned(e: { deliveryId: string; driverUserId: string; orderId: string }) {
    const d = await this.prisma.delivery.findUnique({ where: { id: e.deliveryId }, include: { order: { select: { number: true, address: true } } } });
    return this.n.notifyUsers([e.driverUserId], { type: 'DELIVERY_ASSIGNED', title: 'Yangi reys', body: `№${d?.order.number} · ${d?.plannedM3} m³ · ${d?.order.address}`, data: { screen: 'delivery', deliveryId: e.deliveryId } });
  }

  @OnEvent('delivery.status_changed', { async: true })
  async onDelivery(e: DeliveryStatusChangedEvent) {
    const data = { screen: 'delivery', deliveryId: e.deliveryId, orderId: e.orderId };
    if (e.to === 'EN_ROUTE') return this.n.notifyOrgRole(e.clientOrgId, 'QURUVCHI', { type: 'DELIVERY_EN_ROUTE', title: 'Mashina yo\'lga chiqdi', body: 'Ilovada jonli kuzating', data });
    if (e.to === 'ARRIVED') return this.n.notifyOrgRole(e.clientOrgId, 'QURUVCHI', { type: 'DELIVERY_ARRIVED', title: 'Mashina yetib keldi', body: 'Qabul qilishga tayyorlaning', data });
    if (e.to === 'UNLOADING') return this.n.notifyOrgRole(e.clientOrgId, 'QURUVCHI', { type: 'DELIVERY_UNLOADING', title: 'Tushirish boshlandi', body: 'Tugagach imzolashni unutmang', data });
    if (e.to === 'DECLINED' || e.to === 'FAILED') return this.n.notifyOrgRole(e.plantOrgId, 'TADBIRKOR', { type: 'DELIVERY_PROBLEM', title: 'Reysda muammo', body: `Holat: ${e.to}. Qayta biriktiring`, data });
  }

  @OnEvent('delivery.sla_breached', { async: true })
  async onSla(e: { deliveryId: string; plantOrgId: string; clientOrgId: string; driverUserId: string | null }) {
    const data = { screen: 'delivery', deliveryId: e.deliveryId };
    await this.n.notifyOrgRole(e.plantOrgId, 'TADBIRKOR', { type: 'SLA_BREACH', title: '⚠️ 90 daqiqa o\'tdi', body: 'Beton yo\'lda 90 daqiqadan oshdi — sifat xavfi', data });
    if (e.driverUserId) await this.n.notifyUsers([e.driverUserId], { type: 'SLA_BREACH', title: '⚠️ Tezroq tushiring', body: 'Yuklanganiga 90 daqiqa bo\'ldi', data });
  }

  @OnEvent('delivery.disputed', { async: true })
  async onDispute(e: { deliveryId: string; orderId: string; reason: string }) {
    const d = await this.prisma.delivery.findUnique({ where: { id: e.deliveryId }, include: { order: { select: { plantOrgId: true, number: true } } } });
    if (!d) return;
    return this.n.notifyOrgRole(d.order.plantOrgId, 'TADBIRKOR', { type: 'DELIVERY_DISPUTED', title: `E'tiroz: №${d.order.number}`, body: `Sabab: ${e.reason}`, data: { screen: 'delivery', deliveryId: e.deliveryId } });
  }

  // ───────── ECO System hodisalari ─────────
  @OnEvent('material_request.created', { async: true })
  onMrCreated(e: { requestId: string; number: number; orgId: string; material: string; quantity: number; unit: string; project: string }) {
    return this.n.notifyOrgRole(e.orgId, 'TADBIRKOR', { type: 'MATERIAL_REQUEST', title: "👷 Yangi material so'rovi", body: `${e.material} — ${e.quantity} ${e.unit} · ${e.project}`, data: { screen: 'material-request', id: e.requestId } });
  }
  @OnEvent('material_request.approved', { async: true })
  async onMrApproved(e: { requestId: string; number: number; byUserId: string; material: string; shipmentId?: string; driverUserId?: string }) {
    await this.n.notifyUsers([e.byUserId], { type: 'MATERIAL_APPROVED', title: "✅ So'rov tasdiqlandi", body: `${e.material} — yetkazish rejalashtirildi`, data: { screen: 'material-request', id: e.requestId } });
    if (e.driverUserId && e.shipmentId) await this.n.notifyUsers([e.driverUserId], { type: 'SHIPMENT_ASSIGNED', title: '🚚 Yangi yuk', body: e.material, data: { screen: 'shipment', id: e.shipmentId } });
  }
  @OnEvent('material_request.rejected', { async: true })
  onMrRejected(e: { requestId: string; byUserId: string; reason: string }) {
    return this.n.notifyUsers([e.byUserId], { type: 'MATERIAL_REJECTED', title: "❌ So'rov rad etildi", body: e.reason, data: { screen: 'material-request', id: e.requestId } });
  }
  @OnEvent('shipment.status_changed', { async: true })
  async onShipment(e: { shipmentId: string; number: number; cargo: string; to: string; orgId: string; requesterUserId: string | null; driverUserId: string | null }) {
    const data = { screen: 'shipment', id: e.shipmentId };
    if (e.to === 'EN_ROUTE' && e.requesterUserId) await this.n.notifyUsers([e.requesterUserId], { type: 'SHIPMENT_EN_ROUTE', title: "🚚 Yuk yo'lda", body: e.cargo, data });
    if (e.to === 'DELIVERED') {
      if (e.requesterUserId) await this.n.notifyUsers([e.requesterUserId], { type: 'SHIPMENT_DELIVERED', title: '📦 Yuk yetkazildi — tasdiqlang', body: e.cargo, data });
      await this.n.notifyOrgRole(e.orgId, 'TADBIRKOR', { type: 'SHIPMENT_DELIVERED', title: '🚚 Haydovchi yukni yetkazib berdi', body: `№${e.number} ${e.cargo}`, data });
    }
    if (e.to === 'CONFIRMED' && e.driverUserId) await this.n.notifyUsers([e.driverUserId], { type: 'SHIPMENT_CONFIRMED', title: '✅ Yuk qabul qilindi', body: `№${e.number} — daromad hisobingizga yozildi`, data });
  }
  @OnEvent('work_order.assigned', { async: true })
  onWoAssigned(e: { workOrderId: string; workerUserId: string; number: number; title: string }) {
    return this.n.notifyUsers([e.workerUserId], { type: 'WORK_ORDER_ASSIGNED', title: '🔨 Yangi ish buyurtmasi', body: `№${e.number} ${e.title}`, data: { screen: 'work-order', id: e.workOrderId } });
  }
  @OnEvent('work_order.status_changed', { async: true })
  async onWo(e: { workOrderId: string; number: number; title: string; to: string; orgId: string; workerUserId: string | null }) {
    const data = { screen: 'work-order', id: e.workOrderId };
    if (e.to === 'REVIEW') await this.n.notifyOrgRole(e.orgId, 'TADBIRKOR', { type: 'WORK_ORDER_REVIEW', title: '👷 Quruvchi ishni tugatdi', body: `№${e.number} ${e.title} — tekshiruvga yuborildi`, data });
    if (e.to === 'DONE' && e.workerUserId) await this.n.notifyUsers([e.workerUserId], { type: 'WORK_ORDER_DONE', title: '✅ Ish qabul qilindi', body: `№${e.number} ${e.title}`, data });
    if (e.to === 'PAID' && e.workerUserId) await this.n.notifyUsers([e.workerUserId], { type: 'WORK_ORDER_PAID', title: "💰 To'lov qilindi", body: `№${e.number} ${e.title}`, data });
    if (e.to === 'IN_PROGRESS' && e.workerUserId) await this.n.notifyUsers([e.workerUserId], { type: 'WORK_ORDER_REWORK', title: '↩️ Ish qayta ishlashga qaytarildi', body: `№${e.number} ${e.title}`, data });
  }
  @OnEvent('task.submitted', { async: true })
  onTask(e: { taskId: string; projectId: string; orgId: string }) {
    return this.n.notifyOrgRole(e.orgId, 'TADBIRKOR', { type: 'TASK_REVIEW', title: '☑️ Vazifa tekshiruvga yuborildi', body: 'Loyihada vazifa bajarildi', data: { screen: 'project', id: e.projectId } });
  }
  @OnEvent('message.sent', { async: true })
  onMessage(e: { conversationId: string; text: string; senderName: string | null; toUserIds: string[] }) {
    return this.n.notifyUsers(e.toUserIds, { type: 'MESSAGE', title: `💬 ${e.senderName ?? 'Xabar'}`, body: e.text.slice(0, 120), data: { screen: 'chat', id: e.conversationId } });
  }
}
