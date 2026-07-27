export const THEME_KEY = 'kasir.theme';
export const THEME_EVENT = 'kasir:theme-change';

export const THEMES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEMES)[number];

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: 'Terang',
  dark: 'Gelap',
  system: 'Ikuti sistem',
};

/**
 * Skrip ini disisipkan di <head> dan berjalan sebelum halaman digambar.
 * Tanpanya, halaman sempat tampil terang sepersekian detik sebelum React
 * sempat memasang class gelap — kedipan putih yang menyilaukan di ruangan gelap.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var pref = localStorage.getItem('${THEME_KEY}') || 'system';
    var dark = pref === 'dark' ||
      (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`.trim();

export function readThemePreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY);
  return (THEMES as readonly string[]).includes(stored ?? '') ? (stored as ThemePreference) : 'system';
}

export function resolveIsDark(preference: ThemePreference): boolean {
  if (preference === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches;
  return preference === 'dark';
}

export function applyTheme(preference: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolveIsDark(preference));
}

export function setThemePreference(preference: ThemePreference): void {
  localStorage.setItem(THEME_KEY, preference);
  applyTheme(preference);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Berlangganan perubahan preferensi maupun perubahan tema sistem. */
export function subscribeTheme(onChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemChange = () => {
    // Tema sistem hanya relevan saat preferensinya "ikuti sistem".
    if (readThemePreference() === 'system') applyTheme('system');
    onChange();
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener('storage', onChange);
  media.addEventListener('change', handleSystemChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener('storage', onChange);
    media.removeEventListener('change', handleSystemChange);
  };
}
