import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Statik tekshiruv (Insof ERP `scripts/qa/c-no-sms.ts` bilan bir xil g'oya): SMS kanali olib tashlangan,
 * bir martalik kodlar FAQAT Telegram (Gateway) orqali. Manbada SMS provayderi (Eskiz), SmsPort/SmsModule,
 * SMS env kalitlari va `'sms'` kanali qaytib kelmasin.
 *
 * Eslatma: hujjat/izohlardagi "SMS" so'zi tekshirilmaydi — faqat kod yo'llari.
 */
const ROOT = join(__dirname, '..', '..', '..');
const SELF = relative(ROOT, __filename);

const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: 'Eskiz provayderi', re: /eskiz/i },
  { name: 'SmsPort / SmsModule / sms adapter', re: /\bSmsPort\b|\bSmsModule\b|\bSmsAdapter\b|FakeSmsAdapter/ },
  { name: 'infra/sms moduli', re: /infra\/sms\b/ },
  { name: 'sms.send / sendSms', re: /\bsms\.send\b|\bsendSms\w*\b/ },
  { name: 'SMS_PROVIDER env kaliti', re: /SMS_PROVIDER|SMS_FALLBACK/ },
  { name: "'sms' kanali", re: /["']sms["']/ },
];

const SKIP = new Set(['node_modules', 'dist', '.git', '.expo', 'ios', 'android', 'generated']);
const EXT = /\.(ts|tsx|js|mjs|cjs|sh|ya?ml)$/;

function walk(dir: string, out: string[]) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.test(name)) out.push(p);
  }
}

describe("SMS kanali yo'q (statik)", () => {
  const files: string[] = [];
  for (const d of ['apps/api/src', 'apps/api/scripts', 'apps/api/prisma', 'apps/mobile/src', 'apps/mobile/app', 'packages/shared/src', 'infra', 'scripts']) walk(join(ROOT, d), files);
  const targets = files.filter((f) => relative(ROOT, f) !== SELF);
  for (const f of ['apps/api/.env.example', 'infra/.env.example', '.env.example']) if (existsSync(join(ROOT, f))) targets.push(join(ROOT, f));

  it.each(FORBIDDEN)('manbada yo\'q: $name', ({ re }) => {
    const hits = targets.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  it("apps/api/src/infra/sms papkasi yo'q", () => {
    expect(existsSync(join(ROOT, 'apps/api/src/infra/sms'))).toBe(false);
  });

  it('OTP faqat Telegram Gateway orqali', () => {
    const otp = readFileSync(join(ROOT, 'apps/api/src/modules/auth/otp.service.ts'), 'utf8');
    expect(otp).toMatch(/telegram\.sendCode\(/);
    const deliveries = readFileSync(join(ROOT, 'apps/api/src/modules/deliveries/deliveries.service.ts'), 'utf8');
    expect(deliveries).toMatch(/telegram\.sendCode\(/);
  });
});
