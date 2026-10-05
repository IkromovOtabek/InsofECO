import { Injectable, Logger, MiddlewareConsumer, Module, NestMiddleware, NestModule } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Majburiy yangilanish (server tomoni).
 *
 * Mobil ilova har so'rovda `X-App-Version` (semver) va `X-App-Platform` (android | ios) yuboradi.
 * Superadmin sozlamalari (AppConfig):
 *   - `app.min_version` — "1.0.2" yoki { "android": "1.0.2", "ios": "1.0.1", "default": "1.0.0" }
 *   - `app.update_url`  — "https://..." yoki { "android": "https://play...", "ios": "https://apps.apple..." }
 *     (bo'lmasa env `ECO_APP_URL`)
 * Versiya past bo'lsa — 426 { code: 'APP_UPDATE_REQUIRED', message, updateUrl, details }.
 * Standart: `app.min_version` yo'q — hech kim bloklanmaydi. Sarlavhasiz so'rovlar (ERP, to'lov shlyuzlari,
 * veb) bloklanmaydi. Health, auth/refresh, app-config va ochiq do'kon/katalog yo'llari ham ochiq — eski
 * ilova yangilanish xabarini ko'ra olsin.
 */

export const MIN_VERSION_KEY = 'app.min_version';
export const UPDATE_URL_KEY = 'app.update_url';
const CACHE_MS = 30_000;

/** Versiya tekshirilmaydigan yo'llar (`/v1/` dan keyingi qism, prefiks bo'yicha). */
export const EXEMPT_PREFIXES = [
  'health',
  'auth/refresh',
  'app-config',
  'catalog',
  'organizations/plants',
  'avatars',
  'billing/payments',
  'erp',
];

type Semver = [number, number, number];

export function parseSemver(v: string | undefined | null): Semver | null {
  const m = /^v?(\d{1,5})(?:\.(\d{1,5}))?(?:\.(\d{1,5}))?(?:[-+].*)?$/.exec((v ?? '').trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

export function semverLt(a: Semver, b: Semver): boolean {
  for (let i = 0; i < 3; i++) if (a[i]! !== b[i]!) return a[i]! < b[i]!;
  return false;
}

export function isExemptPath(url: string): boolean {
  const path = url.split('?')[0]!.replace(/^\/+/, '').replace(/^v\d+\//, '');
  return EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Konfiguratsiya qiymatidan platformaga mos satr: "x" yoki { android, ios, default }. */
function pick(value: unknown, platform: string): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const v = o[platform] ?? o.default;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  }
  return null;
}

interface Cached { at: number; minVersion: unknown; updateUrl: unknown }

@Injectable()
export class AppVersionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AppVersionMiddleware.name);
  private cache: Cached | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async settings(): Promise<Cached> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache;
    try {
      const rows = await this.prisma.appConfig.findMany({ where: { key: { in: [MIN_VERSION_KEY, UPDATE_URL_KEY] } }, select: { key: true, value: true } });
      const get = (k: string) => rows.find((r) => r.key === k)?.value ?? null;
      this.cache = { at: Date.now(), minVersion: get(MIN_VERSION_KEY), updateUrl: get(UPDATE_URL_KEY) };
    } catch (e) {
      // Baza vaqtincha yo'q bo'lsa — eski qiymat yoki bloklamaslik (fail-open: bu xavfsizlik chegarasi emas)
      this.logger.warn(`app.min_version o'qilmadi: ${(e as Error).message}`);
      this.cache = this.cache ?? { at: Date.now(), minVersion: null, updateUrl: null };
    }
    return this.cache;
  }

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const version = req.header('x-app-version');
      if (!version || isExemptPath(req.originalUrl ?? req.url)) return next();
      const current = parseSemver(version);
      if (!current) return next();
      const platform = (req.header('x-app-platform') ?? '').trim().toLowerCase();
      const s = await this.settings();
      const minRaw = pick(s.minVersion, platform);
      const min = parseSemver(minRaw);
      if (!min || !semverLt(current, min)) return next();
      const updateUrl = pick(s.updateUrl, platform) ?? (process.env.ECO_APP_URL?.trim() || null);
      res.status(426).json({
        code: 'APP_UPDATE_REQUIRED',
        message: "Ilovaning bu versiyasi endi qo'llab-quvvatlanmaydi. Davom etish uchun yangi versiyani o'rnating.",
        updateUrl,
        details: { minVersion: minRaw, currentVersion: version, platform: platform || null, updateUrl },
      });
    } catch (e) {
      next(e);
    }
  }
}

@Module({ providers: [AppVersionMiddleware] })
export class AppVersionModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AppVersionMiddleware).forRoutes('*');
  }
}
