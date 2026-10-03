import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type * as ImagePickerNS from 'expo-image-picker';
import { Txt } from '@/design/primitives';
import { Icon } from '@/design/icons';
import { radius, shadow, size, space } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { TextLink } from '@/features/auth/ui';

export interface PickedPhoto { uri: string; mimeType: string }

/**
 * expo-image-picker native modul — eski dev build'da (modul qo'shilishidan oldin yig'ilgan)
 * yo'q bo'ladi va to'g'ridan-to'g'ri import butun ilovani yiqitadi. Shuning uchun faqat
 * native modul mavjud bo'lsa yuklaymiz; bo'lmasa rasm tanlash bloki ko'rsatilmaydi.
 */
const ImagePicker: typeof ImagePickerNS | null = requireOptionalNativeModule('ExponentImagePicker')
  ? (require('expo-image-picker') as typeof ImagePickerNS)
  : null;

const OPTS: ImagePickerNS.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
const PHOTO = size.driverTouch + space.xxl;

/**
 * Profil rasmi tanlash — ro'yxatdan o'tish formasida. Doira bosilsa galereya, pastda
 * "Kamera". Rasm kvadratga qirqiladi va siqiladi; serverga ro'yxatdan keyin yuklanadi.
 * Tanlov oynasi (Alert/ActionSheet) ishlatilmaydi — Fabric'da ko'rinmay qolishi mumkin.
 */
export function PhotoPicker({ value, onChange, error }: { value: PickedPhoto | null; onChange: (p: PickedPhoto | null) => void; error?: string }) {
  const { c } = useTheme();
  if (!ImagePicker) return null;
  const picker = ImagePicker;

  const pick = async (camera: boolean) => {
    if (camera) {
      const perm = await picker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    const r = camera ? await picker.launchCameraAsync(OPTS) : await picker.launchImageLibraryAsync(OPTS);
    const a = r.canceled ? null : r.assets[0];
    if (a) onChange({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' });
  };

  return (
    <View style={{ alignItems: 'center', marginBottom: space.lg }}>
      <View>
        <Pressable
          onPress={() => void pick(false)}
          accessibilityRole="button"
          accessibilityLabel={value ? 'Rasmni almashtirish' : 'Rasm yuklash'}
          style={({ pressed }) => [{ width: PHOTO, height: PHOTO, borderRadius: radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: value ? c.bgSurface : c.bgSubtle, borderWidth: value ? 0 : size.ring, borderStyle: 'dashed', borderColor: error ? c.danger : c.borderStrong }, pressed && { opacity: 0.8 }]}
        >
          {value
            ? <Image source={{ uri: value.uri }} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
            : <Icon name="user" size={size.iconXl} tone="faint" />}
        </Pressable>
        {/* Kamera nishoni — doira burchagida brend tugmachasi (bezak, bosish butun doirada) */}
        <View pointerEvents="none" style={[{ position: 'absolute', right: 0, bottom: 0, width: size.iconTileSm, height: size.iconTileSm, borderRadius: radius.pill, backgroundColor: c.brand, borderWidth: size.ring, borderColor: c.bgApp, alignItems: 'center', justifyContent: 'center' }, shadow.card]}>
          <Icon name={value ? 'pencil' : 'camera'} size={size.iconSm} color={c.textOnBrand} strokeWidth={2} />
        </View>
      </View>
      <Txt v="caption" style={{ marginTop: space.sm }}>{value ? 'Profil rasmi' : "Profil rasmi (ixtiyoriy)"}</Txt>
      <View style={{ flexDirection: 'row', gap: space.lg }}>
        <TextLink onPress={() => void pick(false)}>{value ? 'Almashtirish' : 'Galereya'}</TextLink>
        <TextLink onPress={() => void pick(true)}>Kamera</TextLink>
        {value ? <TextLink onPress={() => onChange(null)}>Olib tashlash</TextLink> : null}
      </View>
      {error ? <Txt v="caption" color="danger">{error}</Txt> : null}
    </View>
  );
}
