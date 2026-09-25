import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api, deviceId } from '@/core/api';
import { Profile } from '@/core/session';

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
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  registerPush: (expoPushToken: string) => api('/me/devices', { method: 'PUT', body: { deviceId: deviceId(), expoPushToken } }),
};
