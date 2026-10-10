/**
 * Yuz skaneri "jonlilik" (liveness) topshirig'i — ERP `GET /api/mobile/attendance/challenge` javobi va kadrlar rejasi.
 * React/native importi yo'q (sof mantiq) — `scripts/face-liveness-check.mts` da sinaladi.
 *
 * Yangi ERP challenge'da `task` beradi (masalan "Boshingizni chapga buring"); ilova topshiriqni katta qilib ko'rsatadi va
 * 3 kadr oladi: [0] — topshiriqdan oldin (yuz to'g'ri; server shu kadrni dalil sifatida saqlaydi), [1] — `steps[0]`
 * ko'rsatilgach (bosh burilgan / ko'z yumuq), [2] — `steps[1]` dan keyin. Kadrlar `frames` qilib yuboriladi.
 * Eski ERP'da `task` yo'q (yoki challenge'ning o'zi yo'q) — eskicha bitta kadr (`photo`).
 */

export type FaceTaskCode = 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT';
export interface FaceTask {
  code: string;
  /** Asosiy matn: "Boshingizni chapga buring". */
  text: string;
  /** Qisqa izoh: "Biroz chapga buring, keyin yana kameraga qarang". */
  hint: string;
  /** Lucide ikonka nomi (server beradi; noma'lum bo'lsa koddan). */
  icon: string;
  /** [1] va [2] kadrdan oldingi ko'rsatmalar. */
  steps: [string, string];
  frames: number;
}
export interface FaceChallenge {
  nonce?: string;
  task?: FaceTask;
  /** Server jonlilikni majburiy qilgan (`MOBILE_FACE_LIVENESS_REQUIRED`). */
  livenessRequired?: boolean;
}

/** Ilova faqat shu sondagi ketma-ketlikni biladi; boshqa son kelsa — topshiriqsiz (eski) oqim. */
export const LIVENESS_FRAMES = 3;
/** Bitta kadr base64 chegarasi — ERP har kadrga 2,1 M, jami 4,5 M belgi beradi; 3 × 1,4 M + prefikslar sig'adi. */
export const MAX_FRAME_B64 = 1_400_000;
/** Kamera tayyor bo'lgach [0] kadrgacha — topshiriqni o'qib olish va yuzni ramkaga joylash vaqti. */
export const TASK_SETTLE_MS = 1800;
/** `steps[0]` ko'rsatilgandan [1] kadrgacha (boshni burish / ko'zni yumish uchun). */
export const STEP1_MS = 700;
/** `steps[1]` ko'rsatilgandan [2] kadrgacha. */
export const STEP2_MS = 350;
/**
 * Yuzni ro'yxatga olishda `steps[1]` ("Kameraga qarang") dan [2] kadrgacha. ERP namunani faqat to'g'ri qaragan kadrdan
 * oladi va 1-bosqichda [2] ham to'g'ri bo'lishini talab qiladi (burun [0] ga nisbatan ≤ 0,08 siljigan) — 350 ms da
 * bosh burilishdan hali qaytmagan bo'ladi va ro'yxatga olish qayta-qayta rad etiladi. Jonlilikka zarari yo'q: burilish
 * [1] kadrda o'lchanadi. Kiosk/"Keldim"da [2] ixtiyoriy probe — u yerda tezlik uchun `STEP2_MS`.
 */
export const ENROLL_STEP2_MS = 1300;

const ICON_OF: Record<FaceTaskCode, string> = { BLINK: 'eye-off', TURN_LEFT: 'arrow-left', TURN_RIGHT: 'arrow-right' };
const str = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Server javobidan topshiriq: maydonlar to'liq va kadrlar soni `LIVENESS_FRAMES` bo'lsagina, aks holda undefined. */
export function parseTask(raw: unknown): FaceTask | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const t = raw as Record<string, unknown>;
  const code = str(t.code, 40);
  const text = str(t.text);
  const steps = Array.isArray(t.steps) ? t.steps.map((s) => str(s)) : [];
  if (!code || !text || steps.length !== 2 || !steps[0] || !steps[1]) return undefined;
  if (t.frames !== LIVENESS_FRAMES) return undefined;
  const icon = str(t.icon, 40) ?? ICON_OF[code as FaceTaskCode] ?? 'scan-line';
  return { code, text, hint: str(t.hint) ?? '', icon, steps: [steps[0], steps[1]], frames: LIVENESS_FRAMES };
}

/** `GET /attendance/challenge` javobi → `FaceChallenge` (noto'g'ri qismlar tashlanadi). */
export function parseChallenge(raw: unknown): FaceChallenge {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const nonce = str(r.nonce, 100) ?? undefined;
  // Topshiriq nonce'siz ma'nosiz (server topshiriqni nonce'dan oladi)
  const task = nonce ? parseTask(r.task) : undefined;
  return { nonce, task, livenessRequired: r.livenessRequired === true };
}

/** Topshiriq bo'yicha ko'rsatma: o'zi (old kamera) yoki rahbar xodimga aytadi (orqa kamera). */
export function taskLine(task: FaceTask, self: boolean): string {
  return self ? task.text : `Xodimga ayting: «${task.text}»`;
}

/** So'rov tanasidagi yuz qismi: topshiriq bo'lsa `frames`, aks holda `photo`; nonce bo'lsa qo'shiladi. */
export function facePayload(shot: { photo: string; frames?: string[]; nonce?: string }): { photo?: string; frames?: string[]; nonce?: string } {
  const base = shot.frames && shot.frames.length === LIVENESS_FRAMES ? { frames: shot.frames } : { photo: shot.photo };
  return shot.nonce ? { ...base, nonce: shot.nonce } : base;
}

/** Server xato kodlari — topshiriq bajarilmadi (qayta urinish mantiqli) yoki ilova eski. */
export const isLivenessFailed = (code: string | undefined) => code === 'LIVENESS_FAILED';
export const isLivenessRequired = (code: string | undefined) => code === 'LIVENESS_REQUIRED';
