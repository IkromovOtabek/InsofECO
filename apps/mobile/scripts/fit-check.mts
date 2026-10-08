#!/usr/bin/env node
/**
 * Yorliq sig'dirish (fitScale) tekshiruvi — Android "Skladga kirim qilish" shrifti maydalanishi regressiyasi.
 *
 * Native `adjustsFontSizeToFit` Fabric'da `minimumFontScale`ni o'qimaydi va Android'da shriftni qayta
 * kattalashtirmaydi; shuning uchun tugma/raqam o'lchami JS da (`fitScale`) hisoblanadi. Bu skript:
 *   · 360 dp va 411 dp telefon, tizim shrifti 1.0 / 1.3 (tugmada 1.2 bilan cheklangan) — tugma yorlig'i
 *     hech qachon MIN_FONT_SCALE (0.85) dan kichraymaydi;
 *   · klaviatura ochilib-yopilganda (kenglik o'zgarib qaytganda) shrift ASLIGA qaytadi (to'planib kichraymaydi);
 *   · kodda native `adjustsFontSizeToFit` qolmagan (faqat izohlarda).
 *
 *   node scripts/fit-check.mts   (yarn workspace @insof/mobile test)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CHROME_SCALE, MIN_FONT_SCALE, fitScale, space, textRoom, type } from '../src/design/tokens.ts';

let fail = 0;
const ok = (name: string, cond: boolean, info?: unknown) => {
  if (cond) console.log(`  ✓ ${name}`);
  else { fail++; console.log(`  ✗ ${name}${info !== undefined ? ` — ${JSON.stringify(info)}` : ''}`); }
};

/** `Button` bilan bir xil hisob (primitives.tsx): kenglik → shrift nisbati, ikonka/padding chiqarilgan. */
function buttonScale(title: string, width: number, fontScale: number, variant: keyof typeof type = 'button', padX: number = space.xl) {
  const textW = textRoom(title, type[variant].fontSize) * Math.min(Math.max(fontScale, 1), CHROME_SCALE);
  const tight = textW + 2 * padX > width;
  const cramped = tight && textW + 2 * padX > width;
  const room = width - 2 * (cramped ? space.md : padX);
  return textW > room ? Math.max(MIN_FONT_SCALE, room / textW) : 1;
}

console.log('── Tugma yorlig\'i: 360/411 dp, tizim shrifti 1.0 va 1.3');
const sheetW = (screen: number) => screen - 2 * space.xxl; // Sheet footer: paddingHorizontal xxl
for (const screen of [360, 411]) {
  for (const fs of [1, 1.3]) {
    for (const label of ['Skladga kirim qilish', 'Qabul qildim — skladga kirim', "Faktni saqlash (hali qabul emas)", 'Smenani yopish va hisobot yuborish', "To'lovni saqlash"]) {
      const k = buttonScale(label, sheetW(screen), fs);
      ok(`${screen} dp · ${fs}× · «${label}» → ${k.toFixed(2)} ≥ ${MIN_FONT_SCALE}`, k >= MIN_FONT_SCALE - 1e-9, k);
    }
  }
}
ok('yangi qisqa yorliq «Skladga kirim qilish» 360 dp, 1.0× — kichraymaydi', buttonScale('Skladga kirim qilish', sheetW(360), 1) === 1);

console.log('\n── Klaviatura: kenglik qisqarib qaytsa — shrift asliga qaytadi');
const label = 'Qabul qildim — skladga kirim';
const fsPx = type.button.fontSize;
const before = fitScale(label, fsPx, 400);
const squeezed = fitScale(label, fsPx, 120); // vaqtinchalik tor joylashuv
const after = fitScale(label, fsPx, 400);
ok(`tor holatda ham ${MIN_FONT_SCALE} dan past emas (${squeezed.toFixed(2)})`, squeezed >= MIN_FONT_SCALE);
ok(`qaytganda o'sha o'lcham: ${before} → ${after}`, before === after && after === 1);
// 50 marta klaviatura ochilib-yopildi: har safar asl o'lchamdan hisoblanadi (native Android kichraygandan boshlardi)
let k = 1;
for (let i = 0; i < 50; i++) { k = fitScale(label, fsPx, 150); k = fitScale(label, fsPx, 400); }
ok(`50 marta ochilib-yopilgandan keyin ham to'liq o'lcham (${k.toFixed(2)})`, k === 1);

console.log('\n── Ko\'p qatorli yorliq (tezkor amallar, 2 qator)');
const tile = 74 - 6;
const kq = fitScale("To'lov qabul qilish", type.actionLabel.fontSize * CHROME_SCALE, tile, 0.9, 2);
ok(`«To'lov qabul qilish» 74 dp plitkada → ${kq.toFixed(2)} ≥ 0.9`, kq >= 0.9);
ok('kenglik 0 (hali o\'lchanmagan) → 1', fitScale('x', 10, 0) === 1);
ok(`min shrift o'qiladigan: tugma ${(type.button.fontSize * MIN_FONT_SCALE).toFixed(1)} dp ≥ 14`, type.button.fontSize * MIN_FONT_SCALE >= 14);

console.log('\n── Kodda native adjustsFontSizeToFit qolmagan');
const ROOT = new URL('..', import.meta.url).pathname;
const walk = (d: string, out: string[] = []) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p, out); } else if (/\.tsx?$/.test(n)) out.push(p); } return out; };
const hits: string[] = [];
for (const base of ['app', 'src']) {
  for (const f of walk(join(ROOT, base))) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)) return;
      if (/\badjustsFontSizeToFit\b|\bminimumFontScale\b/.test(line)) hits.push(`${relative(ROOT, f)}:${i + 1}`);
    });
  }
}
ok('adjustsFontSizeToFit / minimumFontScale ishlatilmaydi', hits.length === 0, hits);

console.log(fail ? `\n✗ ${fail} ta tekshiruv yiqildi` : '\n✓ Hammasi o\'tdi');
process.exit(fail ? 1 : 0);
