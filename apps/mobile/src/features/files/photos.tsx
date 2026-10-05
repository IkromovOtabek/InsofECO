import React, { useCallback, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type * as ImagePickerNS from 'expo-image-picker';
import { Button, IconButton, Txt } from '@/design/primitives';
import { dialog, toast } from '@/design/ui';
import { useTheme } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { api, fetchWithTimeout } from '@/core/api';

/**
 * Haqiqiy foto: kamera (expo-image-picker) → `POST /files/presign` → PUT (S3/MinIO) → kalit.
 * Kalit amal bilan birga serverga ketadi (yetkazish fotosi, ish topshirish fotolari).
 *
 * Native modul eski dev build'da bo'lmasligi mumkin — to'g'ridan-to'g'ri import ilovani yiqitardi,
 * shuning uchun faqat modul bor bo'lsa yuklanadi; yo'q bo'lsa foto tugmasi ko'rinmaydi (foto ixtiyoriy).
 */
const ImagePicker: typeof ImagePickerNS | null = requireOptionalNativeModule('ExponentImagePicker')
  ? (require('expo-image-picker') as typeof ImagePickerNS)
  : null;

export type UploadPurpose = 'waybill' | 'signature' | 'dispute' | 'report';
type Mime = 'image/jpeg' | 'image/png' | 'image/webp';
const MIMES: Mime[] = ['image/jpeg', 'image/png', 'image/webp'];

export interface LocalPhoto { id: string; uri: string; mimeType: Mime; /** Yuklangandan keyin — qayta yuborishda qayta yuklanmaydi */ key?: string }

/** Kamera ochiladi. `front` — old kamera (selfi). Bekor qilinsa yoki ruxsat yo'q bo'lsa `null`. */
export async function takePhoto(opts: { front?: boolean } = {}): Promise<Omit<LocalPhoto, 'id'> | null> {
  if (!ImagePicker) return null;
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    toast.warning("Sozlamalarda ilovaga kamera ruxsatini bering", 'Kamera ruxsati yo\'q');
    return null;
  }
  const r = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.6,
    exif: false,
    cameraType: opts.front ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
  });
  const a = r.canceled ? null : r.assets[0];
  if (!a) return null;
  const mime = (MIMES as string[]).includes(a.mimeType ?? '') ? (a.mimeType as Mime) : 'image/jpeg';
  return { uri: a.uri, mimeType: mime };
}

/** Faylni presigned URL orqali omborga yuklaydi va kalitini qaytaradi. */
export async function uploadPhoto(photo: { uri: string; mimeType: Mime }, purpose: UploadPurpose): Promise<string> {
  const p = await api<{ key: string; url: string; method: 'PUT'; headers: Record<string, string> }>('/files/presign', {
    method: 'POST', body: { contentType: photo.mimeType, purpose },
  });
  const blob = await (await fetch(photo.uri)).blob();
  const r = await fetchWithTimeout(p.url, { method: p.method ?? 'PUT', headers: p.headers, body: blob }, 120_000);
  if (!r.ok) throw new Error(`Foto yuklanmadi (${r.status})`);
  return p.key;
}

/**
 * Amalga biriktiriladigan fotolar. `uploadAll()` — hali yuklanmaganlarini yuklaydi va barcha
 * kalitlarni qaytaradi; yuklangan foto qayta yuborishda qayta yuklanmaydi.
 */
export function usePhotoAttachments(purpose: UploadPurpose, max = 1) {
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const ref = useRef<LocalPhoto[]>([]);
  ref.current = photos;

  const add = useCallback(async (front = false) => {
    const p = await takePhoto({ front });
    if (!p) return;
    const item = { ...p, id: `${Date.now()}-${Math.random().toString(16).slice(2)}` };
    setPhotos((list) => (max === 1 ? [item] : [...list, item].slice(-max)));
  }, [max]);

  const remove = useCallback((id: string) => setPhotos((list) => list.filter((x) => x.id !== id)), []);
  const clear = useCallback(() => setPhotos([]), []);

  const uploadAll = useCallback(async (): Promise<string[]> => {
    setBusy(true);
    try {
      const keys: string[] = [];
      for (const ph of ref.current) {
        const key = ph.key ?? (await uploadPhoto(ph, purpose));
        if (!ph.key) setPhotos((list) => list.map((x) => (x.id === ph.id ? { ...x, key } : x)));
        keys.push(key);
      }
      return keys;
    } finally {
      setBusy(false);
    }
  }, [purpose]);

  return { photos, add, remove, clear, uploadAll, busy, available: !!ImagePicker, max };
}

/**
 * Fotolarni yuklab, amalni bajaradi. Yuklash yiqilsa — "Qayta urinish" yoki (foto ixtiyoriy bo'lsa)
 * "Fotosiz yuborish". `run(keys)` — kalitlar bilan haqiqiy amal.
 */
export async function withUploadedPhotos(att: ReturnType<typeof usePhotoAttachments>, run: (keys: string[]) => void, onAbort?: () => void) {
  if (!att.photos.length) { run([]); return; }
  try {
    run(await att.uploadAll());
  } catch {
    dialog('Foto yuklanmadi', "Internet sekin yoki uzilgan bo'lishi mumkin.", [
      { text: 'Qayta urinish', onPress: () => void withUploadedPhotos(att, run, onAbort) },
      { text: 'Fotosiz yuborish', onPress: () => run([]) },
      { text: 'Yopish', style: 'cancel', onPress: onAbort },
    ], { tone: 'warning', icon: 'camera' });
  }
}

/** Foto bloki: kichik rasmlar (o'chirish tugmasi bilan) + "Foto olish". Kamera moduli yo'q bo'lsa — hech narsa. */
export function PhotoAttachments({ att, label = 'Foto olish', hint, front }: { att: ReturnType<typeof usePhotoAttachments>; label?: string; hint?: string; front?: boolean }) {
  const { c } = useTheme();
  if (!att.available) return null;
  const thumb = size.driverTouch + space.sm;
  const full = att.photos.length >= att.max;
  return (
    <View style={{ gap: space.sm }}>
      {att.photos.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {att.photos.map((p, i) => (
            <View key={p.id}>
              <Image source={{ uri: p.uri }} style={{ width: thumb, height: thumb, borderRadius: radius.md, backgroundColor: c.bgMuted }} accessibilityLabel={`${i + 1}-foto`} accessibilityIgnoresInvertColors />
              <View style={{ position: 'absolute', top: -space.sm, right: -space.sm }}>
                <IconButton icon="x" label={`${i + 1}-fotoni o'chirish`} variant="secondary" size={size.iconTileSm} onPress={() => att.remove(p.id)} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {hint && !att.photos.length ? <Txt v="caption" color="muted">{hint}</Txt> : null}
      {!full || att.max === 1 ? (
        <Button
          title={att.photos.length && att.max === 1 ? 'Qayta olish' : label}
          icon="camera" variant="secondary" size="md"
          disabled={att.busy}
          onPress={() => void att.add(front)}
        />
      ) : null}
    </View>
  );
}
