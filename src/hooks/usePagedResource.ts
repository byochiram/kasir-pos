'use client';

import { useFetch } from './useFetch';
import type { Paginated } from '@/lib/types';

/** Pembungkus tipis di atas useFetch untuk endpoint yang mengembalikan bentuk Paginated. */
export function usePagedResource<T>(url: string, options: { debounceMs?: number } = {}) {
  const { data, error, loading, reload } = useFetch<Paginated<T>>(url, options);
  return {
    items: data?.data ?? [],
    total: data?.total ?? 0,
    loading,
    error,
    reload,
  };
}
