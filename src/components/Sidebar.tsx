'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface User {
  name: string;
  role: string;
}

const navItems = [
  { label: 'Dashboard', href: '/', icon: '📊' },
  { label: 'Kasir', href: '/cashier', icon: '🛒' },
  { label: 'Produk', href: '/products', icon: '📦' },
  { label: 'Pelanggan', href: '/customers', icon: '👥' },
  { label: 'Supplier', href: '/suppliers', icon: '🚚' },
  { label: 'Pengeluaran', href: '/expenses', icon: '💸' },
  { label: 'Laporan', href: '/reports', icon: '📈' },
  { label: 'Pengaturan', href: '/settings', icon: '⚙️' },
];

const adminItem = { label: 'Kelola User', href: '/users', icon: '👤' };

const roleBadgeColors: Record<string, string> = {
  ADMIN: 'bg-emerald-100 text-emerald-700',
  KASIR: 'bg-blue-100 text-blue-700',
  VIEWER: 'bg-slate-100 text-slate-600',
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) { const data = await res.json(); setUser(data.user); }
      } catch {}
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    router.push('/login');
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const allItems = user?.role === 'ADMIN' ? [...navItems, adminItem] : navItems;

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-white rounded-lg shadow-md border border-slate-200 text-slate-600"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ${collapsed ? 'w-[60px]' : 'w-56'} ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-sm">🛒</span>
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight">KasirApp</h1>
                <p className="text-[10px] text-slate-400">Point of Sale</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {allItems.map((item) => {
            const active = isActive(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-emerald-500 rounded-r-full" />}
                <span className={`text-sm flex-shrink-0 ${active ? '' : 'opacity-60 group-hover:opacity-100'}`}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </a>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-2 border-t border-slate-100">
          {user && !collapsed && (
            <div className="mb-2 mx-1 px-2.5 py-2 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{user.name}</p>
                  <span className={`inline-block mt-0.5 px-1.5 py-0 text-[9px] font-semibold rounded-full ${roleBadgeColors[user.role] || 'bg-slate-100 text-slate-600'}`}>{user.role}</span>
                </div>
              </div>
            </div>
          )}
          {user && collapsed && (
            <div className="mb-2 flex justify-center">
              <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all ${collapsed ? 'justify-center' : ''}`}
          >
            <span className="text-sm">🚪</span>
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex fixed bottom-3 z-30 items-center justify-center w-6 h-6 bg-white text-slate-400 hover:text-slate-600 rounded-full shadow-sm border border-slate-200 transition-all"
        style={{ left: collapsed ? '48px' : '216px' }}
      >
        <svg className={`w-3 h-3 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </>
  );
}
