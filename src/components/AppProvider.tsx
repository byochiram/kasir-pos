'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { Role, Settings, SessionPayload } from '@/lib/types';
import { ToastProvider } from '@/components/ui/Toast';

interface AppState {
  user: SessionPayload | null;
  settings: Settings | null;
  /** Offset zona waktu toko dalam menit; dipakai semua helper format tanggal. */
  tzOffset: number;
  isAdmin: boolean;
  /** true selama sesi dan pengaturan awal belum selesai dimuat. */
  loading: boolean;
  refreshSettings: () => Promise<void>;
  /** Dipanggil setelah login supaya provider mengambil sesi yang baru. */
  refreshSession: () => void;
}

const AppContext = createContext<AppState | null>(null);

/** Dipakai sebelum settings termuat, mengikuti default WIB. */
const DEFAULT_TZ_OFFSET = 420;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionPayload | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState(0);

  const refreshSettings = useCallback(async () => {
    try {
      setSettings(await api.get<Settings>('/api/settings'));
    } catch {
      // Biarkan null; komponen memakai nilai default dan tetap bisa dipakai.
    }
  }, []);

  const refreshSession = useCallback(() => setSessionToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api.get<SessionPayload>('/api/auth/me'), api.get<Settings>('/api/settings')]).then(
      ([me, loadedSettings]) => {
        if (cancelled) return;
        setUser(me.status === 'fulfilled' ? me.value : null);
        if (loadedSettings.status === 'fulfilled') setSettings(loadedSettings.value);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  const value: AppState = {
    user,
    settings,
    tzOffset: settings?.tz_offset_minutes ?? DEFAULT_TZ_OFFSET,
    isAdmin: user?.role === 'ADMIN',
    loading,
    refreshSettings,
    refreshSession,
  };

  return (
    <AppContext.Provider value={value}>
      <ToastProvider>{children}</ToastProvider>
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp harus dipakai di dalam <AppProvider>');
  return context;
}

export function useRequireRole(roles: readonly Role[]): boolean {
  const { user, loading } = useApp();
  if (loading || !user) return false;
  return roles.includes(user.role);
}
