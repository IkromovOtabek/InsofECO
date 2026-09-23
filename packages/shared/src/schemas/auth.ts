import { z } from 'zod';
import { PhoneSchema } from './common';

export const OtpRequestSchema = z.object({ phone: PhoneSchema });
export type OtpRequest = z.infer<typeof OtpRequestSchema>;

export const DeviceInfoSchema = z.object({
  deviceId: z.string().min(8).max(128),
  platform: z.enum(['ios', 'android']),
  model: z.string().max(80).optional(),
  appVersion: z.string().max(20).optional(),
});

export const OtpVerifySchema = z.object({
  phone: PhoneSchema,
  code: z.string().regex(/^\d{6}$/),
  device: DeviceInfoSchema,
});
export type OtpVerify = z.infer<typeof OtpVerifySchema>;

export const RefreshSchema = z.object({ refreshToken: z.string().min(20) });

export const PushTokenSchema = z.object({
  deviceId: z.string().min(8),
  expoPushToken: z.string().startsWith('ExponentPushToken['),
});

/** Parol bilan ro'yxatdan o'tish. Rolga qarab qo'shimcha maydonlar. */
export const PasswordSchema = z.string().min(6, 'Parol kamida 6 belgi').max(64);

export const RegisterSchema = z
  .object({
    fullName: z.string().min(2, 'Ism kamida 2 harf').max(80),
    phone: PhoneSchema,
    password: PasswordSchema,
    role: z.enum(['TADBIRKOR', 'QURUVCHI', 'HAYDOVCHI']),
    /** TADBIRKOR / QURUVCHI: o'z tashkiloti */
    organization: z.object({ name: z.string().min(2).max(120), type: z.enum(['PLANT', 'CONTRACTOR']) }).optional(),
    /** HAYDOVCHI: qaysi zavodga ishga kiradi (Tadbirkor tasdiqlaydi) */
    plantOrgId: z.string().optional(),
    device: DeviceInfoSchema,
  })
  .superRefine((v, ctx) => {
    if (v.role === 'TADBIRKOR' && !v.organization) ctx.addIssue({ code: 'custom', path: ['organization'], message: 'Tashkilot nomi kerak' });
    if (v.role === 'HAYDOVCHI' && !v.plantOrgId) ctx.addIssue({ code: 'custom', path: ['plantOrgId'], message: 'Zavodni tanlang' });
  });
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({ phone: PhoneSchema, password: PasswordSchema, device: DeviceInfoSchema });
export type LoginInput = z.infer<typeof LoginSchema>;

// ───────────────────────── Parolni tiklash va o'zgartirish ─────────────────────────

/** 1-qadam: raqamga tasdiqlash kodi yuboriladi (OTP bilan bir xil kanal). */
export const ForgotPasswordSchema = z.object({ phone: PhoneSchema });
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

/** 2-qadam: kod + yangi parol. Muvaffaqiyatda barcha eski seanslar yopiladi. */
export const ResetPasswordSchema = z.object({
  phone: PhoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Kod 6 xonali'),
  password: PasswordSchema,
  device: DeviceInfoSchema,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

/** Tizimga kirgan holda parolni almashtirish (Profil → Xavfsizlik). */
export const ChangePasswordSchema = z.object({
  current: PasswordSchema,
  next: PasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
