'use client';

import Button from './Button';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-600 ${className}`}
    />
  );
}

export function PageLoader({ label = 'Memuat data...' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3" role="status" aria-live="polite">
      <Spinner className="h-10 w-10 border-4" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 p-4" aria-hidden>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <div key={columnIndex} className="animate-shimmer h-9 flex-1 rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 text-4xl opacity-60" aria-hidden>
        {icon}
      </div>
      <p className="font-semibold text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/60 px-6 py-12 text-center"
      role="alert"
    >
      <div className="mb-3 text-4xl" aria-hidden>
        ⚠️
      </div>
      <p className="font-semibold text-red-800">Gagal memuat data</p>
      <p className="mt-1 max-w-md text-sm text-red-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}
