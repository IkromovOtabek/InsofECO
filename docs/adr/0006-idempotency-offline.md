# ADR-0006 · Idempotency-Key va offline outbox

**Holat:** qabul qilindi · 2026-09-17

**Kontekst.** Haydovchi qishloqda, internet uzilib turadi. "Yetib keldim" tugmasi ikki marta bosilishi yoki so'rov timeout bo'lib qayta yuborilishi mumkin.

**Qaror.** Har yozuvchi so'rovda `Idempotency-Key` (UUIDv7, mobil generatsiya qiladi). Backend `IdempotencyInterceptor`: kalit + foydalanuvchi → Redis'da 24 soat javob saqlanadi; takror so'rov o'sha javobni oladi. Mobil: `outbox` navbat (MMKV), FIFO, tarmoq qaytganda avtomatik yuboriladi; optimistik UI.
