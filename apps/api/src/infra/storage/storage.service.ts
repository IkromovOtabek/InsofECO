import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac, randomUUID } from 'crypto';
import { DomainError } from '../../common/errors/domain.error';

export const UPLOAD_PURPOSES = ['waybill', 'signature', 'dispute', 'report'] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];
export const UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];

/** Presigned PUT URL amal qilish muddati (soniya). */
export const PRESIGN_PUT_EXPIRES = 300;
/** PUT uchun content-length-range yo'q — hajm yuklangandan keyin HEAD bilan tekshiriladi. */
export const MAX_UPLOAD_BYTES: Record<UploadPurpose, number> = {
  signature: 2 * 1024 * 1024,
  waybill: 10 * 1024 * 1024,
  dispute: 10 * 1024 * 1024,
  report: 10 * 1024 * 1024,
};

const EXT: Record<UploadContentType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const TYPE_BY_EXT: Record<string, UploadContentType> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };

/**
 * Eski ilova versiyalari haqiqiy yuklash o'rniga yuboradigan joy egallovchi kalit. Rad etilmaydi (eski ilova
 * ishdan chiqmasin), lekin bazaga yozilmaydi — "foto yo'q" deb hisoblanadi.
 */
export const LEGACY_PLACEHOLDER_KEYS = new Set(['photo/demo.jpg']);

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const DAY = '\\d{4}-\\d{2}-\\d{2}';
const PURPOSE_RE = UPLOAD_PURPOSES.join('|');
/** Yangi format: `u/<userId>/<purpose>/<sana>/<uuid>.<ext>` — har foydalanuvchining o'z prefiksi. */
const KEY_RE = new RegExp(`^u/([A-Za-z0-9_-]{1,64})/(${PURPOSE_RE})/${DAY}/${UUID}\\.(jpg|png|webp|pdf)$`);
/** Oldingi format (yangi presign chiqqungacha berilgan kalitlar): `<purpose>/<sana>/<userId>/<uuid>.<ext>`. */
const LEGACY_KEY_RE = new RegExp(`^(${PURPOSE_RE})/${DAY}/([A-Za-z0-9_-]{1,64})/${UUID}\\.(jpg|png|webp|pdf)$`);

export function parseUploadKey(key: string): { userId: string; purpose: UploadPurpose; ext: string } | null {
  let m = KEY_RE.exec(key);
  if (m) return { userId: m[1]!, purpose: m[2] as UploadPurpose, ext: m[3]! };
  m = LEGACY_KEY_RE.exec(key);
  if (m) return { userId: m[2]!, purpose: m[1] as UploadPurpose, ext: m[3]! };
  return null;
}

// ───────────── AWS Signature V4 (query string) — tashqi SDK'siz ─────────────

const sha256hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const hmac = (k: Buffer | string, s: string) => createHmac('sha256', k).update(s, 'utf8').digest();

/** RFC 3986 kodlash (S3 talabi): `A-Z a-z 0-9 - _ . ~` dan boshqasi %XX. */
export function rfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export interface PresignParams {
  method: 'GET' | 'PUT' | 'HEAD' | 'DELETE';
  /** `http(s)://host[:port]` */
  origin: string;
  /** URI yo'li, kodlanmagan (masalan `/bucket/u/1/a.png`) */
  path: string;
  accessKey: string;
  secretKey: string;
  region: string;
  expiresSeconds: number;
  now: Date;
  /** Imzoga kiritiladigan qo'shimcha sarlavhalar (kichik harfda), masalan content-type */
  headers?: Record<string, string>;
}

