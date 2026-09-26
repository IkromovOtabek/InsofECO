#!/usr/bin/env node
/**
 * Dizayn tizimi lint'i — ekran kodida hardcode qolmaganini tekshiradi.
 *
 * Qoidalar (src/design/tokens.ts dan tashqari):
 *   hex        — '#RRGGBB' rang literali (rang faqat tokenlardan)
 *   rgba       — rgba()/rgb()/hsl() rang
 *   font       — fontSize / fontWeight / fontFamily / letterSpacing (faqat Txt variantlari)
 *   radius     — borderRadius raqami (radius.* tokenlari)
 *   grid       — padding/margin/gap 4 px setkadan tashqari raqam
 *   emoji      — emoji belgilar (faqat Lucide)
 *   ionicons   — @expo/vector-icons importi yoki "-outline" ikonka nomi
 *   inline-btn — onPress qo'yilgan <View> (haqiqiy <Pressable>/<Button> kerak)
 *
 * Ishlatish: node scripts/design-lint.mjs [--fix-hint] ; chiqish kodi 1 — xato bor.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN = ['app', 'src'];
const ALLOW_FILES = new Set(['src/design/tokens.ts', 'src/design/icons.tsx']);
/** Dizayn papkasi shrift/radius raqamlarini tokenlardan yasaydi — u yerda font/radius qoidasi tekshirilmaydi. */
const DESIGN_DIR = 'src/design/';
const GRID = new Set([0, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48]);
/** 2 px — faqat hairline/ring kabi mayda tuzatishlar uchun ruxsat. */
const GRID_SOFT = new Set([2, 3, 6]);

const RULES = [
  { id: 'hex', re: /['"`]#[0-9a-fA-F]{3,8}\b/g, msg: 'hex rang — tokenlardan oling (c.*, palette)' },
  { id: 'rgba', re: /\b(rgba?|hsla?)\(/g, msg: 'rgba/hsl rang — tokenlardan oling (c.scrim, c.bgMuted …)' },
  { id: 'font', re: /\b(fontSize|fontWeight|fontFamily|letterSpacing)\s*:/g, msg: 'shrift xususiyati — <Txt v="…"> varianti ishlating', skipDesign: true },
  { id: 'radius', re: /\bborderRadius\s*:\s*\d/g, msg: 'borderRadius raqami — radius.* tokeni', skipDesign: true },
  { id: 'emoji', re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{2194}-\u{21AA}]/gu, msg: 'emoji — Lucide ikonka ishlating' },
  { id: 'ionicons', re: /@expo\/vector-icons|Ionicons|['"][a-z-]+-outline['"]/g, msg: 'Ionicons — faqat Lucide (<Icon name="…">)' },
  { id: 'inline-btn', re: /<View[^>]*\bonPress=/g, msg: '<View onPress> — haqiqiy <Pressable> yoki <Button>' },
];
const GRID_RE = /\b(padding|margin|gap|rowGap|columnGap)[A-Za-z]*\s*:\s*(-?\d+(?:\.\d+)?)\b(?!\s*[*+\-/%])/g;

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p, out); }
    else if (/\.(tsx?|mjs)$/.test(n) && !n.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const problems = [];
for (const base of SCAN) {
  for (const file of walk(join(ROOT, base))) {
    const rel = relative(ROOT, file);
    if (ALLOW_FILES.has(rel)) continue;
    const inDesign = rel.startsWith(DESIGN_DIR);
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    const lineOf = (idx) => src.slice(0, idx).split('\n').length;
    const isComment = (ln) => /^\s*(\/\/|\*|\/\*)/.test(lines[ln - 1] ?? '');
    for (const r of RULES) {
      if (r.skipDesign && inDesign) continue;
      for (const m of src.matchAll(r.re)) {
        const ln = lineOf(m.index);
        if (isComment(ln)) continue;
        problems.push({ rel, ln, id: r.id, msg: r.msg, snippet: m[0] });
      }
    }
    if (!inDesign) {
      for (const m of src.matchAll(GRID_RE)) {
        const v = Math.abs(Number(m[2]));
        if (GRID.has(v) || GRID_SOFT.has(v)) continue;
        const ln = lineOf(m.index);
        if (isComment(ln)) continue;
        problems.push({ rel, ln, id: 'grid', msg: `4 px setkadan tashqari (${m[2]}) — space.* tokeni`, snippet: m[0] });
      }
    }
  }
}

if (problems.length) {
  const byFile = new Map();
  for (const p of problems) (byFile.get(p.rel) ?? byFile.set(p.rel, []).get(p.rel)).push(p);
  for (const [f, list] of byFile) {
    console.log(`\n${f}`);
    for (const p of list) console.log(`  ${String(p.ln).padStart(4)}  ${p.id.padEnd(10)} ${p.snippet.trim().slice(0, 40).padEnd(40)} ${p.msg}`);
  }
  const counts = problems.reduce((a, p) => ((a[p.id] = (a[p.id] ?? 0) + 1), a), {});
  console.log(`\n✗ ${problems.length} ta muammo, ${byFile.size} ta fayl: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  process.exit(1);
}
console.log('✓ Dizayn lint: hardcode topilmadi');
