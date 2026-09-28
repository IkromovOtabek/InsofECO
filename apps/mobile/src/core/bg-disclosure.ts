import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { kv } from './storage';

/**
 * Fon joylashuvi uchun ilova ichidagi tushuntirish ("prominent disclosure").
 *
 * Google Play siyosati: fon joylashuvi tizim oynasi chiqishidan OLDIN ilovaning o'zi nima
 * to'planishini, nima uchunligini va ilova yopiq paytda ham ishlashini aytishi va
 * foydalanuvchi rozilik tugmasini bosishi shart. Bu oynasiz ilova reviewda rad etiladi.
 *
 * `true` — fon ruxsatini so'rash mumkin. Rad etilsa, shu reys uchun qayta so'ralmaydi
 * (marshrut ekrani har ochilganda kuzatuvni tiklaydi — oyna har safar chiqmasin).
 */
const DECLINED = 'bgLocation.declinedFor';

export async function discloseBackgroundLocation(tripKey: string, recipients: string): Promise<boolean> {
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status === 'granted') return true;
  if (!bg.canAskAgain) return false;
  if (kv.getString(DECLINED) === tripKey) return false;

  const ok = await new Promise<boolean>((resolve) => {
    Alert.alert(
      'Joylashuvdan foydalanish',
      `Insof ECO reys davomida mashinangiz joylashuvini to'playdi va ${recipients} jonli ko'rsatadi.\n\n` +
        "Bu ilova yopiq yoki ishlatilmayotgan paytda ham davom etadi — faqat \"Yo'lga chiqdim\" dan " +
        '"Yetkazdim" gacha. Reys tugashi bilan kuzatuv to\'xtaydi.\n\n' +
        'Keyingi oynada "Har doim ruxsat berish" ni tanlang.',
      [
        { text: 'Hozir emas', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Davom etish', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
  if (!ok) kv.set(DECLINED, tripKey);
  return ok;
}
