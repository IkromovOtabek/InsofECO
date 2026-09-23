# ADR-0001 · Monorepo (yarn workspaces)

**Holat:** qabul qilindi · 2026-09-17

**Kontekst.** Backend (NestJS) va mobil (Expo) ikkalasi TypeScript. Buyurtma/reys holatlari, validatsiya sxemalari, xato kodlari ikkala tomonda bir xil bo'lishi shart.

**Qaror.** Bitta repo: `apps/api`, `apps/mobile`, `packages/shared`. `@insof/shared` — zod sxemalar, enumlar, state-machine jadvallari, xato kodlari. Yarn 1 workspaces (Expo bilan eng muammosiz), kelajakda Turborepo.

**Oqibat.** + Bitta PR da API + mobil o'zgaradi, tiplar sinxron. − Mobil build `packages/shared` ni transpile qilishi kerak (Metro `watchFolders`).
