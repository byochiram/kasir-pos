import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'KasirApp — Point of Sale',
  description: 'Aplikasi kasir untuk toko: transaksi, stok, pelanggan, dan laporan penjualan.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Kasir sering dipakai di tablet; biarkan pengguna memperbesar bila perlu.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: class "dark" dipasang skrip di bawah sebelum
    // React menghidrasi, jadi markup server memang sengaja berbeda.
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Dijalankan sebelum halaman digambar agar tema gelap tidak berkedip putih. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
