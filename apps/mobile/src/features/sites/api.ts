import { useQuery } from '@tanstack/react-query';
import { api } from '@/core/api';

export interface Site { id: string; name: string; address: string; lat: number; lng: number; stages: { id: string; name: string; order: number; progress: number }[] }
export const useSites = () => useQuery({ queryKey: ['sites'], queryFn: () => api<Site[]>('/sites') });
