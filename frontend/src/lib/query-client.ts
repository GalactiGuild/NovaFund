import { QueryClient } from '@tanstack/react-query';

// Global stale time: 15 seconds for all Stellar RPC data
const STELLAR_STALE_TIME = 15_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STELLAR_STALE_TIME,
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry once on failure (RPC nodes can be flaky)
      retry: 1,
      // Don't refetch on window focus by default – too aggressive for RPC
      refetchOnWindowFocus: false,
    },
  },
});

// Cache key factory – centralises all query keys so invalidation is consistent
export const stellarKeys = {
  all: ['stellar'] as const,
  balance: (address: string, token?: string) =>
    [...stellarKeys.all, 'balance', address, token ?? 'native'] as const,
  contractState: (contractId: string, key: string) =>
    [...stellarKeys.all, 'contract', contractId, key] as const,
  account: (address: string) =>
    [...stellarKeys.all, 'account', address] as const,
  transactions: (address: string) =>
    [...stellarKeys.all, 'transactions', address] as const,
};
