'use client';

import { useSyncExternalStore } from 'react';
import {
  readThemePreference,
  setThemePreference,
  subscribeTheme,
  THEME_LABELS,
  type ThemePreference,
} from '@/lib/theme';

const ICONS: Record<ThemePreference, string> = {
  light: 'M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4l-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7L5.6 5.6M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  dark: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  system: 'M9.8 21h4.4M12 17v4M4 5h16a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z',
};

/** Berputar terang → gelap → ikuti sistem. */
const NEXT: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

export default function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  // Preferensi tema hidup di localStorage; dibaca tanpa effect supaya tidak ada
  // render tambahan dan tidak terjadi mismatch saat hidrasi.
  const preference = useSyncExternalStore(
    subscribeTheme,
    () => readThemePreference(),
    () => 'system' as ThemePreference,
  );

  const label = `Tema: ${THEME_LABELS[preference]}`;

  return (
    <button
      type="button"
      onClick={() => setThemePreference(NEXT[preference])}
      title={collapsed ? `${label} — klik untuk ganti` : undefined}
      aria-label={`${label}. Klik untuk mengganti ke ${THEME_LABELS[NEXT[preference]]}`}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink ${
        collapsed ? 'justify-center px-0' : ''
      }`}
    >
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={ICONS[preference]} />
      </svg>
      {!collapsed && <span className="truncate">{THEME_LABELS[preference]}</span>}
    </button>
  );
}
