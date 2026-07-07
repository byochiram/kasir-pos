'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      router.push('/');
      router.refresh();
    } catch { setError('Network error. Please try again.'); } finally { setLoading(false); }
  };

  const features = [
    { icon: '🛒', title: 'Kasir Cepat', desc: 'Transaksi cepat dengan barcode scanner' },
    { icon: '📊', title: 'Laporan Real-time', desc: 'Pantau penjualan kapan saja' },
    { icon: '📦', title: 'Kelola Stok', desc: 'Stok otomatis saat transaksi' },
    { icon: '👥', title: 'Manajemen Pelanggan', desc: 'Poin reward & riwayat belanja' },
  ];

  return (
    <div className="min-h-screen flex bg-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-emerald-50 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 opacity-60" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-green-50 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 opacity-60" />
      <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-green-50 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 opacity-40" />

      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-green-800 p-10 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-32 h-32 border-2 border-white/30 rounded-2xl rotate-12" />
          <div className="absolute top-40 right-32 w-24 h-24 border-2 border-white/20 rounded-full" />
          <div className="absolute bottom-32 left-32 w-20 h-20 border-2 border-white/25 rounded-xl -rotate-6" />
          <div className="absolute bottom-20 right-20 w-40 h-40 border-2 border-white/15 rounded-3xl rotate-45" />
          <div className="absolute top-1/2 left-1/3 w-16 h-16 border-2 border-white/20 rounded-lg rotate-12" />
        </div>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-14">
            <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <span className="text-xl">🛒</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">KasirApp</h1>
              <p className="text-emerald-200 text-xs">Point of Sale System</p>
            </div>
          </div>

          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
            Kelola bisnis Anda<br />
            <span className="text-emerald-200">dengan lebih mudah</span>
          </h2>
          <p className="text-emerald-200/80 text-base max-w-md leading-relaxed">
            Sistem kasir modern untuk mengelola penjualan, stok, pelanggan, dan laporan dalam satu aplikasi.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-3">
          {features.map((f, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:bg-white/15 transition-all duration-300">
              <span className="text-2xl mb-2 block">{f.icon}</span>
              <h3 className="text-white font-semibold text-sm mb-0.5">{f.title}</h3>
              <p className="text-emerald-200/70 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-[380px] animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <span className="text-xl">🛒</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">KasirApp</h1>
              <p className="text-slate-500 text-xs">Point of Sale System</p>
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Selamat Datang 👋</h2>
            <p className="text-slate-500 text-sm">Masuk ke akun Anda untuk melanjutkan</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs flex items-center gap-2 animate-scale-in">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative group">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-3.5 py-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white outline-none transition-all duration-200"
                  placeholder="admin@kasir.com" required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative group">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white outline-none transition-all duration-200"
                  placeholder="••••••••" required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? (
                    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full py-3 text-sm bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 active:scale-[0.98] focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-emerald-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Memproses...
                </span>
              ) : 'Masuk'}
            </button>
          </form>

          <div className="mt-7 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-400 text-center mb-2">Demo Akun</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-white rounded-lg p-2.5 border border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 mb-0.5">Admin</p>
                <p className="text-xs font-medium text-slate-700">admin@kasir.com</p>
              </div>
              <div className="flex-1 bg-white rounded-lg p-2.5 border border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 mb-0.5">Password</p>
                <p className="text-xs font-medium text-slate-700">admin123</p>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-7">KasirApp v1.0 &middot; Point of Sale System</p>
        </div>
      </div>
    </div>
  );
}
