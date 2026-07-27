/**
 * Menggabungkan permintaan identik yang datang bersamaan menjadi satu.
 *
 * Dipakai untuk pembuatan tagihan di payment gateway: dua permintaan serentak
 * untuk transaksi yang sama akan membuat gateway menolak yang kedua sebagai
 * order_id duplikat, dan error itulah yang sampai ke layar kasir meski
 * tagihannya sebenarnya sudah berhasil dibuat. Pemicunya bisa React StrictMode
 * di development, klik ganda, atau dua tab kasir terbuka sekaligus.
 *
 * Cukup untuk aplikasi satu proses seperti ini. Kalau nanti dijalankan dengan
 * beberapa instance, penguncian harus pindah ke database atau Redis.
 */
const inFlight = new Map<string, Promise<unknown>>();

export function singleFlight<T>(key: string, work: () => Promise<T>): Promise<T> {
  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const promise = work().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
