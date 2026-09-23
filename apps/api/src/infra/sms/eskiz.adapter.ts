import { Injectable, Logger } from '@nestjs/common';
import { SmsPort } from './sms.port';

/**
 * Eskiz.uz — O'zbekiston SMS shlyuzi.
 *
 * Sozlash: SMS_PROVIDER=ESKIZ, ESKIZ_EMAIL, ESKIZ_PASSWORD (kabinet paroli emas —
 * "Sozlamalar → API" dagi API paroli), ESKIZ_FROM (tasdiqlangan jo'natuvchi nomi).
 *
 * Token 30 kun yashaydi va shu yerda keshlanadi. 401 kelsa token bekor qilingan —
 * bir marta yangilab qayta urinamiz, aks holda servis qayta ishga tushmaguncha SMS to'xtardi.
 */
@Injectable()
export class EskizAdapter extends SmsPort {
  private readonly logger = new Logger(EskizAdapter.name);
  private token: { value: string; exp: number } | null = null;

  private async getToken(force = false): Promise<string> {
    if (!force && this.token && this.token.exp > Date.now()) return this.token.value;
    const email = process.env.ESKIZ_EMAIL;
    const password = process.env.ESKIZ_PASSWORD;
    if (!email || !password) throw new Error('ESKIZ_EMAIL / ESKIZ_PASSWORD sozlanmagan');

    // Eskiz hujjatiga ko'ra multipart/form-data; content-type'ni fetch o'zi qo'yadi
    const form = new FormData();
    form.set('email', email);
    form.set('password', password);
    const r = await fetch('https://notify.eskiz.uz/api/auth/login', { method: 'POST', body: form });
    const body = await r.text();
    if (!r.ok) throw new Error(`Eskiz token olinmadi (${r.status}): ${body.slice(0, 200)}`);

    const value = (JSON.parse(body) as { data?: { token?: string } }).data?.token;
    if (!value) throw new Error(`Eskiz tokeni javobda yo'q: ${body.slice(0, 200)}`);
    this.token = { value, exp: Date.now() + 25 * 24 * 3600_000 };
    return value;
  }

  /** `4546` — Eskiz sinov nomi: SMS "yuborildi" bo'ladi, lekin haqiqiy raqamga yetmaydi. */
  private get from() {
    return process.env.ESKIZ_FROM?.trim() || '4546';
  }

  private post(phone: string, text: string, token: string) {
    const form = new FormData();
    form.set('mobile_phone', phone.replace(/\D+/g, ''));
    form.set('message', text);
    form.set('from', this.from);
    return fetch('https://notify.eskiz.uz/api/message/sms/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
  }

  /**
   * Xatoni YUTMAYDI — tashlaydi. Aks holda OTP "yuborildi" deb qaytadi-yu,
   * foydalanuvchi hech qachon kelmaydigan kodni kutib o'tiraveradi.
   */
  async send(phone: string, text: string): Promise<void> {
    let r = await this.post(phone, text, await this.getToken());
    if (r.status === 401) r = await this.post(phone, text, await this.getToken(true));

    const body = await r.text().catch(() => '');
    if (!r.ok) {
      this.logger.error(`Eskiz ${r.status}: ${body.slice(0, 300)}`);
      throw new Error(`Eskiz ${r.status}: ${body.slice(0, 300)}`);
    }

    // 200 bo'lib, ichida rad javobi kelishi mumkin (moderatsiyadan o'tmagan matn va h.k.)
    try {
      const j = JSON.parse(body) as { status?: string; message?: string };
      if (j.status && !['waiting', 'success', 'ok'].includes(j.status.toLowerCase())) {
        throw new Error(`Eskiz rad etdi: ${j.status} — ${j.message ?? ''}`.trim());
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Eskiz rad etdi')) {
        this.logger.error(e.message);
        throw e;
      }
    }
  }
}
