# ADR-0004 · Telefon + OTP autentifikatsiya

**Holat:** qabul qilindi · 2026-09-17

**Qaror.** Parol yo'q. Telefon raqam (+998) → SMS OTP (Eskiz) → JWT access (15 daq, RS256) + refresh (30 kun, bir martalik, rotatsiya, reuse-detection). Qurilma `deviceId` sessiyaga bog'lanadi. Tashkilotga taklif — telefon raqam bo'yicha (Tadbirkor haydovchi raqamini kiritadi → haydovchi kirganda a'zolik tayyor).

**Xavflar.** SMS narxi/kechikishi → 2-bosqichda Telegram-bot orqali OTP alternativa. SIM-swap → muhim amallar (to'lov, tashkilot o'zgarishi) qayta OTP.
