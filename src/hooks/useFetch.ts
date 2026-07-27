'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api-client';

interface Snapshot<T> {
  url: string;
  token: number;
  data: T | null;
  error: string | null;
}

interface FetchResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Pengambilan data untuk komponen client.
 *
 * `loading` diturunkan dari perbandingan snapshot terakhir dengan url/token
 * saat ini, bukan dari state terpisah. Dengan begitu tidak ada setState
 * sinkron di dalam effect (yang memicu render bertingkat), dan hasil request
 * lama tidak pernah menimpa yang baru karena snapshot menyimpan url asalnya.
 */
export function useFetch<T>(url: string | null, options: { debounceMs?: number } = {}): FetchResult<T> {
  const { debounceMs = 0 } = options;
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);
  const [token, setToken] = useState(0);

  const stale = snapshot === null || snapshot.url !== url || snapshot.token !== token;
  const loading = url !== null && stale;

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api
        .get<T>(url, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setSnapshot({ url, token, data, error: null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
          setSnapshot({ url, token, data: null, error: errorMessage(error) });
        });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, token, debounceMs]);

  const reload = useCallback(() => setToken((value) => value + 1), []);

  return {
    data: stale ? null : (snapshot?.data ?? null),
    error: stale ? null : (snapshot?.error ?? null),
    loading,
    reload,
  };
}
