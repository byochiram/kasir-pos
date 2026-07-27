/**
 * Timestamp dari SQLite berbentuk "YYYY-MM-DD HH:MM:SS" dalam UTC tanpa penanda
 * zona. `new Date()` akan menganggapnya waktu lokal perangkat, jadi harus
 * ditambahkan "Z" secara eksplisit sebelum diparse.
 */
export function parseUtc(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const withZone = /[Z+]|-\d{2}:\d{2}$/.test(normalized.slice(10)) ? normalized : `${normalized}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Geser waktu UTC ke zona toko lalu baca dengan getter UTC, supaya tampilan sama
 * di semua perangkat berapa pun timezone sistemnya.
 */
function shift(date: Date, offsetMinutes: number): Date {
  return new Date(date.getTime() + offsetMinutes * 60_000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const pad = (n: number) => String(n).padStart(2, '0');

export function formatRupiah(amount: number | null | undefined): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Versi ringkas untuk kartu statistik: 1.250.000 -> Rp 1,25 jt */
export function formatRupiahShort(amount: number | null | undefined): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  if (abs >= 10_000) return `${sign}Rp ${Math.round(abs / 1000)} rb`;
  return formatRupiah(value);
}

export function formatNumber(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('id-ID').format(n);
}

/** "27 Jul 2026" */
export function formatDate(value: string | null | undefined, offsetMinutes = 420): string {
  const parsed = parseUtc(value);
  if (!parsed) return '-';
  const d = shift(parsed, offsetMinutes);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "27 Jul 2026, 14:30" */
export function formatDateTime(value: string | null | undefined, offsetMinutes = 420): string {
  const parsed = parseUtc(value);
  if (!parsed) return '-';
  const d = shift(parsed, offsetMinutes);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatTime(value: string | null | undefined, offsetMinutes = 420): string {
  const parsed = parseUtc(value);
  if (!parsed) return '-';
  const d = shift(parsed, offsetMinutes);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Format tanggal polos "YYYY-MM-DD" (kolom date, bukan timestamp) jadi "27 Jul 2026". */
export function formatPlainDate(value: string | null | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return value || '-';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Label singkat untuk sumbu grafik: "Sen 27". */
export function formatChartDay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00Z`);
  return `${DAYS[date.getUTCDay()].slice(0, 3)} ${date.getUTCDate()}`;
}

/** Tanggal hari ini di zona toko, format YYYY-MM-DD — bukan UTC. */
export function todayInStore(offsetMinutes = 420): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** Geser tanggal "YYYY-MM-DD" sejumlah hari tanpa terpengaruh timezone perangkat. */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function initials(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}
