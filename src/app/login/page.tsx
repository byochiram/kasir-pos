'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api-client';
import { useApp } from '@/components/AppProvider';
import Button from '@/components/ui/Button';
import { LogoMark, LogoWordmark } from '@/components/Logo';

/** Ikon SVG, bukan emoji: tampilannya konsisten di semua sistem operasi. */
const FEATURES = [
  {
    icon: 'M4 6h16M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12M4 18h16',
    text: 'Transaksi cepat dengan scan barcode',
  },
  {
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    text: 'Stok terpotong otomatis dan tercatat riwayatnya',
  },
  {
    icon: 'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 3h3m3 0h.01M14 20h6',
    text: 'QRIS dan transfer terkonfirmasi otomatis',
  },
  {
    icon: 'M3 20h18M7 20V10m5 10V4m5 16v-7',
    text: 'Laporan penjualan, laba, dan pengeluaran',
  },
];

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@kasir.com', password: 'admin123' },
  { role: 'Kasir', email: 'kasir@kasir.com', password: 'kasir123' },
];

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

      {/* Sengaja selalu tampil: aplikasi ini dipublikasikan sebagai portfolio,
          jadi siapa pun yang membukanya harus bisa langsung mencoba. */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <p className="mb-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          Akun demo — silakan dicoba
        </p>
        <div className="space-y-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.role}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(account.password);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-emerald-200/70 bg-surface px-3 py-2 text-left text-xs transition-colors hover:border-emerald-400 dark:border-emerald-500/20"
            >
              <span className="min-w-0">
                <span className="font-semibold text-ink">{account.role}</span>
                <span className="ml-2 text-ink-muted">{account.email}</span>
              </span>
              <span className="shrink-0 font-medium text-emerald-700 dark:text-emerald-300">Isi otomatis</span>
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}

/**
 * Pratinjau statis berisi kartu omzet dan struk.
 *
 * Angkanya sengaja dibuat contoh, bukan diambil dari database: halaman login
 * belum punya sesi, dan omzet toko bukan sesuatu yang pantas ditampilkan
 * sebelum orang masuk.
 */
function PreviewCards() {
  const bars = [38, 52, 44, 68, 58, 82, 100];

  return (
    <div className="relative mt-10 h-[248px] max-w-md" aria-hidden>
      {/* Kartu omzet: satu-satunya bidang emerald, jadi ia yang menarik mata. */}
      <div className="absolute left-0 top-0 w-64 -rotate-2 rounded-2xl bg-emerald-600 p-4 text-white shadow-xl shadow-emerald-600/20">
        <p className="text-[11px] uppercase tracking-wide text-emerald-100">Omzet Hari Ini</p>
        <p className="mt-1 text-2xl font-bold">Rp 2.450.000</p>
        <div className="mt-3 flex h-10 items-end gap-1.5">
          {bars.map((height, index) => (
            <span
              key={index}
              className="flex-1 rounded-sm bg-white/35 last:bg-white"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <p className="mt-2.5 text-[11px] text-emerald-100">+12% dari kemarin</p>
      </div>

      {/* Struk menimpa sebagian kartu omzet supaya komposisinya terasa bertumpuk. */}
      <div className="absolute right-0 top-20 w-56 rotate-2 rounded-2xl border border-line bg-surface p-4 font-mono shadow-xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-wide text-ink">KasirApp Store</p>
        <div className="my-2 border-t border-dashed border-line" />
        {[
          ['Nasi Goreng', '18.000'],
          ['Es Teh Manis', '5.000'],
          ['Kerupuk', '2.000'],
        ].map(([item, price]) => (
          <div key={item} className="flex justify-between text-[10px] text-ink-muted">
            <span>{item}</span>
            <span>{price}</span>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-line" />
        <div className="flex justify-between text-[11px] font-bold text-ink">
          <span>TOTAL</span>
          <span>Rp 27.750</span>
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-1.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          QRIS Lunas
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh">
      {/* Latar dibiarkan netral; warnanya datang dari kartu pratinjau, sehingga
          logo emerald tetap menonjol dan tidak melebur dengan bidang di belakangnya. */}
      <div className="relative hidden flex-1 overflow-hidden border-r border-line bg-surface-2 lg:flex lg:flex-col lg:justify-center lg:px-14">
        {/* Scrim: lapisan gelap semi-transparan yang meredupkan latar saja.
            Diletakkan di belakang konten agar kartu dan teks tetap tajam. */}
        <div className="pointer-events-none absolute inset-0 bg-slate-900/[0.07] dark:bg-black/25" aria-hidden />

        <div className="relative">
          <div className="mb-8 flex items-center gap-3">
            <LogoMark className="h-12 w-12" />
            <LogoWordmark className="text-2xl text-ink" />
          </div>

          <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight text-ink">
            Kelola penjualan toko Anda dalam satu tempat.
          </h1>
          <p className="mt-3.5 max-w-md text-ink-muted">
            Aplikasi kasir yang mencatat setiap transaksi, stok, dan laba — tanpa ribet.
          </p>

          <PreviewCards />

          <ul className="mt-9 flex max-w-md flex-wrap gap-x-5 gap-y-2">
            {FEATURES.map((feature) => (
              <li key={feature.text} className="flex items-center gap-1.5 text-xs text-ink-muted">
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {feature.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-surface-2 px-5 py-10">
        <div className="w-full max-w-[380px]">
          {/* Logo hanya di mobile; di desktop sudah tampil besar di panel kiri. */}
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <LogoMark className="h-11 w-11" />
            <LogoWordmark className="text-xl text-ink" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-ink">Masuk ke akun Anda</h2>
          <p className="mb-6 mt-1.5 text-sm text-ink-muted">Gunakan email dan password yang diberikan admin toko.</p>

          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-3" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
