import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { statfs } from 'fs/promises';
import * as os from 'os';
import { dirname, join } from 'path';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { SLA_QUEUE } from '../deliveries/deliveries.module';
import { TrackingGateway } from '../tracking/tracking.gateway';
import { errorStats } from './error-stats';

export type Health = 'ok' | 'degraded' | 'down' | 'unknown';
export interface Probe { status: Health; latencyMs: number | null; detail?: string }

const STARTED_AT = new Date();

/** Kechikish chegaralari (ms): shundan oshsa — sariq. */
const SLOW = { db: 150, redis: 50, erp: 1500 } as const;

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms} ms`)), ms))]);

/** `@insof/api` package.json — versiya uchun (dist/ yoki src/ dan yuqoriga qarab qidiriladi). */
function readVersion(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const p = join(dir, 'package.json');
    if (existsSync(p)) {
      try {
        const j = JSON.parse(readFileSync(p, 'utf8')) as { name?: string; version?: string };
        if (j.name === '@insof/api') return j.version ?? '0.0.0';
      } catch { /* keyingisi */ }
    }
    dir = dirname(dir);
  }
  return process.env.npm_package_version ?? '0.0.0';
}

/** Commit: deploy paytida `GIT_COMMIT` beriladi; bo'lmasa git'dan (bir marta, ishga tushganda). */
function readCommit(): string | null {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT.slice(0, 12);
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: __dirname, timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
}

const VERSION = readVersion();
const COMMIT = readCommit();

/**
 * Server holati — superadmin "Holat" ekrani uchun. Har bir tekshiruv vaqt bilan cheklangan
 * (bitta qism osilib qolsa butun javob kutib qolmasin) va xatolar matni qisqa qaytadi.
 */
@Injectable()
export class AdminHealthService {
  private readonly logger = new Logger(AdminHealthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async snapshot() {
    const [db, redis, queue, erp, disk, clients] = await Promise.all([
      this.db(), this.redisPing(), this.queue(), this.erp(), this.disk(), this.clientVersions(),
    ]);
    const sockets = this.sockets();
    const mem = process.memoryUsage();
    const errors = errorStats.snapshot();
    const api: Probe = { status: errors.lastHour > 20 ? 'degraded' : 'ok', latencyMs: 0 };
    const parts = [db.status, redis.status, sockets.status];
    const overall: Health = db.status === 'down' ? 'down' : parts.some((s) => s !== 'ok') || erp.status === 'down' || api.status !== 'ok' ? 'degraded' : 'ok';
    return {
      at: new Date().toISOString(),
      overall,
      api: {
        ...api,
        version: VERSION,
        commit: COMMIT,
        node: process.version,
        env: process.env.NODE_ENV ?? 'development',
        startedAt: STARTED_AT.toISOString(),
        uptimeSec: Math.round(process.uptime()),
        pid: process.pid,
      },
      db,
      redis,
      queue,
      erp,
      sockets,
      system: {
        hostname: os.hostname(),
        platform: `${os.platform()} ${os.release()}`,
        cpus: os.cpus().length,
        loadAvg: os.loadavg().map((x) => Math.round(x * 100) / 100),
        memory: { totalMb: mb(os.totalmem()), freeMb: mb(os.freemem()), rssMb: mb(mem.rss), heapUsedMb: mb(mem.heapUsed), heapTotalMb: mb(mem.heapTotal) },
        disk,
        osUptimeSec: Math.round(os.uptime()),
      },
      errors,
      clients,
    };
  }

  private async db(): Promise<Probe & { migrations?: number }> {
    const t = performance.now();
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, 3000);
      const latencyMs = Math.round(performance.now() - t);
      let migrations: number | undefined;
      try {
        const r = await this.prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
        migrations = Number(r[0]?.n ?? 0);
      } catch { /* jadval bo'lmasligi mumkin */ }
      return { status: latencyMs > SLOW.db ? 'degraded' : 'ok', latencyMs, migrations };
    } catch (e) {
      return { status: 'down', latencyMs: null, detail: short(e) };
    }
  }

  private async redisPing(): Promise<Probe & { state?: string }> {
    const t = performance.now();
    try {
      await withTimeout(this.redis.client.ping(), 2000);
      const latencyMs = Math.round(performance.now() - t);
      return { status: latencyMs > SLOW.redis ? 'degraded' : 'ok', latencyMs, state: this.redis.client.status };
    } catch (e) {
      return { status: 'down', latencyMs: null, state: this.redis.client.status, detail: short(e) };
    }
  }

  /** BullMQ SLA navbati — kutayotgan/muvaffaqiyatsiz ishlar soni. */
  private async queue() {
    try {
      const q = this.moduleRef.get<Queue>(getQueueToken(SLA_QUEUE), { strict: false });
      const counts = await withTimeout(q.getJobCounts('waiting', 'active', 'delayed', 'failed'), 2000);
      const failed = counts.failed ?? 0;
      return { status: (failed > 50 ? 'degraded' : 'ok') as Health, name: SLA_QUEUE, counts };
    } catch (e) {
      return { status: 'unknown' as Health, name: SLA_QUEUE, detail: short(e) };
    }
  }

  /** Socket.IO /tracking — ulangan mijozlar soni (shu instansda). */
  private sockets(): Probe & { connections: number | null; namespace: string } {
    try {
      const gw = this.moduleRef.get(TrackingGateway, { strict: false });
      const ns = gw.server as unknown as { sockets?: Map<string, unknown> | { size?: number }; engine?: { clientsCount?: number }; server?: { engine?: { clientsCount?: number } } };
      const connections = ns?.sockets && 'size' in ns.sockets ? Number(ns.sockets.size) : ns?.server?.engine?.clientsCount ?? ns?.engine?.clientsCount ?? null;
      return { status: gw.server ? 'ok' : 'down', latencyMs: null, connections, namespace: '/tracking' };
    } catch (e) {
      return { status: 'unknown', latencyMs: null, connections: null, namespace: '/tracking', detail: short(e) };
    }
  }

  /**
   * Insof ERP serveri. Manzil: `ERP_HEALTH_URL` (to'liq), yoki `ERP_URL` + /health, yoki
   * faol integratsiya webhook'ining origin'i + /health. Javob kodi < 500 — server tirik.
   */
  private async erp(): Promise<Probe & { url: string | null; httpStatus?: number }> {
    let url = process.env.ERP_HEALTH_URL?.trim() || (process.env.ERP_URL?.trim() ? `${process.env.ERP_URL.trim().replace(/\/+$/, '')}/health` : null);
    if (!url) {
      const c = await this.prisma.integrationClient.findFirst({ where: { isActive: true, webhookUrl: { not: null } }, select: { webhookUrl: true }, orderBy: { lastUsedAt: 'desc' } }).catch(() => null);
      try { if (c?.webhookUrl) url = `${new URL(c.webhookUrl).origin}/health`; } catch { /* yaroqsiz URL */ }
    }
    if (!url) return { status: 'unknown', latencyMs: null, url: null, detail: 'ERP_URL sozlanmagan' };
    const shown = safeUrl(url);
    const t = performance.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(url, { method: 'GET', signal: ctrl.signal, redirect: 'manual' }).finally(() => clearTimeout(timer));
      const latencyMs = Math.round(performance.now() - t);
      if (r.status >= 500) return { status: 'down', latencyMs, url: shown, httpStatus: r.status };
      return { status: latencyMs > SLOW.erp ? 'degraded' : 'ok', latencyMs, url: shown, httpStatus: r.status };
    } catch (e) {
      return { status: 'down', latencyMs: null, url: shown, detail: short(e) };
    }
  }

  private async disk() {
    try {
      const s = await statfs(process.cwd());
      const total = Number(s.blocks) * Number(s.bsize);
      const free = Number(s.bavail) * Number(s.bsize);
      return { totalGb: gb(total), freeGb: gb(free), usedPct: total ? Math.round(((total - free) / total) * 100) : null };
    } catch (e) {
      this.logger.debug(`statfs: ${short(e)}`);
      return null;
    }
  }

  /** Ilova versiyalari — so'nggi 30 kunda ko'ringan qurilmalar (platforma × versiya). */
  private async clientVersions() {
    try {
      const since = new Date(Date.now() - 30 * 86_400_000);
      const rows = await this.prisma.device.groupBy({ by: ['platform', 'appVersion'], where: { lastSeenAt: { gte: since } }, _count: { _all: true } });
      return rows
        .map((r) => ({ platform: r.platform, appVersion: r.appVersion ?? 'noma\'lum', devices: r._count._all }))
        .sort((a, b) => b.devices - a.devices)
        .slice(0, 12);
    } catch {
      return [];
    }
  }
}

const mb = (n: number) => Math.round(n / 1024 / 1024);
const gb = (n: number) => Math.round((n / 1024 / 1024 / 1024) * 10) / 10;
const short = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 160);
/** URL'dagi login/parol yoki query (kalit bo'lishi mumkin) ko'rsatilmaydi. */
const safeUrl = (u: string) => { try { const x = new URL(u); return `${x.origin}${x.pathname}`; } catch { return null; } };
