'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { AppProvider, useApp } from '@/components/AppProvider';
import { PageLoader } from '@/components/ui/States';

const BARE_PATHS = ['/login'];
/** Halaman kasir mengatur tinggi dan scroll-nya sendiri, jadi tanpa padding wrapper. */
const FULL_BLEED_PATHS = ['/cashier'];

function matches(pathname: string, paths: string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useApp();

  if (matches(pathname, BARE_PATHS)) return <>{children}</>;

  // Halaman ditahan sampai sesi diketahui. Tanpa ini, UI sempat dirender
  // seolah user bukan admin dan menu/angka yang bergantung role berkedip salah.
  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-surface-2">
        <PageLoader label="Memuat aplikasi..." />
      </div>
    );
  }

  const fullBleed = matches(pathname, FULL_BLEED_PATHS);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface-2">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className={fullBleed ? 'h-full' : 'animate-fade-in mx-auto max-w-[1600px] p-4 sm:p-6'}>{children}</div>
      </main>
    </div>
  );
}