/** SigV4 presigned URL (UNSIGNED-PAYLOAD). AWS S3 va MinIO bilan mos. */
export function presignUrl(p: PresignParams): string {
  const url = new URL(p.origin);
  const host = url.host; // port bilan (standart bo'lmasa)
  const amzDate = p.now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${p.region}/s3/aws4_request`;
  const headers: Record<string, string> = { host };
  for (const [k, v] of Object.entries(p.headers ?? {})) headers[k.toLowerCase()] = v.trim();
  const signedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaders.map((h) => `${h}:${headers[h]}\n`).join('');

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${p.accessKey}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(p.expiresSeconds),
    'X-Amz-SignedHeaders': signedHeaders.join(';'),
  };
  const canonicalQuery = Object.keys(query).sort().map((k) => `${rfc3986(k)}=${rfc3986(query[k]!)}`).join('&');
  const canonicalUri = p.path.split('/').map(rfc3986).join('/');
  const canonicalRequest = [p.method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders.join(';'), 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  const kDate = hmac(`AWS4${p.secretKey}`, dateStamp);
  const kSigning = hmac(hmac(hmac(kDate, p.region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
  return `${url.protocol}//${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

interface S3Config {
  /** Mobil ilova ko'radigan manzil (presigned PUT shu hostga imzolanadi) */
  publicEndpoint: string;
  /** API serveri ichidan (HEAD/DELETE); berilmasa publicEndpoint */
  internalEndpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

/**
 * S3/MinIO: haqiqiy SigV4 presigned PUT (bucket anonim yozishga ochiq bo'lishi shart emas) va
 * mijoz yuborgan kalitni tekshirish (o'z prefiksi + obyekt mavjud + hajm/turi).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  private config(): S3Config | null {
    const accessKey = process.env.S3_ACCESS_KEY;
    const secretKey = process.env.S3_SECRET_KEY;
    if (!accessKey || !secretKey) return null;
    const publicEndpoint = (process.env.S3_ENDPOINT ?? 'http://localhost:9000').replace(/\/+$/, '');
    return {
      publicEndpoint,
      internalEndpoint: (process.env.S3_INTERNAL_ENDPOINT ?? publicEndpoint).replace(/\/+$/, ''),
      bucket: process.env.S3_BUCKET ?? 'insof',
      accessKey,
      secretKey,
      region: process.env.S3_REGION ?? 'us-east-1',
    };
  }

  private requireConfig(): S3Config {
    const c = this.config();
    if (!c) throw new DomainError('INTERNAL', 'Fayl ombori sozlanmagan (S3_ACCESS_KEY / S3_SECRET_KEY)');
    return c;
  }

  private sign(c: S3Config, method: PresignParams['method'], endpoint: string, key: string, expiresSeconds: number, headers?: Record<string, string>) {
    const base = new URL(endpoint);
    const prefix = base.pathname.replace(/\/+$/, '');
    return presignUrl({ method, origin: base.origin, path: `${prefix}/${c.bucket}/${key}`, accessKey: c.accessKey, secretKey: c.secretKey, region: c.region, expiresSeconds, now: new Date(), headers });
  }

  /** Mobil uchun presigned PUT. Javob shakli o'zgarmagan: { key, url, method, headers }. */
  presignPut(userId: string, purpose: UploadPurpose, contentType: UploadContentType) {
    const c = this.requireConfig();
    const key = `u/${userId}/${purpose}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${EXT[contentType]}`;
    const url = this.sign(c, 'PUT', c.publicEndpoint, key, PRESIGN_PUT_EXPIRES, { 'content-type': contentType });
    return { key, url, method: 'PUT' as const, headers: { 'content-type': contentType } };
  }

  /** O'qish uchun qisqa muddatli havola (bucket private bo'lgach rasmlarni ko'rsatish uchun). */
  presignGet(key: string, expiresSeconds = 300) {
    const c = this.requireConfig();
    return this.sign(c, 'GET', c.publicEndpoint, key, expiresSeconds);
  }

  /**
   * Mijoz yuborgan kalit: chaqiruvchining o'z prefiksida, kutilgan maqsadda, obyekt omborda bor, turi va
   * hajmi chegarada. Joy egallovchi eski kalit (`photo/demo.jpg`) — `undefined` qaytadi (yozilmaydi).
   */
  async verifyKey(userId: string, key: string | null | undefined, purposes: readonly UploadPurpose[]): Promise<string | undefined> {
    if (key === undefined || key === null || key === '') return undefined;
    if (LEGACY_PLACEHOLDER_KEYS.has(key)) return undefined;
    const parsed = parseUploadKey(key);
    if (!parsed || parsed.userId !== userId || !purposes.includes(parsed.purpose)) {
      throw new DomainError('VALIDATION', "Fayl kaliti noto'g'ri yoki boshqa foydalanuvchiniki", { key });
    }
    const c = this.requireConfig();
    let res: Response;
    try {
      res = await fetch(this.sign(c, 'HEAD', c.internalEndpoint, key, 60), { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    } catch (e) {
      this.logger.warn(`S3 HEAD ${key}: ${(e as Error).message}`);
      throw new DomainError('INTERNAL', 'Fayl omborini tekshirib bo\'lmadi — qayta urinib ko\'ring');
    }
    if (res.status === 404 || res.status === 403) throw new DomainError('VALIDATION', 'Fayl yuklanmagan', { key });
    if (!res.ok) throw new DomainError('INTERNAL', `Fayl ombori javobi: ${res.status}`);
    const size = Number(res.headers.get('content-length') ?? NaN);
    const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    const max = MAX_UPLOAD_BYTES[parsed.purpose];
    if (!Number.isFinite(size) || size <= 0 || size > max || type !== TYPE_BY_EXT[parsed.ext]) {
      // Chegaradan tashqari obyekt omborda qolmasin
      await fetch(this.sign(c, 'DELETE', c.internalEndpoint, key, 60), { method: 'DELETE', signal: AbortSignal.timeout(5000) }).catch(() => undefined);
      throw new DomainError('VALIDATION', `Fayl hajmi yoki turi ruxsat etilmagan (≤ ${Math.round(max / 1024 / 1024)} MB, ${TYPE_BY_EXT[parsed.ext]})`, { key });
    }
    return key;
  }

  /**
   * Bir nechta kalit (foto ro'yxati): har biri tekshiriladi, joy egallovchilar tashlab yuboriladi.
   * `existing` — yozuvda allaqachon saqlangan (avval tekshirilgan) kalitlar: ro'yxat qayta yuborilganda
   * (masalan, tadbirkor quruvchi yuklagan fotolar bilan vazifani tahrirlasa) qayta tekshirilmaydi.
   */
  async verifyKeys(userId: string, keys: readonly string[] | null | undefined, purposes: readonly UploadPurpose[], existing: readonly string[] = []): Promise<string[]> {
    const out: string[] = [];
    for (const k of keys ?? []) {
      const v = existing.includes(k) ? k : await this.verifyKey(userId, k, purposes);
      if (v && !out.includes(v)) out.push(v);
    }
    return out;
  }
}
