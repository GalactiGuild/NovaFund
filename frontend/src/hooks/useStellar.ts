'use client';

/**
 * useStellar – cached hooks for Stellar RPC data.
 *
 * All queries share a 15 s stale time (configured in query-client.ts).
 * Data is served from the in-memory cache on re-renders; the network is
 * only hit when the cache entry is stale or missing.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stellarKeys } from '../lib/query-client';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// ---------------------------------------------------------------------------
// Fetchers (thin wrappers around the backend REST API / RPC relay)
// ---------------------------------------------------------------------------

async function fetchBalance(address: string, token: string): Promise<string> {
  const params = new URLSearchParams({ address, token });
  const res = await fetch(`${API}/stellar/balance?${params}`);
  if (!res.ok) throw new Error(`Balance fetch failed: ${res.status}`);
  const data = await res.json();
  return data.balance as string;
}

async function fetchAccount(address: string) {
  const res = await fetch(`${API}/stellar/account/${address}`);
  if (!res.ok) throw new Error(`Account fetch failed: ${res.status}`);
  return res.json();
}

async function fetchContractState(contractId: string, key: string) {
  const params = new URLSearchParams({ contractId, key });
  const res = await fetch(`${API}/stellar/contract-state?${params}`);
  if (!res.ok) throw new Error(`Contract state fetch failed: ${res.status}`);
  return res.json();
}

async function fetchTransactions(address: string) {
  const res = await fetch(`${API}/stellar/transactions/${address}`);
  if (!res.ok) throw new Error(`Transactions fetch failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Cached XLM or token balance for an address.
 * Refetches automatically every 15 s when the component is mounted.
 */
export function useStellarBalance(address: string, token = 'native') {
  return useQuery({
    queryKey: stellarKeys.balance(address, token),
    queryFn: () => fetchBalance(address, token),
    enabled: Boolean(address),
    // Poll every 15 s while the component is visible
    refetchInterval: 15_000,
  });
}

/**
 * Cached Stellar account info (sequence number, signers, thresholds, etc.).
 */
export function useStellarAccount(address: string) {
  return useQuery({
    queryKey: stellarKeys.account(address),
    queryFn: () => fetchAccount(address),
    enabled: Boolean(address),
  });
}

/**
 * Cached Soroban contract state entry.
 */
export function useContractState(contractId: string, key: string) {
  return useQuery({
    queryKey: stellarKeys.contractState(contractId, key),
    queryFn: () => fetchContractState(contractId, key),
    enabled: Boolean(contractId) && Boolean(key),
  });
}

/**
 * Cached transaction history for an address.
 * Longer stale time (60 s) – history changes less frequently than balances.
 */
export function useStellarTransactions(address: string) {
  return useQuery({
    queryKey: stellarKeys.transactions(address),
    queryFn: () => fetchTransactions(address),
    enabled: Boolean(address),
    staleTime: 60_000,
  });
}

/**
 * Mutation that submits a signed XDR transaction and then invalidates the
 * balance + account caches for the given address so they refetch immediately.
 */
export function useSubmitTransaction(address: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (xdr: string) => {
      const res = await fetch(`${API}/relay/fee-bump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xdr }),
      });
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
      return res.json() as Promise<{ hash: string }>;
    },
    onSuccess: () => {
      // Invalidate stale balance and account data after a successful tx
      qc.invalidateQueries({ queryKey: stellarKeys.balance(address) });
      qc.invalidateQueries({ queryKey: stellarKeys.account(address) });
      qc.invalidateQueries({ queryKey: stellarKeys.transactions(address) });
    },
  });
}
