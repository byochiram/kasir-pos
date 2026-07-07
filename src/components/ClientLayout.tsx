'use client';

import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

const noSidebarPaths = ['/login'];
const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/cashier': 'Kasir',
  '/products': 'Produk',
  '/customers': 'Pelanggan',
  '/suppliers': 'Supplier',
  '/expenses': 'Pengeluaran',
  '/reports': 'Laporan',
  '/settings': 'Pengaturan',
  '/users': 'Kelola User',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const path of Object.keys(pageTitles)) {
    if (path !== '/' && pathname.startsWith(path)) return pageTitles[path];
  }
  return 'KasirApp';
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !noSidebarPaths.some(p => pathname.startsWith(p));

  if (!showSidebar) return <>{children}</>;

  const title = getPageTitle(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        </header>
        <div className="animate-fade-in p-5">
          {children}
        </div>
      </main>
    </div>
  );
}
