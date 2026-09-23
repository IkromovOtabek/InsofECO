/** Biznes konstantalari — tashkilot sozlamasi bilan override qilinadi. */
export const DEFAULT_RULES = {
  /** Beton yuklangandan tushirishgacha maksimal vaqt (daqiqa). */
  concreteMaxTransitMinutes: 90,
  /** Obyektga "yetib keldi" avtomatik belgilanadigan radius (metr). */
  arrivalGeofenceMeters: 200,
  /** Jarimasiz bekor qilish oynasi (soat). */
  freeCancelHours: 24,
  /** Kech bekor qilish jarimasi (foiz). */
  lateCancelPenaltyPercent: 10,
  /** OTP amal qilish muddati (soniya). */
  otpTtlSeconds: 120,
  otpPerPhonePerHour: 3,
  /** GPS yuborish intervali (soniya) — haydovchi ilovasi. */
  gpsIntervalSeconds: 15,
  gpsDistanceMeters: 50,
} as const;

/** Hajmni mashina sig'imiga qarab reyslarga bo'lish. Oxirgi reys qoldiq. */
export function splitVolumeIntoTrips(totalM3: number, capacityM3: number): number[] {
  if (totalM3 <= 0 || capacityM3 <= 0) return [];
  const full = Math.floor(totalM3 / capacityM3);
  const rest = +(totalM3 - full * capacityM3).toFixed(2);
  const trips = Array.from({ length: full }, () => capacityM3);
  if (rest > 0) trips.push(rest);
  return trips;
}

/** Bekor qilish jarimasi (so'm). */
export function cancellationPenalty(
  totalAmount: number,
  scheduledAt: Date,
  now: Date,
  rules: Pick<typeof DEFAULT_RULES, 'freeCancelHours' | 'lateCancelPenaltyPercent'> = DEFAULT_RULES,
): number {
  const hoursLeft = (scheduledAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursLeft >= rules.freeCancelHours) return 0;
  return Math.round((totalAmount * rules.lateCancelPenaltyPercent) / 100);
}
