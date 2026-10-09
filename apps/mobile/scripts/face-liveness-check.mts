#!/usr/bin/env node
/**
 * Yuz skaneri jonlilik topshirig'i — `src/core/face-liveness.ts` (challenge tahlili, so'rov tanasi).
 *
 *   node scripts/face-liveness-check.mts   (yarn workspace @insof/mobile test)
 */
import {
  LIVENESS_FRAMES, MAX_FRAME_B64, facePayload, isLivenessFailed, isLivenessRequired, parseChallenge, parseTask, taskLine,
} from '../src/core/face-liveness.ts';

let fail = 0;
const ok = (name: string, cond: boolean, info?: unknown) => {
  if (cond) console.log(`  ✓ ${name}`);
  else { fail++; console.log(`  ✗ ${name}${info !== undefined ? ` — ${JSON.stringify(info)}` : ''}`); }
};

const TASK = { code: 'TURN_LEFT', text: 'Boshingizni chapga buring', hint: 'Biroz chapga buring, keyin yana kameraga qarang', icon: 'arrow-left', steps: ['Boshingizni chapga buring', 'Kameraga qarang'], frames: 3 };

console.log('── Challenge');
{
  const c = parseChallenge({ nonce: 'abc123', expiresAt: '2026-10-09T10:00:00Z', ttlSec: 120, task: TASK, livenessRequired: true });
  ok('yangi ERP: nonce + topshiriq + majburiylik', c.nonce === 'abc123' && c.task?.code === 'TURN_LEFT' && c.task.steps[1] === 'Kameraga qarang' && c.livenessRequired === true, c);
  const old = parseChallenge({ nonce: 'abc123', expiresAt: 'x', ttlSec: 120 });
  ok('eski ERP (task yo\'q): faqat nonce', old.nonce === 'abc123' && old.task === undefined && old.livenessRequired === false, old);
  ok('javob yo\'q / buzuq → bo\'sh', Object.keys(parseChallenge(null)).length === 0 && parseChallenge('x').nonce === undefined);
  ok('nonce\'siz topshiriq e\'tiborsiz', parseChallenge({ task: TASK }).task === undefined);
  ok('kadrlar soni boshqa (4) → topshiriqsiz oqim', parseTask({ ...TASK, frames: 4 }) === undefined);
  ok('steps to\'liq emas → topshiriqsiz', parseTask({ ...TASK, steps: ['faqat bitta'] }) === undefined);
  ok('ikonka bo\'lmasa koddan', parseTask({ ...TASK, icon: undefined })?.icon === 'arrow-left' && parseTask({ ...TASK, code: 'BLINK', icon: undefined })?.icon === 'eye-off');
  ok('noma\'lum kod ham qabul (server hal qiladi), ikonka zaxira', parseTask({ ...TASK, code: 'NOD', icon: undefined })?.icon === 'scan-line');
  ok('juda uzun matn kesiladi', (parseTask({ ...TASK, text: 'x'.repeat(5000) })?.text.length ?? 0) <= 200);
}

console.log('── So\'rov tanasi');
{
  const f = ['data:a', 'data:b', 'data:c'];
  const p1 = facePayload({ photo: 'data:a', frames: f, nonce: 'n1' });
  ok('topshiriq bilan: frames + nonce, photo yo\'q', p1.frames?.length === LIVENESS_FRAMES && p1.nonce === 'n1' && p1.photo === undefined, p1);
  const p2 = facePayload({ photo: 'data:a', nonce: 'n1' });
  ok('topshiriqsiz: photo + nonce', p2.photo === 'data:a' && p2.nonce === 'n1' && p2.frames === undefined, p2);
  const p3 = facePayload({ photo: 'data:a' });
  ok('eski ERP: faqat photo', p3.photo === 'data:a' && !('nonce' in p3) && !('frames' in p3), p3);
  const p4 = facePayload({ photo: 'data:a', frames: ['data:a'] });
  ok('to\'liq bo\'lmagan frames → photo', p4.photo === 'data:a' && p4.frames === undefined, p4);
}

console.log('── Matnlar va chegaralar');
{
  const t = parseTask(TASK)!;
  ok('o\'zi: topshiriq matni', taskLine(t, true) === 'Boshingizni chapga buring');
  ok('rahbar: xodimga aytadi', taskLine(t, false).startsWith('Xodimga ayting'));
  ok('xato kodlari', isLivenessFailed('LIVENESS_FAILED') && !isLivenessFailed('FACE_MISMATCH') && isLivenessRequired('LIVENESS_REQUIRED'));
  const prefix = 'data:image/jpeg;base64,'.length;
  ok('3 kadr ERP jami chegarasiga sig\'adi (4,5 M)', LIVENESS_FRAMES * (MAX_FRAME_B64 + prefix) <= 4_500_000 && MAX_FRAME_B64 + prefix <= 2_100_000);
}

console.log(fail ? `\n${fail} ta xato` : '\nHammasi o\'tdi');
process.exit(fail ? 1 : 0);
