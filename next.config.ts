import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Kode QR dilayani langsung dari Midtrans; hanya dua host ini yang diizinkan.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.sandbox.midtrans.com' },
      { protocol: 'https', hostname: 'api.midtrans.com' },
    ],
  },
  // Dipakai saat deploy dengan Docker: menghasilkan bundel mandiri yang jauh
  // lebih kecil daripada menyalin seluruh node_modules.
  output: 'standalone',
};

export default nextConfig;
