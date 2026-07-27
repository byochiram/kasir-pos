'use client';

import { useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const BASE =
  'w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:bg-surface-2';
const NORMAL = 'border-line focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';
const INVALID = 'border-red-300 bg-red-50/40 dark:bg-red-500/10 focus:border-red-500 focus:ring-2 focus:ring-red-500/20';

interface Wrapper {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

function Shell({
  label,
  error,
  hint,
  required,
  id,
  children,
}: Wrapper & { id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  required,
  className = '',
  ...rest
}: Wrapper & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Shell label={label} error={error} hint={hint} required={required} id={id}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${BASE} ${error ? INVALID : NORMAL} ${className}`}
        {...rest}
      />
    </Shell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  required,
  className = '',
  children,
  ...rest
}: Wrapper & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Shell label={label} error={error} hint={hint} required={required} id={id}>
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${BASE} bg-surface ${error ? INVALID : NORMAL} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </Shell>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  required,
  className = '',
  ...rest
}: Wrapper & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Shell label={label} error={error} hint={hint} required={required} id={id}>
      <textarea
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${BASE} resize-y ${error ? INVALID : NORMAL} ${className}`}
        {...rest}
      />
    </Shell>
  );
}
