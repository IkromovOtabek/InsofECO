import { z } from 'zod';
import { Role } from './enums';
import { Transition } from './state-machines';

// ─────────── Enumlar ───────────
export const Specialty = ['GISHT_TERUVCHI', 'ELEKTRIK', 'SANTEXNIK', 'PAYVANDCHI', 'BETONCHI', 'SUVOQCHI', 'BOYOQCHI', 'UNIVERSAL'] as const;
export type Specialty = (typeof Specialty)[number];
export const SPECIALTY_LABEL: Record<Specialty, string> = {
  GISHT_TERUVCHI: "G'isht teruvchi", ELEKTRIK: 'Elektrik', SANTEXNIK: 'Santexnik', PAYVANDCHI: 'Payvandchi',
  BETONCHI: 'Betonchi', SUVOQCHI: 'Suvoqchi', BOYOQCHI: "Bo'yoqchi", UNIVERSAL: 'Universal',
};

export const ProjectStatus = ['PLANNING', 'ACTIVE', 'DELAYED', 'ON_HOLD', 'COMPLETED'] as const;
export type ProjectStatus = (typeof ProjectStatus)[number];
export const TaskStatus = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;
export type TaskStatus = (typeof TaskStatus)[number];
export const Priority = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Priority = (typeof Priority)[number];

export const WorkOrderStatus = ['NEW', 'ACCEPTED', 'WORKER_ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'PAID', 'CANCELLED'] as const;
export type WorkOrderStatus = (typeof WorkOrderStatus)[number];
export const MaterialRequestStatus = ['PENDING', 'APPROVED', 'REJECTED', 'LOADING', 'DELIVERED', 'CONFIRMED'] as const;
export type MaterialRequestStatus = (typeof MaterialRequestStatus)[number];
export const ShipmentStatus = ['NEW', 'ACCEPTED', 'LOADING', 'EN_ROUTE', 'DELIVERED', 'CONFIRMED', 'CANCELLED'] as const;
export type ShipmentStatus = (typeof ShipmentStatus)[number];
export const ExpenseCategory = ['MATERIAL', 'WORKER', 'DRIVER', 'FUEL', 'TRANSPORT', 'REPAIR', 'OTHER'] as const;
export type ExpenseCategory = (typeof ExpenseCategory)[number];
export const EXPENSE_LABEL: Record<ExpenseCategory, string> = { MATERIAL: 'Material', WORKER: 'Ishchilar', DRIVER: 'Haydovchilar', FUEL: "Yoqilg'i", TRANSPORT: 'Transport', REPAIR: "Ta'mirlash", OTHER: 'Boshqa' };
export const IncomeSource = ['ORDER', 'PROJECT', 'SERVICE'] as const;
export type IncomeSource = (typeof IncomeSource)[number];
export const INCOME_LABEL: Record<IncomeSource, string> = { ORDER: 'Buyurtmalardan', PROJECT: 'Loyihalardan', SERVICE: "Qo'shimcha xizmatlardan" };

// ─────────── Holat mashinalari ───────────
export const WORK_ORDER_TRANSITIONS: readonly Transition<WorkOrderStatus>[] = [
  { from: 'NEW', to: 'ACCEPTED', roles: ['TADBIRKOR'] },
  { from: 'NEW', to: 'CANCELLED', roles: ['TADBIRKOR'] },
  { from: 'ACCEPTED', to: 'WORKER_ASSIGNED', roles: ['TADBIRKOR'] },
  { from: 'ACCEPTED', to: 'CANCELLED', roles: ['TADBIRKOR'] },
  { from: 'WORKER_ASSIGNED', to: 'IN_PROGRESS', roles: ['QURUVCHI'] }, // quruvchi qabul qildi va boshladi
  { from: 'WORKER_ASSIGNED', to: 'CANCELLED', roles: ['TADBIRKOR'] },
  { from: 'IN_PROGRESS', to: 'REVIEW', roles: ['QURUVCHI'] }, // ishni topshirdi
  { from: 'REVIEW', to: 'DONE', roles: ['TADBIRKOR'] },
  { from: 'REVIEW', to: 'IN_PROGRESS', roles: ['TADBIRKOR'] }, // qayta ishlash
  { from: 'DONE', to: 'PAID', roles: ['TADBIRKOR'] },
];
export const SHIPMENT_TRANSITIONS: readonly Transition<ShipmentStatus>[] = [
  { from: 'NEW', to: 'ACCEPTED', roles: ['HAYDOVCHI'] },
  { from: 'NEW', to: 'CANCELLED', roles: ['TADBIRKOR'] },
  { from: 'ACCEPTED', to: 'LOADING', roles: ['HAYDOVCHI', 'TADBIRKOR'] },
  { from: 'LOADING', to: 'EN_ROUTE', roles: ['HAYDOVCHI', 'TADBIRKOR'] },
  { from: 'EN_ROUTE', to: 'DELIVERED', roles: ['HAYDOVCHI'] },
  { from: 'DELIVERED', to: 'CONFIRMED', roles: ['QURUVCHI', 'TADBIRKOR'] }, // qabul qiluvchi tasdiqladi
  { from: 'ACCEPTED', to: 'CANCELLED', roles: ['TADBIRKOR'] },
];
export const SHIPMENT_DRIVER_NEXT: Partial<Record<ShipmentStatus, ShipmentStatus>> = { NEW: 'ACCEPTED', ACCEPTED: 'LOADING', LOADING: 'EN_ROUTE', EN_ROUTE: 'DELIVERED' };

// ─────────── Zod sxemalar ───────────
export const ProjectCreateSchema = z.object({
  name: z.string().min(2).max(120),
  address: z.string().min(3).max(200),
  budget: z.number().nonnegative(),
  clientName: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  startDate: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
  status: z.enum(ProjectStatus).optional(),
});
export const ProjectUpdateSchema = ProjectCreateSchema.partial().extend({ progress: z.number().int().min(0).max(100).optional() });

export const TaskCreateSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional(),
  priority: z.enum(Priority).default('MEDIUM'),
  assigneeUserId: z.string().optional(),
  dueDate: z.coerce.date().optional(),
});
export const TaskUpdateSchema = z.object({
  status: z.enum(TaskStatus).optional(),
  photoKeys: z.array(z.string()).max(10).optional(),
  comment: z.string().max(1000).optional(),
  priority: z.enum(Priority).optional(),
  assigneeUserId: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const WorkOrderCreateSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional(),
  address: z.string().min(3).max(200),
  price: z.number().positive(),
  deadline: z.coerce.date(),
  workerUserId: z.string().optional(),
});
export const WorkOrderSubmitSchema = z.object({ photoKeys: z.array(z.string()).max(10).default([]), comment: z.string().max(1000).optional() });
export const WorkOrderReviewSchema = z.object({ approve: z.boolean(), comment: z.string().max(1000).optional(), rating: z.number().int().min(1).max(5).optional() });

