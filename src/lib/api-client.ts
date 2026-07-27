import type { ApiErrorBody } from './http';

/**
 * Error dari API yang sudah membawa status dan error per-field, supaya pemanggil
 * bisa menampilkan pesan di form alih-alih hanya toast generik.
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function parse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Server bisa mengembalikan HTML (mis. halaman error proxy); jangan sampai
    // JSON.parse yang gagal terlihat seperti masalah jaringan.
    return null;
  }
}

async function request<T>(method: string, url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiClientError('Tidak bisa terhubung ke server. Cek koneksi Anda.', 0, 'NETWORK_ERROR');
  }

  const payload = await parse(response);

  if (!response.ok) {
    const body = (payload ?? {}) as Partial<ApiErrorBody>;
    if (response.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      // Sesi habis di tengah pemakaian — antar user kembali ke login.
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiClientError(
      body.error ?? `Permintaan gagal (${response.status})`,
      response.status,
      body.code ?? 'HTTP_ERROR',
      body.fields,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(url: string, signal?: AbortSignal) => request<T>('GET', url, undefined, signal),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body ?? {}),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body ?? {}),
  delete: <T>(url: string) => request<T>('DELETE', url),
};

/** Bangun query string, melewati nilai kosong/undefined. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Terjadi kesalahan yang tidak diketahui';
}

export function errorFields(error: unknown): Record<string, string> {
  return error instanceof ApiClientError ? (error.fields ?? {}) : {};
}
