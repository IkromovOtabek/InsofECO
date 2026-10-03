import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GpsBatchSchema } from '@insof/shared';
import { checkUserGate, USER_REVOKED_EVENT, UserRevokedEvent } from '../../common/auth/user-gate';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TrackingService } from './tracking.service';

/** Ochiq ulanishlar shu oraliqda qayta tekshiriladi (bloklangan, o'chirilgan, seanslari yopilgan). */
const RECHECK_MS = 60_000;
const userRoom = (userId: string) => `u:${userId}`;

/**
 * WS /tracking
 *  client → 'gps'    { deliveryId, points[] }        (haydovchi)
 *  client → 'watch'  { deliveryId }                  (quruvchi/tadbirkor) → room `d:<id>`
 *  server → 'position' LivePosition                  (room ga)
 *
 * Xavfsizlik: ulanishda JWT + foydalanuvchi holati (bloklangan/o'chirilgan/seanslar yopilgan)
 * tekshiriladi; superadmin bloklasa yoki seanslarni yopsa — USER_REVOKED_EVENT orqali o'sha
 * zahoti uziladi (Redis pub/sub bilan boshqa instanslarda ham), qo'shimcha ravishda har 60 s
 * barcha ulanishlar qayta tekshiriladi. Token muddati (15 daq) ulanish davomida tekshirilmaydi —
 * mavjud ilova socketni o'sha tokenni qayta ishlatib ulaydi, uzsak kuzatuv to'xtab qolardi.
 */
@WebSocketGateway({ namespace: '/tracking', cors: { origin: true } })
export class TrackingGateway implements OnGatewayConnection, OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(TrackingGateway.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly jwt: JwtService,
    private readonly tracking: TrackingService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.timer = setInterval(() => void this.recheckAll().catch((e: unknown) => this.logger.warn(`recheck: ${String(e)}`)), RECHECK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Ulanish tekshiruvi asinxron — shu vaqtda kelgan xabarlar uning tugashini kutadi (aks holda userId hali yo'q). */
  private readonly ready = new WeakMap<Socket, Promise<void>>();

  handleConnection(client: Socket) {
    const token = (client.handshake.auth?.token as string | undefined) ?? (client.handshake.headers.authorization ?? '').replace('Bearer ', '');
    const p = (async () => {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string; iat?: number }>(token);
        if (await checkUserGate(this.prisma, payload.sub, payload.iat)) throw new Error('inactive');
        client.data.userId = payload.sub;
        client.data.iat = payload.iat;
        await client.join(userRoom(payload.sub));
      } catch {
        client.disconnect(true);
      }
    })();
    this.ready.set(client, p);
    return p;
  }

  /** Superadmin bloklash / seanslarni yopish / hisob o'chirilishi — shu foydalanuvchining socketlari darhol uziladi. */
  @OnEvent(USER_REVOKED_EVENT)
  onUserRevoked(e: UserRevokedEvent) {
    this.server.in(userRoom(e.userId)).disconnectSockets(true);
  }

  /** Davriy qayta tekshiruv (pub/sub yetib kelmagan holatlar uchun zaxira). Kesh 30 s — baza yuklanmaydi. */
  private async recheckAll() {
    const sockets = await this.server.fetchSockets();
    for (const s of sockets) {
      const userId = s.data.userId as string | undefined;
      if (!userId) { s.disconnect(true); continue; }
      if (await checkUserGate(this.prisma, userId, s.data.iat as number | undefined)) s.disconnect(true);
    }
  }

  @SubscribeMessage('gps')
  async onGps(@ConnectedSocket() client: Socket, @MessageBody() raw: unknown) {
    const parsed = GpsBatchSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: 'VALIDATION' };
    if (!(await this.active(client))) return { ok: false, error: 'AUTH' };
    const pos = await this.tracking.ingest(client.data.userId as string, parsed.data);
    if (!pos) return { ok: false, error: 'NOT_ACTIVE' };
    this.server.to(`d:${pos.deliveryId}`).emit('position', pos);
    return { ok: true, accepted: parsed.data.points.length };
  }

  @SubscribeMessage('watch')
  async onWatch(@ConnectedSocket() client: Socket, @MessageBody() body: { deliveryId: string }) {
    if (!(await this.active(client))) return { ok: false };
    if (typeof body?.deliveryId !== 'string' || !(await this.tracking.canWatch(client.data.userId as string, body.deliveryId))) return { ok: false };
    await client.join(`d:${body.deliveryId}`);
    const last = await this.tracking.lastPosition(body.deliveryId);
    if (last) client.emit('position', last);
    return { ok: true };
  }

  @SubscribeMessage('unwatch')
  async onUnwatch(@ConnectedSocket() client: Socket, @MessageBody() body: { deliveryId: string }) {
    if (typeof body?.deliveryId !== 'string') return { ok: false };
    await client.leave(`d:${body.deliveryId}`);
    return { ok: true };
  }

  /** Har bir xabarda (kesh bilan arzon) — bekor qilingan foydalanuvchi uzilguncha ham hech narsa qila olmaydi. */
  private async active(client: Socket) {
    await this.ready.get(client);
    const userId = client.data.userId as string | undefined;
    if (userId && !(await checkUserGate(this.prisma, userId, client.data.iat as number | undefined))) return true;
    client.disconnect(true);
    return false;
  }
}
