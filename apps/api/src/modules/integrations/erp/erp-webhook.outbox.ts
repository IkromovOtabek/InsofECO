import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, WebhookOutbox } from '@prisma/client';
import * as Sentry from '@sentry/node';
import { createHmac } from 'crypto';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const TICK_MS = 5_000;
const BATCH = 50;
/** Olingan qator shu muddat boshqa jarayonga berilmaydi; jarayon yiqilsa — keyin qayta olinadi. */
const LEASE_MS = 2 * 60_000;
/** ~12 soat urinadi (ERP uzoq o'chiq bo'lishi mumkin), keyin FAILED — admin ko'radi. */
export const MAX_ATTEMPTS = 20;
const KEEP_SENT_DAYS = 14;

/** n-urinishdan keyingi kutish: 5s, 30s, 2m, 5m, 15m, 30m, keyin har soat. */
export function backoffMs(attempts: number): number {
  const steps = [5_000, 30_000, 120_000, 300_000, 900_000, 1_800_000];
  return steps[attempts - 1] ?? 3_600_000;
}

/** 404 — ERP qayta yig'ilayotgan bo'lishi mumkin, 408/429 — vaqtinchalik. Qolgan 4xx (imzo/format) — qayta urish foydasiz. */
export const retryable = (status: number) => status >= 500 || [404, 408, 429].includes(status);

export interface WebhookMessage { clientId: string; event: string; payload: Record<string, unknown> }

/**
 * ECO → ERP webhook navbati. Ilgari xabar jarayon xotirasida 4 marta (≤ 21 s) urinilardi va yo'qolardi:
 * ERP bir necha daqiqa o'chiq bo'lsa yoki API qayta ishga tushsa, reys holati ERP'ga yetmasdi.
 * Endi: hodisa `WebhookOutbox` ga yoziladi → shu servis (har 5 s + yozilgan zahoti) yuboradi → xato bo'lsa
 * kechiktirib qayta uradi.
 *
 * Tartib: bir mijozga xabarlar yaratilgan tartibda ketadi — oldingisi hali kutayotgan bo'lsa keyingisi olinmaydi
 * (aks holda "yo'lda" "yetkazildi" dan keyin kelib qolardi). Bir nechta API jarayoni: qator `FOR UPDATE SKIP LOCKED`
 * bilan ijaraga olinadi, ikki marta yuborilmaydi. O'chirish: `ERP_WEBHOOK_WORKER=false`.
 */
