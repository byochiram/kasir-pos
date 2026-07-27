/**
 * Lambang KasirApp: struk belanja dengan tepi bawah bergerigi.
 *
 * Dibuat sebagai SVG inline, bukan berkas gambar, supaya tajam di segala ukuran,
 * ikut berganti warna mengikuti tema, dan tidak menambah permintaan jaringan.
 */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="KasirApp">
      <defs>
        <linearGradient id="kasir-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      <rect width="40" height="40" rx="11" fill="url(#kasir-logo-bg)" />

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

export function LogoWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`text-lg font-bold tracking-tight ${className}`}>
      Kasir<span className="text-emerald-600 dark:text-emerald-400">App</span>
    </span>
  );
}
