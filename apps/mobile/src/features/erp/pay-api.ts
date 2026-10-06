/**
 * Davomat jadvali va haydovchilar reyslari — ish haqi asosi (ERP: `lib/attendance-report.ts`, `lib/driver-pay.ts`).
 *   · GET /api/mobile/attendance/day?date=            — barcha xodimlar, bir kun;
 *   · GET /api/mobile/attendance/employee?id=&month=  — bitta xodim, oy;
 *   · GET /api/mobile/driver-trips?month=[&id=|me]    — haydovchilar jadvali / bitta haydovchi.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { erpApi } from '@/core/erp';
import { ApiException } from '@/core/api';
import { usePollInterval } from '@/shared/hooks';

export type AttStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'SICK' | 'DAYOFF' | 'NONE';
export interface Shift { start: string; end: string }

export interface StaffDayRow {
  id: string; fullName: string; position: string; dept: string | null;
  status: AttStatus; statusLabel: string;
  checkIn: string | null; checkOut: string | null;
  minutes: number | null; lateMin: number | null; earlyMin: number | null;
  source: string | null; note: string | null; shift: Shift;
}
export interface StaffDay {
  date: string; title: string; isToday: boolean; prev: string; next: string | null;
  totals: { total: number; present: number; absent: number; late: number; notMarked: number; sick: number; leave: number; dayoff: number; inside: number; minutes: number; lateMinutes: number };
  rows: StaffDayRow[];
}

export interface EmployeeMonthDay {
  date: string; day: number; weekday: string; weekend: boolean;
  status: AttStatus; statusLabel: string | null;
  checkIn: string | null; checkOut: string | null; minutes: number | null; lateMin: number | null; earlyMin: number | null;
  source: string | null; note: string | null;
}
export interface MonthTotals {
  present: number; absent: number; sick: number; leave: number; dayoff: number; notMarked: number;
  minutes: number; lateDays: number; lateMinutes: number; earlyDays: number; earlyMinutes: number; openDays: number;
}
export interface EmployeeMonth {
  month: string; title: string; prev: string; next: string | null;
  employee: { id: string; fullName: string; position: string; dept: string | null; phone: string | null };
  shift: Shift; totals: MonthTotals; days: EmployeeMonthDay[];
}

export interface DriverMonthRow {
  id: string; fullName: string; phone: string | null; plate: string | null;
  trips: number; qtyText: string; m3: number; km: number;
  workedDays: number; attDays: number; tripDays: number; minutes: number; lateDays: number;
}
export interface DriversMonth {
  month: string; title: string; prev: string; next: string | null;
  totals: { drivers: number; trips: number; qtyText: string; km: number; workedDays: number };
  rows: DriverMonthRow[];
}
export interface DriverTrip { id: string; no: string; time: string; customer: string; product: string; qtyText: string; km: number; plate: string }
export interface DriverDay {
  date: string; day: number; weekday: string;
  trips: DriverTrip[]; tripCount: number; qtyText: string | null; km: number;
  checkIn: string | null; checkOut: string | null; minutes: number | null; lateMin: number | null; status: string | null;
  firstAt: string | null; lastAt: string | null;
}
export interface DriverMonth {
  month: string; title: string; prev: string; next: string | null;
  driver: { id: string; fullName: string; phone: string | null; plate: string | null };
  totals: { trips: number; qtyText: string; km: number; workedDays: number; attDays: number; tripDays: number; minutes: number; lateDays: number; lateMinutes: number };
  days: DriverDay[];
}

export const useStaffDay = (date?: string) =>
  useQuery({
    queryKey: ['erp', 'att-day', date ?? ''],
    queryFn: () => erpApi<StaffDay>('/attendance/day', { query: { date } }),
    placeholderData: keepPreviousData,
    // Bugungi jadval — kelib-ketish jonli o'zgaradi
    refetchInterval: usePollInterval(date ? false : 60_000),
  });

export const useEmployeeMonth = (id: string, month?: string) =>
  useQuery({
    queryKey: ['erp', 'att-emp', id, month ?? ''],
    queryFn: () => erpApi<EmployeeMonth>('/attendance/employee', { query: { id, month } }),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });

export const useDriversMonth = (month?: string) =>
  useQuery({
    queryKey: ['erp', 'drv-month', month ?? ''],
    queryFn: () => erpApi<DriversMonth>('/driver-trips', { query: { month } }),
    placeholderData: keepPreviousData,
  });

export const useDriverMonth = (id: string, month?: string) =>
  useQuery({
    queryKey: ['erp', 'drv-one', id, month ?? ''],
    queryFn: () => erpApi<DriverMonth>('/driver-trips', { query: { id, month } }),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });

/** Server hali yangilanmagan (marshrut yo'q) — aniq xabar. */
export const errorText = (e: unknown) =>
  (e instanceof ApiException && e.status === 404 && e.code !== 'NOT_FOUND') || e instanceof SyntaxError
    ? "Serverda bu bo'lim hali yo'q — ERP yangilanishi kerak"
    : (e as Error)?.message || "Ma'lumot yuklanmadi";

// ───────────────────────── Format ─────────────────────────

/** 510 → "8,5"; 0 → "0". */
export const hoursNum = (min: number) => (min / 60).toFixed(1).replace('.0', '').replace('.', ',');
export const hoursText = (min: number) => `${hoursNum(min)} soat`;
/** 27 → "27 daq", 75 → "1 s 15 daq". */
export const lateText = (min: number) => (min < 60 ? `${min} daq` : `${Math.floor(min / 60)} s${min % 60 ? ` ${min % 60} daq` : ''}`);

const pad = (n: number) => String(n).padStart(2, '0');
export const ymdLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => ymdLocal(new Date());
export const yesterdayIso = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymdLocal(d); };
export const curMonth = () => todayIso().slice(0, 7);

export const STATUS_TONE: Record<AttStatus, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  PRESENT: 'success', ABSENT: 'danger', SICK: 'warning', LEAVE: 'info', DAYOFF: 'neutral', NONE: 'neutral',
};
