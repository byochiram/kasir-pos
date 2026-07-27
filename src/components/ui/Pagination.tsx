'use client';

import { formatNumber } from '@/lib/format';

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
  /** Label untuk entitas yang dihitung, mis. "produk". */
  unit?: string;
}

export default function Pagination({ total, limit, offset, onChange, unit = 'data' }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  // Jendela halaman yang ditampilkan: selalu maksimal 5 tombol.
  const windowStart = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pages: number[] = [];
  for (let page = windowStart; page < windowStart + 5 && page <= totalPages; page++) pages.push(page);

  if (total === 0) return null;

  return (
    <nav
      className="flex flex-col items-center justify-between gap-3 border-t border-slate-200/70 px-4 py-3 sm:flex-row"
      aria-label="Navigasi halaman"
    >
      <p className="text-xs text-slate-500">
        Menampilkan <span className="font-semibold text-slate-700">{formatNumber(from)}</span>–
        <span className="font-semibold text-slate-700">{formatNumber(to)}</span> dari{' '}
        <span className="font-semibold text-slate-700">{formatNumber(total)}</span> {unit}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(Math.max(0, offset - limit))}
            disabled={currentPage === 1}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Halaman sebelumnya"
          >
            ‹
          </button>

          {windowStart > 1 && <span className="px-1 text-xs text-slate-400">…</span>}

          {pages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onChange((page - 1) * limit)}
              aria-current={page === currentPage ? 'page' : undefined}
              className={`min-w-[32px] rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                page === currentPage
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {page}
            </button>
          ))}

          {windowStart + 5 <= totalPages && <span className="px-1 text-xs text-slate-400">…</span>}

          <button
            type="button"
            onClick={() => onChange(offset + limit)}
            disabled={currentPage >= totalPages}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Halaman berikutnya"
          >
            ›
          </button>
        </div>
      )}
    </nav>
  );
}
