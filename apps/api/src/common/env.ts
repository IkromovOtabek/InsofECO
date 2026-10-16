/**
 * Dev/test rejimi FAQAT aniq ko'rsatilganda: NODE_ENV=development yoki test.
 * Bo'sh yoki noma'lum qiymat prod kabi (fail-closed): ilgari `NODE_ENV !== 'production'` tekshiruvi
 * o'zgaruvchi unutilsa OTP 000000, HS256 dev kaliti, Swagger va 0.0.0.0 ni prodda ham ochib qo'yardi.
 */
export const isDevEnv = () => ['development', 'test'].includes(process.env.NODE_ENV ?? '');