@Injectable()
export class ErpWebhookOutbox implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ErpWebhookOutbox.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;
  private again = false;
  private lastCleanup = 0;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || (process.env.ERP_WEBHOOK_WORKER ?? 'true').toLowerCase() === 'false') return;
    this.timer = setInterval(() => this.kick(), TICK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  /** Xabarlarni navbatga yozadi va darhol yuborishni boshlaydi (javobni kutmaydi). */
  async enqueue(messages: WebhookMessage[]) {
    if (messages.length === 0) return;
    await this.prisma.webhookOutbox.createMany({
      data: messages.map((m) => ({ clientId: m.clientId, event: m.event, payload: m.payload as Prisma.InputJsonObject })),
    });
    this.kick();
  }

  kick() {
    if (this.busy) { this.again = true; return; }
    void this.drain();
  }

  /** Muddati kelgan xabarlarni yuboradi. Ishlayotgan bo'lsa qayta chaqiruv navbat oxirida yana bir aylanish beradi. */
  async drain(now = new Date()) {
    if (this.busy) return;
    this.busy = true;
    try {
      do {
        this.again = false;
        const rows = await this.claim(now);
        await this.process(rows);
        if (rows.length === BATCH) this.again = true;
        now = new Date();
      } while (this.again);
      await this.cleanup();
    } catch (e) {
      this.logger.warn(`drain: ${String(e)}`);
    } finally {
      this.busy = false;
    }
  }

  /** Muddati kelgan, o'z mijozida eng oldingi kutayotgan qatorlar — ijaraga olinadi. */
  private async claim(now: Date): Promise<WebhookOutbox[]> {
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE "WebhookOutbox" SET "nextAttemptAt" = ${new Date(now.getTime() + LEASE_MS)}
      WHERE "id" IN (
        SELECT o."id" FROM "WebhookOutbox" o
        WHERE o."status" = 'PENDING' AND o."nextAttemptAt" <= ${now}
          AND NOT EXISTS (
            SELECT 1 FROM "WebhookOutbox" p
            WHERE p."clientId" = o."clientId" AND p."status" = 'PENDING'
              AND (p."createdAt", p."id") < (o."createdAt", o."id") AND p."nextAttemptAt" > ${now}
          )
        ORDER BY o."createdAt", o."id"
        LIMIT ${BATCH}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id"`;
    if (ids.length === 0) return [];
    return this.prisma.webhookOutbox.findMany({ where: { id: { in: ids.map((x) => x.id) } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  }

  private async process(rows: WebhookOutbox[]) {
    const byClient = new Map<string, WebhookOutbox[]>();
    for (const r of rows) byClient.set(r.clientId, [...(byClient.get(r.clientId) ?? []), r]);
    await Promise.all([...byClient.entries()].map(async ([clientId, list]) => {
      const client = await this.prisma.integrationClient.findUnique({ where: { id: clientId }, select: { webhookUrl: true, webhookSecret: true, isActive: true } });
      for (let i = 0; i < list.length; i++) {
        const ok = await this.deliver(list[i]!, client);
        if (!ok) {
          // Mijozning qolgan xabarlari kutadi (tartib buzilmasin) — ijarani bo'shatamiz, oldingisi yetgach olinadi
          const rest = list.slice(i + 1).map((r) => r.id);
          if (rest.length) await this.prisma.webhookOutbox.updateMany({ where: { id: { in: rest } }, data: { nextAttemptAt: new Date() } });
          break;
        }
      }
    }));
  }

  /** true — navbatdagi xabarga o'tish mumkin (yetdi yoki butunlay rad etildi). */
  private async deliver(row: WebhookOutbox, client: { webhookUrl: string | null; webhookSecret: string | null; isActive: boolean } | null): Promise<boolean> {
    if (!client?.isActive || !client.webhookUrl) {
      await this.prisma.webhookOutbox.update({ where: { id: row.id }, data: { status: 'FAILED', lastError: 'Integratsiya o\'chirilgan yoki webhook manzili yo\'q' } });
      return true;
    }
    const body = JSON.stringify(row.payload);
    const ts = String(Date.now());
    const sig = createHmac('sha256', client.webhookSecret ?? '').update(`${ts}.${body}`).digest('hex');
    const attempts = row.attempts + 1;
    let status: number | null = null;
    let error: string | null = null;
    try {
      const res = await fetch(client.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-eco-event': row.event, 'x-eco-timestamp': ts, 'x-eco-signature': `sha256=${sig}`, 'x-eco-delivery': row.id },
        body,
        signal: AbortSignal.timeout(8000),
      });
      status = res.status;
      if (res.ok) {
        await this.prisma.webhookOutbox.update({ where: { id: row.id }, data: { status: 'SENT', attempts, lastStatus: status, lastError: null, sentAt: new Date() } });
        return true;
      }
      error = `HTTP ${status}`;
    } catch (e) {
      error = (e as Error).message;
    }
    const final = (status !== null && !retryable(status)) || attempts >= MAX_ATTEMPTS;
    if (final) {
      this.logger.error(`webhook ${row.event} (${row.id}) yetib bormadi: ${error}, ${attempts} urinish`);
      Sentry.captureMessage(`ERP webhook yetib bormadi: ${row.event}`, { level: 'error', extra: { id: row.id, status, error, attempts } });
    }
    else this.logger.warn(`webhook ${row.event} (${row.id}): ${error} (urinish ${attempts})`);
    await this.prisma.webhookOutbox.update({
      where: { id: row.id },
      data: final
        ? { status: 'FAILED', attempts, lastStatus: status, lastError: error?.slice(0, 500) }
        : { attempts, lastStatus: status, lastError: error?.slice(0, 500), nextAttemptAt: new Date(Date.now() + backoffMs(attempts)) },
    });
    // Butunlay rad etilgan xabar keyingilarini to'smaydi; vaqtinchalik xato — to'sadi
    return final;
  }

  /** Yetkazilganlar 14 kundan keyin o'chadi (soatiga bir marta). FAILED qoladi — admin ko'radi. */
  private async cleanup() {
    if (Date.now() - this.lastCleanup < 3_600_000) return;
    this.lastCleanup = Date.now();
    await this.prisma.webhookOutbox.deleteMany({ where: { status: 'SENT', sentAt: { lt: new Date(Date.now() - KEEP_SENT_DAYS * 86_400_000) } } });
  }
}
