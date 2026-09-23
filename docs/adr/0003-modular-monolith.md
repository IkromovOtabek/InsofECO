# ADR-0003 · Modulli monolit, mikroservis emas

**Holat:** qabul qilindi · 2026-09-17

**Kontekst.** 1-bosqichda 1 zavod, ~50 haydovchi, ~500 quruvchi. Tranzaksiyalar domenlar aro (buyurtma→reys→faktura).

**Qaror.** Bitta NestJS ilova, qat'iy modul chegaralari, modullar aro faqat domen hodisalari (`EventEmitter2`) va servis interfeyslari. Bitta Postgres. Fon ishlar — o'sha kodbazadan alohida `worker` prosess sifatida ishga tushadi.

**Oqibat.** + Oddiy deploy, ACID, tez ishlab chiqish. − Vertikal masshtab chegarasi (SaaS bosqichida `tracking` modulini birinchi ajratamiz — eng yuqori yuk o'sha yerda).
