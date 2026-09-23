import { useQuery } from '@tanstack/react-query';
import { api } from '@/core/api';

export interface BillingSummary {
  totalDebt: string;
  clients: { clientId: string; name: string; debt: string; invoices: number }[];
  invoices: { id: string; number: number; status: string; amount: string; paidAmount: string; client: { name: string }; order: { number: number }; createdAt: string }[];
}
export const useBilling = () => useQuery({ queryKey: ['billing', 'summary'], queryFn: () => api<BillingSummary>('/billing/summary') });
