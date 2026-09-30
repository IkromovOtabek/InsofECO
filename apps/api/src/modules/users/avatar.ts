import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

/**
 * Profil rasmlari — diskda (`apps/api/uploads/avatars/`). S3 hali ulanmagan (storage.controller
 * faqat qolip), kichik rasm uchun disk yetarli. Fayl nomi tasodifiy — URL taxmin qilinmaydi.
 */
export const AVATAR_DIR = join(process.cwd(), 'uploads', 'avatars');
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_FILE_RE = /^[a-z0-9]{8,40}-[0-9a-f-]{36}\.(jpg|png|webp)$/;

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const avatarExt = (mime: string) => EXT[mime] ?? null;
export const AVATAR_MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function saveAvatar(userId: string, mime: string, data: Buffer): Promise<string> {
  const key = `${userId.toLowerCase()}-${randomUUID()}.${avatarExt(mime)}`;
  await mkdir(AVATAR_DIR, { recursive: true });
  await writeFile(join(AVATAR_DIR, key), data);
  return key;
}

export async function removeAvatar(key: string | null | undefined) {
  if (!key || !AVATAR_FILE_RE.test(key)) return;
  await unlink(join(AVATAR_DIR, key)).catch(() => {});
}

/** Ilova `apiUrl` ga qo'shib ishlatadi. */
export const avatarPath = (key: string | null | undefined) => (key ? `/v1/avatars/${key}` : null);
