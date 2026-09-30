import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api, deviceId } from '@/core/api';
import { Profile } from '@/core/session';
import { config } from '@/core/config';

/** Serverdagi `/v1/avatars/<fayl>` → to'liq manzil (`<Image>` uchun). */
export const avatarUri = (path?: string | null) => (path ? `${config.apiUrl}${path}` : null);

function deviceInfo() {
  return { deviceId: deviceId(), platform: Platform.OS as 'ios' | 'android', model: Device.modelName ?? undefined, appVersion: Constants.expoConfig?.version };
}

export const authApi = {
  requestOtp: (phone: string) => api<{ retryAfter: number }>('/auth/otp/request', { method: 'POST', body: { phone }, auth: false }),
  verifyOtp: (phone: string, code: string) =>
    api<{ accessToken: string; refreshToken: string; user: Profile }>('/auth/otp/verify', { method: 'POST', body: { phone, code, device: deviceInfo() }, auth: false }),
  register: (input: { fullName: string; phone: string; password: string; role: 'TADBIRKOR' | 'QURUVCHI' | 'HAYDOVCHI'; organization?: { name: string; type: 'PLANT' | 'CONTRACTOR' }; plantOrgId?: string }) =>
    api<{ accessToken: string; refreshToken: string; user: Profile }>('/auth/register', { method: 'POST', body: { ...input, device: deviceInfo() }, auth: false }),
  login: (phone: string, password: string) =>
    api<{ accessToken: string; refreshToken: string; user: Profile }>('/auth/login', { method: 'POST', body: { phone, password, device: deviceInfo() }, auth: false }),
  /** Telegram orqali kirish: bot havolasi (5 daqiqa amal qiladi). */
  telegramStart: () => api<{ nonce: string; url: string; expiresIn: number }>('/auth/telegram/start', { method: 'POST', auth: false }),
  /** Botda raqam ulashilganmi — `pending` yoki sessiya. */
  telegramPoll: (nonce: string) =>
    api<{ status: 'pending' } | { status: 'ok'; accessToken: string; refreshToken: string; user: Profile }>('/auth/telegram/poll', { method: 'POST', body: { nonce, device: deviceInfo() }, auth: false }),
  /** Roli yo'q foydalanuvchi (Telegram/SMS bilan kirgan) mijoz (quruvchi) bo'ladi — yangilangan profil. */
  becomeCustomer: () => api<Profile>('/auth/customer', { method: 'POST' }),
  /** Parolni tiklash: raqamga kod yuborish. Hisob yo'q bo'lsa ham javob bir xil. */
  forgotPassword: (phone: string) =>
    api<{ retryAfter: number }>('/auth/password/forgot', { method: 'POST', body: { phone }, auth: false }),
  /** Kod + yangi parol → barcha eski seanslar yopiladi, shu qurilmaga yangi seans beriladi. */
  resetPassword: (phone: string, code: string, password: string) =>
    api<{ accessToken: string; refreshToken: string; user: Profile }>('/auth/password/reset', { method: 'POST', body: { phone, code, password, device: deviceInfo() }, auth: false }),
  /** Tizimga kirgan holda parolni almashtirish. */
  changePassword: (current: string, next: string) =>
    api<{ ok: true }>('/auth/password/change', { method: 'POST', body: { current, next } }),
  plants: () => api<{ id: string; name: string; address?: string | null }[]>('/organizations/plants', { auth: false }),
  me: () => api<Profile>('/me'),
  /** Profil rasmi — ro'yxatdan o'tgach (sessiya bilan) yuboriladi. `uri` — image-picker fayli. */
  uploadAvatar: (uri: string, mimeType = 'image/jpeg') => {
    const fd = new FormData();
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    // RN FormData fayl uchun { uri, name, type } obyektini qabul qiladi
    fd.append('photo', { uri, name: `avatar.${ext}`, type: mimeType } as unknown as Blob);
    return api<Profile>('/me/avatar', { method: 'PUT', body: fd });
  },
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  /** Hisobni o'chirish (do'kon talabi). Mijoz — darhol `deleted`; zavod haydovchisi — `requested` (direktor tasdiqlaydi). */
  deleteAccount: () => api<{ status: 'deleted' | 'requested' }>('/me', { method: 'DELETE' }),
  cancelDeletion: () => api<{ ok: true }>('/me/deletion', { method: 'DELETE' }),
  registerPush: (expoPushToken: string) => api('/me/devices', { method: 'PUT', body: { deviceId: deviceId(), expoPushToken } }),
};
