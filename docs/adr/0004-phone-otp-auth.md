# ADR-0004 · Telefon + OTP autentifikatsiya

**Holat:** qabul qilindi · 2026-09-17

**Qaror.** Parol yo'q. Telefon raqam (+998) → OTP Telegram Gateway orqali (SMS yo'q; 2026-10 dan Eskiz olib tashlandi, Insof ERP bilan bir xil) → JWT access (15 daq, RS256) + refresh (30 kun, bir martalik, rotatsiya, reuse-detection). Qurilma `deviceId` sessiyaga bog'lanadi. Tashkilotga taklif — telefon raqam bo'yicha (Tadbirkor haydovchi raqamini kiritadi → haydovchi kirganda a'zolik tayyor).

**Xavflar.** Raqamda Telegram bo'lmasa kod yetmaydi → javob baribir neytral (raqam oshkor bo'lmasin), sabab server jurnalida; foydalanuvchi parol yoki Telegram bot (kontakt ulashish) bilan kiradi. SIM-swap → muhim amallar (to'lov, tashkilot o'zgarishi) qayta OTP.