export const MaterialCreateSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.string().max(60).default('Umumiy'),
  unit: z.string().max(20).default('dona'),
  price: z.number().nonnegative(),
  minStock: z.number().nonnegative().default(0),
});
export const InventoryAdjustSchema = z.object({ warehouseId: z.string(), materialId: z.string(), delta: z.number(), note: z.string().max(200).optional() });

export const MaterialRequestCreateSchema = z.object({
  projectId: z.string(),
  materialId: z.string(),
  quantity: z.number().positive(),
  reason: z.string().max(300).optional(),
});
export const MaterialRequestApproveSchema = z.object({
  warehouseId: z.string().optional(),
  driverUserId: z.string().optional(),
  vehicleId: z.string().optional(),
  driverFee: z.number().nonnegative().optional(),
});

export const ShipmentTransitionSchema = z.object({
  to: z.enum(ShipmentStatus),
  photoKey: z.string().optional(),
  receiverName: z.string().max(120).optional(),
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export const ExpenseCreateSchema = z.object({
  projectId: z.string().optional(),
  category: z.enum(ExpenseCategory),
  amount: z.number().positive(),
  description: z.string().min(2).max(300),
  date: z.coerce.date().optional(),
});
export const IncomeCreateSchema = z.object({
  projectId: z.string().optional(),
  source: z.enum(IncomeSource),
  amount: z.number().positive(),
  description: z.string().min(2).max(300),
  date: z.coerce.date().optional(),
  isExpected: z.boolean().default(false),
});

export const ConversationCreateSchema = z.object({
  type: z.enum(['DIRECT', 'GROUP', 'PROJECT']).default('DIRECT'),
  participantUserIds: z.array(z.string()).min(1).max(50),
  title: z.string().max(120).optional(),
  projectId: z.string().optional(),
});
export const MessageCreateSchema = z.object({ text: z.string().min(1).max(4000) });

export const ReviewCreateSchema = z.object({
  targetUserId: z.string(),
  workOrderId: z.string().optional(),
  shipmentId: z.string().optional(),
  scoreOverall: z.number().int().min(1).max(5),
  scoreTime: z.number().int().min(1).max(5).optional(),
  scoreManner: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
});

export const WorkerProfileUpdateSchema = z.object({
  specialty: z.enum(Specialty).optional(),
  experienceYears: z.number().int().min(0).max(60).optional(),
  dailyRate: z.number().nonnegative().optional(),
  bio: z.string().max(500).optional(),
});

/** Ruxsatlar matritsasi (hujjat + backend Roles dekoratorlari bilan sinxron). */
export const PERMISSIONS: Record<string, Partial<Record<Role, ('C' | 'R' | 'U' | 'D')[]>>> = {
  projects: { TADBIRKOR: ['C', 'R', 'U', 'D'], QURUVCHI: ['R'] },
  workOrders: { TADBIRKOR: ['C', 'R', 'U', 'D'], QURUVCHI: ['R', 'U'], HAYDOVCHI: ['R'] },
  tasks: { TADBIRKOR: ['C', 'R', 'U', 'D'], QURUVCHI: ['R', 'U'] },
  workers: { TADBIRKOR: ['C', 'R', 'U', 'D'], QURUVCHI: ['R'] },
  drivers: { TADBIRKOR: ['C', 'R', 'U', 'D'], HAYDOVCHI: ['R'] },
  materials: { TADBIRKOR: ['C', 'R', 'U', 'D'], QURUVCHI: ['R'] },
  materialRequests: { TADBIRKOR: ['R', 'U'], QURUVCHI: ['C', 'R'] },
  shipments: { TADBIRKOR: ['C', 'R', 'U'], HAYDOVCHI: ['R', 'U'], QURUVCHI: ['R', 'U'] },
  finance: { TADBIRKOR: ['C', 'R', 'U', 'D'], QURUVCHI: ['R'], HAYDOVCHI: ['R'] },
  messages: { TADBIRKOR: ['C', 'R'], QURUVCHI: ['C', 'R'], HAYDOVCHI: ['C', 'R'] },
};
