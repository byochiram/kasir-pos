'use client';

import { useId } from 'react';

/**
 * Lambang KasirApp: struk belanja dengan tepi bawah bergerigi.
 *
 * Dibuat sebagai SVG inline, bukan berkas gambar, supaya tajam di segala ukuran,
 * ikut berganti warna mengikuti tema, dan tidak menambah permintaan jaringan.
 */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  // ID gradasi harus unik per instance. Halaman login memuat dua logo — satu
  // khusus desktop, satu khusus mobile — dan salah satunya selalu berada di
  // dalam elemen display:none. Dengan ID yang sama, logo yang tampil ikut
  // menunjuk definisi milik elemen tersembunyi dan berakhir tanpa warna.
  const gradientId = useId();

  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="KasirApp">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      <rect width="40" height="40" rx="11" fill={`url(#${gradientId})`} />

      {/* Struk: sisi atas lurus, sisi bawah bergerigi seperti kertas yang disobek. */}
      <path
        d="M12 10.5h16a1 1 0 0 1 1 1v16.2l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6-2.6-1.7V11.5a1 1 0 0 1 1-1z"
        fill="#ffffff"
        fillOpacity="0.96"
      />

      {/* Baris item dan satu baris total yang lebih pendek. */}
      <rect x="15" y="15" width="10" height="2" rx="1" fill="#059669" />
      <rect x="15" y="19.5" width="10" height="2" rx="1" fill="#059669" fillOpacity="0.55" />
      <rect x="15" y="24" width="6" height="2" rx="1" fill="#059669" fillOpacity="0.35" />
    </svg>
  );
}

/**
 * Lambang tanpa kotak latar, mewarisi warna teks induknya.
 * Dipakai di atas bidang berwarna, tempat kotak emerald akan melebur.
 */
export function LogoGlyph({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="KasirApp">
      <path
        d="M12 6h16a1 1 0 0 1 1 1v26.5l-2.8-1.9-2.8 1.9-2.8-1.9-2.8 1.9-2.8-1.9-2.8 1.9L11 33.5V7a1 1 0 0 1 1-1z"
        fill="currentColor"
      />
      {/* Baris item dilubangi, bukan digambar, supaya ikut warna apa pun latarnya. */}
      <rect x="15" y="12" width="10" height="2.4" rx="1.2" fill="currentColor" fillOpacity="0.01" />
      <g fill="#059669">
        <rect x="15" y="12" width="10" height="2.4" rx="1.2" />
        <rect x="15" y="17.5" width="10" height="2.4" rx="1.2" fillOpacity="0.6" />
        <rect x="15" y="23" width="6" height="2.4" rx="1.2" fillOpacity="0.4" />
      </g>
    </svg>
  );
}

export function LogoWordmark({
  className = '',
  accentClassName = 'text-emerald-600 dark:text-emerald-400',
}: {
  className?: string;
  accentClassName?: string;
}) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      Kasir<span className={accentClassName}>App</span>
    </span>
  );
}
