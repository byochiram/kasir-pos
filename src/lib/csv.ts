/**
 * Unduh data sebagai CSV.
 * Memakai pemisah titik koma dan BOM UTF-8 karena Excel dengan locale Indonesia
 * membaca koma sebagai desimal dan tanpa BOM akan merusak karakter non-ASCII.
 */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const escape = (cell: string | number) => {
    const text = String(cell ?? '');
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const csv = rows.map((row) => row.map(escape).join(';')).join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
