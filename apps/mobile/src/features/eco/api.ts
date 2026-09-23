/** ECO System API hooklari — barcha rollar uchun. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uuid } from '@/core/api';

export const q = <T,>(key: unknown[], path: string, opts: { query?: Record<string, string | undefined>; refetchInterval?: number; enabled?: boolean } = {}) =>
  useQuery({ queryKey: key, queryFn: () => api<T>(path, { query: opts.query }), refetchInterval: opts.refetchInterval, enabled: opts.enabled });

export function useAction<TVars = void, TRes = unknown>(build: (v: TVars) => { path: string; body?: unknown; method?: 'POST' | 'PATCH' }, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: TVars) => { const r = build(v); return api<TRes>(r.path, { method: r.method ?? 'POST', body: r.body ?? {}, idempotencyKey: uuid() }); },
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
}

// ───── tiplar (qisqartirilgan) ─────
export interface Project { id: string; name: string; address: string; status: string; progress: number; budget: string; spent: string; clientName?: string | null; description?: string | null; startDate?: string | null; deadline?: string | null; lat?: number | null; lng?: number | null; _count?: { members: number; tasks: number; workOrders: number }; tasks?: { status: string }[] }
export interface Task { id: string; projectId: string; title: string; description?: string | null; status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'; priority: 'LOW' | 'MEDIUM' | 'HIGH'; dueDate?: string | null; photoKeys: string[]; comment?: string | null; assignee?: { id: string; fullName: string | null } | null; project?: { id: string; name: string; address: string } }
export interface WorkOrder { id: string; number: number; title: string; description?: string | null; address: string; price: string; deadline: string; status: string; workerUserId?: string | null; photoKeys: string[]; workerComment?: string | null; reviewComment?: string | null; createdAt: string; project?: { id: string; name: string } | null; worker?: { id: string; fullName: string | null; phone: string; workerProfile?: { specialty: string; ratingAvg: number } | null } | null; payouts?: { amount: string; status: string }[] }
export interface Worker { membershipId: string; userId: string; fullName: string | null; phone: string; profile: { specialty: string; experienceYears: number; dailyRate: string; ratingAvg: number; ratingCount: number; completedJobs: number; bio?: string | null } | null; currentProject: { id: string; name: string } | null; activeWork: { id: string; title: string; status: string } | null }
export interface Driver { membershipId: string; userId: string; fullName: string | null; phone: string; vehicle: Vehicle | null; currentShipment: { id: string; number: number; cargo: string; status: string; project: { name: string } } | null; deliveredCount: number; rating: number | null }
export interface Vehicle { id: string; plateNumber: string; brand?: string | null; type: string; capacityTons?: string | null; capacityM3: string; fuelPercent?: number | null; odometerKm?: number | null; nextServiceAt?: string | null; driverUserId?: string | null }
export interface Material { id: string; name: string; category: string; unit: string; price: string; minStock: string; stock: string; low: boolean; inventory: { quantity: string; warehouse: { id: string; name: string } }[] }
export interface MaterialRequest { id: string; number: number; quantity: string; reason?: string | null; status: string; rejectReason?: string | null; createdAt: string; material: { id: string; name: string; unit: string; price: string }; project: { id: string; name: string }; shipment?: Shipment | null }
export interface Shipment { id: string; number: number; status: string; cargo: string; quantity: string; unit: string; distanceKm?: string | null; driverFee: string; acceptedAt?: string | null; departedAt?: string | null; deliveredAt?: string | null; confirmedAt?: string | null; receiverName?: string | null; createdAt: string; project: { id: string; name: string; address: string; lat?: number | null; lng?: number | null }; warehouse: { id: string; name: string; address: string; lat?: number | null; lng?: number | null }; driver?: { id: string; fullName: string | null; phone: string } | null; vehicle?: Vehicle | null; request?: { material: { name: string } } | null; contact?: { fullName: string | null; phone: string } | null }
export interface FinanceOverview { income: string; expense: string; profit: string; expectedIncome: string; todayExpense: string; incomeBySource: { source: string; amount: string }[]; expenseByCategory: { category: string; amount: string }[]; months: { month: string; label: string; income: string; expense: string }[] }
export interface Earnings { today: string; week: string; month: string; monthPaid: string; monthPending: string; total: string; items: { id: string; amount: string; status: string; description: string; earnedAt: string; paidAt?: string | null }[] }
export interface Conversation { id: string; type: string; title: string; others: { id: string; fullName: string | null; role: string | null }[]; lastMessage: { text: string; createdAt: string; sender: { fullName: string | null } } | null; lastMessageAt: string; unread: number }
export interface Message { id: string; text: string; createdAt: string; sender: { id: string; fullName: string | null } }
export interface Notice { id: string; type: string; title: string; body: string; readAt?: string | null; createdAt: string; data: Record<string, unknown> }

// ───── dashboard ─────
export const useTadbirkorDashboard = () => q<{ kpi: Record<string, string | number>; statusLines: { icon: string; text: string }[]; months: FinanceOverview['months']; expenseByCategory: FinanceOverview['expenseByCategory']; projects: Project[]; lowMaterials: { id: string; name: string; unit: string; stock: string; minStock: string }[]; tasks: { status: string; count: number }[]; notifications: Notice[] }>(['dash', 'tadbirkor'], '/dashboard/tadbirkor', { refetchInterval: 30_000 });
export const useQuruvchiDashboard = () => q<{ todayTasks: Task[]; activeOrders: WorkOrder[]; doneCount: number; openOrders: number; earnings: Earnings; profile: Worker['profile'] }>(['dash', 'quruvchi'], '/dashboard/quruvchi', { refetchInterval: 30_000 });
export const useHaydovchiDashboard = () => q<{ todayCount: number; doneToday: number; pending: number; active: Shipment | null; vehicle: Vehicle | null; earnings: Earnings; open: Shipment[] }>(['dash', 'haydovchi'], '/dashboard/haydovchi', { refetchInterval: 20_000 });

// ───── projects / tasks ─────
export const useProjects = () => q<Project[]>(['projects'], '/projects');
export const useProject = (id: string) => q<Omit<Project, 'tasks'> & { tasks: Task[]; members: { user: { id: string; fullName: string | null; phone: string; workerProfile?: { specialty: string } | null } }[]; workOrders: WorkOrder[]; materialRequests: MaterialRequest[]; shipments: Shipment[]; expenses: { id: string; category: string; amount: string; description: string; date: string }[]; incomes: { id: string; amount: string; description: string; date: string; isExpected: boolean }[]; documents: { id: string; name: string; kind: string; createdAt: string }[]; expenseByCategory: { category: string; amount: string }[]; incomeTotal: string; expectedIncome: string }>(['projects', id], `/projects/${id}`);
export const useMyTasks = () => q<Task[]>(['tasks', 'mine'], '/tasks/mine');

// ───── work orders ─────
export const useWorkOrders = (status?: string) => q<WorkOrder[]>(['work-orders', status], '/work-orders', { query: { status } });
export const useWorkOrder = (id: string) => q<WorkOrder>(['work-orders', 'one', id], `/work-orders/${id}`);

// ───── people ─────
export const useWorkers = (specialty?: string) => q<Worker[]>(['workers', specialty], '/workers', { query: { specialty } });
export const useWorker = (userId: string) => q<{ id: string; fullName: string | null; phone: string; profile: Worker['profile']; workOrders: WorkOrder[]; reviews: { id: string; scoreOverall: number; comment?: string | null; createdAt: string }[]; projects: { id: string; name: string; status: string }[]; payouts: Earnings['items']; stats: { total: number; done: number; late: number; cancelled: number; earned: string } }>(['workers', 'one', userId], `/workers/${userId}`);
export const useDrivers = () => q<Driver[]>(['drivers'], '/drivers');
export const useVehicles = () => q<Vehicle[]>(['vehicles'], '/drivers/vehicles');
export const useMyVehicle = () => q<Vehicle | null>(['vehicles', 'mine'], '/drivers/vehicles/mine');

// ───── materials ─────
export const useMaterials = () => q<Material[]>(['materials'], '/materials');
export const useMaterialRequests = (status?: string) => q<MaterialRequest[]>(['material-requests', status], '/material-requests', { query: { status } });
export const useWarehouses = () => q<{ id: string; name: string; address: string }[]>(['warehouses'], '/materials/warehouses');

// ───── shipments ─────
export const useShipments = (status?: string) => q<Shipment[]>(['shipments', status], '/shipments', { query: { status }, refetchInterval: 20_000 });
export const useShipment = (id: string) => q<Shipment>(['shipments', 'one', id], `/shipments/${id}`, { refetchInterval: 15_000 });
export const useShipmentHistory = () => q<Shipment[]>(['shipments', 'history'], '/shipments/history');

// ───── finance ─────
export const useFinance = () => q<FinanceOverview>(['finance'], '/finance/overview');
export const useExpenses = (projectId?: string) => q<{ id: string; category: string; amount: string; description: string; date: string; project?: { name: string } | null }[]>(['finance', 'expenses', projectId], '/finance/expenses', { query: { projectId } });
export const useIncomes = (projectId?: string) => q<{ id: string; source: string; amount: string; description: string; date: string; isExpected: boolean; project?: { name: string } | null }[]>(['finance', 'incomes', projectId], '/finance/incomes', { query: { projectId } });
export const useMyEarnings = () => q<Earnings>(['finance', 'mine'], '/finance/my-earnings');

// ───── messages / notifications ─────
export const useConversations = () => q<Conversation[]>(['conversations'], '/conversations', { refetchInterval: 15_000 });
export const useContacts = () => q<{ role: string; user: { id: string; fullName: string | null; phone: string } }[]>(['contacts'], '/conversations/contacts');
export const useMessages = (id: string) => q<Message[]>(['messages', id], `/conversations/${id}/messages`, { refetchInterval: 4_000 });
export const useNotifications = () => q<Notice[]>(['notifications'], '/notifications', { refetchInterval: 30_000 });
