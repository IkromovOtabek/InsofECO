import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiException } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 3600_000, // offline persist uchun
      retry: (count, err) => !(err instanceof ApiException && err.status < 500) && count < 2,
    },
    mutations: { retry: 0 },
  },
});

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'rq.v1' });
