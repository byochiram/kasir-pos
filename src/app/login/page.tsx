'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api-client';
import { useApp } from '@/components/AppProvider';
import Button from '@/components/ui/Button';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshSession } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/login', { email: email.trim(), password });
      // Provider tetap ter-mount saat pindah halaman, jadi sesi harus diambil
      // ulang secara eksplisit — kalau tidak, aplikasi mengira belum ada user.
      refreshSession();
      const next = searchParams.get('next');
      // Hanya izinkan path internal — mencegah open redirect lewat ?next=
      const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      router.replace(target);
      router.refresh();
      // Sengaja tidak mematikan loading di sini: tombol harus tetap nonaktif
      // sampai navigasi selesai supaya tidak bisa submit dua kali.
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/15 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoFocus
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nama@toko.com"
          className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
            placeholder="••••••••"
            className="w-full rounded-xl border border-line px-3.5 py-2.5 pr-11 text-sm outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink-muted"
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
        {capsLock && <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-300">Caps Lock sedang aktif</p>}
      </div>

      <Button type="submit" loading={loading} className="w-full py-3">
        {loading ? 'Masuk...' : 'Masuk'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh">
      <div className="relative hidden flex-1 overflow-hidden bg-slate-900 lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div
          className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-lg font-black text-white">
              K
            </span>
            <span className="text-2xl font-bold text-white">KasirApp</span>
          </div>
          <h1 className="max-w-md text-3xl font-bold leading-tight text-white">
            Kelola penjualan toko Anda dalam satu tempat.
          </h1>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              'Transaksi cepat dengan dukungan scan barcode',
              'Stok otomatis terpotong dan tercatat riwayatnya',
              'Laporan penjualan, laba, dan pengeluaran harian',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 text-emerald-400" aria-hidden>
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-surface-2 px-5 py-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-7 lg:hidden">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-lg font-black text-white">
              K
            </span>
            <h1 className="text-xl font-bold text-ink">KasirApp</h1>
          </div>

          <h2 className="text-xl font-bold text-ink">Masuk ke akun Anda</h2>
          <p className="mb-6 mt-1 text-sm text-ink-muted">Gunakan email dan password yang diberikan admin toko.</p>

          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-3" />}>
            <LoginForm />
          </Suspense>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 rounded-xl border border-dashed border-line bg-surface p-3 text-xs text-ink-muted">
              <p className="mb-1 font-semibold text-ink-muted">Akun demo (hanya tampil saat development)</p>
              <p>Admin — admin@kasir.com / admin123</p>
              <p>Kasir — kasir@kasir.com / kasir123</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
