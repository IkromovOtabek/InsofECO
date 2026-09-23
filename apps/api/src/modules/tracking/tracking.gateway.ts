import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GpsBatchSchema } from '@insof/shared';
import { TrackingService } from './tracking.service';

/**
 * WS /tracking
 *  client → 'gps'    { deliveryId, points[] }        (haydovchi)
 *  client → 'watch'  { deliveryId }                  (quruvchi/tadbirkor) → room `d:<id>`
 *  server → 'position' LivePosition                  (room ga)
 */
@WebSocketGateway({ namespace: '/tracking', cors: { origin: true } })
export class TrackingGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(TrackingGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly tracking: TrackingService,
  ) {}

  async handleConnection(client: Socket) {
    const token = (client.handshake.auth?.token as string | undefined) ?? (client.handshake.headers.authorization ?? '').replace('Bearer ', '');
    try {
      const p = await this.jwt.verifyAsync<{ sub: string }>(token);
      client.data.userId = p.sub;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('gps')
  async onGps(@ConnectedSocket() client: Socket, @MessageBody() raw: unknown) {
    const parsed = GpsBatchSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: 'VALIDATION' };
    const pos = await this.tracking.ingest(client.data.userId as string, parsed.data);
    if (!pos) return { ok: false, error: 'NOT_ACTIVE' };
    this.server.to(`d:${pos.deliveryId}`).emit('position', pos);
    return { ok: true, accepted: parsed.data.points.length };
  }

  @SubscribeMessage('watch')
  async onWatch(@ConnectedSocket() client: Socket, @MessageBody() body: { deliveryId: string }) {
    if (!body?.deliveryId || !(await this.tracking.canWatch(client.data.userId as string, body.deliveryId))) return { ok: false };
    await client.join(`d:${body.deliveryId}`);
    const last = await this.tracking.lastPosition(body.deliveryId);
    if (last) client.emit('position', last);
    return { ok: true };
  }

  @SubscribeMessage('unwatch')
  async onUnwatch(@ConnectedSocket() client: Socket, @MessageBody() body: { deliveryId: string }) {
    await client.leave(`d:${body.deliveryId}`);
    return { ok: true };
  }
}
