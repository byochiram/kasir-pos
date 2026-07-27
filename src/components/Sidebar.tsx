'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { api } from '@/lib/api-client';
import { initials } from '@/lib/format';
import { useApp } from '@/components/AppProvider';
import type { Role } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ThemeToggle from '@/components/ThemeToggle';
import { LogoMark, LogoWordmark } from '@/components/Logo';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Kosong berarti semua role boleh melihat menu ini. */
  roles?: Role[];
}

const icon = (path: string) => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={path} />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: icon('M3 12l9-9 9 9M5 10v10h14V10') },
  {
    href: '/cashier',
    label: 'Kasir',
    icon: icon(
      'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 005.6 19H19M9 22a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z',
    ),
  },
  {
    href: '/transactions',
    label: 'Transaksi',
    icon: icon(
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    ),
  },
  {
    href: '/products',
    label: 'Produk',
    icon: icon('M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'),
  },
  {
    href: '/customers',
    label: 'Pelanggan',
    icon: icon(
      'M17 20h5v-2a3 3 0 00-5.4-1.8M17 20H7m10 0v-2c0-.7-.1-1.3-.4-1.8M7 20H2v-2a3 3 0 015.4-1.8M7 20v-2c0-.7.1-1.3.4-1.8m0 0a5 5 0 019.2 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    ),
  },
  {
    href: '/suppliers',
    label: 'Supplier',
    icon: icon(
      'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1V8a1 1 0 011-1h2.6a1 1 0 01.8.4l3.2 4.3a1 1 0 01.2.6V16a1 1 0 01-1 1h-1',
    ),
    roles: ['ADMIN'],
  },
  {
    href: '/purchase-orders',
    label: 'Purchase Order',
    icon: icon(
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h6',
    ),
    roles: ['ADMIN'],
  },
  {
    href: '/expenses',
    label: 'Pengeluaran',
    icon: icon(
      'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    ),
    roles: ['ADMIN'],
  },
  {
    href: '/reports',
    label: 'Laporan',
    icon: icon(
      'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    ),
    roles: ['ADMIN'],
  },
  { href: '/users', label: 'Kelola User', icon: icon('M12 4.4a4 4 0 100 8 4 4 0 000-8zM4 20a8 8 0 0116 0'), roles: ['ADMIN'] },
  {
    href: '/settings',
    label: 'Pengaturan',
    icon: icon(
      'M10.3 4.3c.3-1.7 2.7-1.7 3 0a1.7 1.7 0 002.6 1c1.5-.8 3.1 1 2.1 2.3a1.7 1.7 0 00.6 2.6c1.6.7 1.2 3.1-.5 3.2a1.7 1.7 0 00-1.4 2.4c.7 1.5-1.1 3-2.4 2a1.7 1.7 0 00-2.6.8c-.5 1.6-2.9 1.4-3.1-.3a1.7 1.7 0 00-2.3-1.3c-1.5.7-3-1.2-1.9-2.5a1.7 1.7 0 00-.7-2.6c-1.6-.6-1.3-3 .4-3.2a1.7 1.7 0 001.4-2.3c-.7-1.5 1.1-3 2.4-2.1.9.6 2.2.1 2.4-1zM12 15a3 3 0 100-6 3 3 0 000 6z',
    ),
    roles: ['ADMIN'],
  },
];

const COLLAPSE_KEY = 'kasir.sidebar.collapsed';
const COLLAPSE_EVENT = 'kasir:sidebar-collapse';

/**
 * localStorage adalah state di luar React. useSyncExternalStore membacanya tanpa
 * effect, dan snapshot server-nya `false` sehingga hidrasi tidak pernah mismatch.
 */
function subscribeCollapse(onChange: () => void): () => void {
  window.addEventListener(COLLAPSE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useApp();

  const collapsed = useSyncExternalStore(
    subscribeCollapse,
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
    () => false,
  );

  // Menyimpan path saat drawer dibuka: begitu pathname berubah — termasuk lewat
  // tombol back — drawer tertutup dengan sendirinya tanpa perlu effect.
  const [drawer, setDrawer] = useState({ open: false, path: pathname });
  const mobileOpen = drawer.open && drawer.path === pathname;

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const setMobileOpen = useCallback(
    (open: boolean) => setDrawer({ open, path: pathname }),
    [pathname],
  );

  function toggleCollapsed() {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '0' : '1');
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [mobileOpen, setMobileOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Meski request gagal, tetap arahkan ke login — cookie mungkin sudah tidak valid.
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
      router.replace('/login');
      router.refresh();
    }
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  /** Cocokkan per segmen supaya /users tidak ikut aktif saat membuka /users-archive. */
  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Buka menu navigasi"
        aria-expanded={mobileOpen}
        className={`fixed left-3 top-2.5 z-30 rounded-xl border border-line bg-surface p-2 text-ink shadow-sm lg:hidden ${
          mobileOpen ? 'pointer-events-none opacity-0' : ''
        }`}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mobileOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-line bg-surface text-ink-muted transition-[width,transform] duration-300 lg:static lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'w-16' : 'w-60'}`}
        aria-label="Navigasi utama"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <LogoMark className="h-9 w-9 shrink-0" />
            {!collapsed && <LogoWordmark className="truncate text-lg text-ink" />}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Tutup menu"
            className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {visibleItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-emerald-600 text-white shadow-sm' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-line p-2">
          {user && (
            <div className={`mb-2 flex items-center gap-2.5 rounded-xl px-2 py-2 ${collapsed ? 'justify-center' : ''}`}>
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white"
                title={collapsed ? `${user.name} (${user.role})` : undefined}
              >
                {initials(user.name)}
              </span>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                  <p className="truncate text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    {user.role}
                  </p>
                </div>
              )}
            </div>
          )}

          <ThemeToggle collapsed={collapsed} />

          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            title={collapsed ? 'Keluar' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-300 ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            {!collapsed && <span>Keluar</span>}
          </button>

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Perlebar sidebar' : 'Perkecil sidebar'}
            className={`mt-1 hidden w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink lg:flex ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <svg
              className={`h-5 w-5 shrink-0 transition-transform ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!collapsed && <span>Perkecil</span>}
          </button>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmLogout}
        title="Keluar dari aplikasi?"
        message="Anda perlu login kembali untuk mengakses aplikasi."
        confirmLabel="Ya, keluar"
        destructive
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </>
  );
}
