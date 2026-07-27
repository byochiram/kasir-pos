'use client';

import { useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface RestoreResult {
  restored: {
    products: number;
    customers: number;
    suppliers: number;
    transactions: number;
    expenses: number;
    users: number;
  };
  previousBackupFile: string;
}

export default function BackupPanel() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [downloading, setDownloading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await api.download('/api/backup', 'kasir-backup.db');
      toast.success('Backup berhasil diunduh');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset value supaya memilih file yang sama dua kali tetap memicu onChange.
    event.target.value = '';
    if (file) setPendingFile(file);
  }

  async function handleRestore() {
    if (!pendingFile) return;
    setRestoring(true);
    try {
      const result = await api.upload<RestoreResult>('/api/backup', pendingFile);
      setPendingFile(null);
      toast.success(
        `Data dipulihkan: ${formatNumber(result.restored.products)} produk, ` +
          `${formatNumber(result.restored.transactions)} transaksi`,
      );
      // Seluruh data di layar sudah tidak relevan — muat ulang aplikasi.
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      toast.error(errorMessage(error));
      setRestoring(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <h2 className="font-bold text-ink">Backup & Pemulihan</h2>
      <p className="mt-0.5 text-sm text-ink-muted">
        Simpan salinan seluruh data secara berkala, terutama sebelum tutup buku bulanan.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-3.5">
          <p className="text-sm font-semibold text-ink">Unduh Backup</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Menghasilkan satu file berisi seluruh produk, transaksi, dan pengaturan.
          </p>
          <Button variant="secondary" size="sm" className="mt-3" loading={downloading} onClick={handleDownload}>
            ⬇ Unduh sekarang
          </Button>
        </div>

        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/40 dark:bg-red-500/10 p-3.5">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">Pulihkan dari Backup</p>
          <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
            Seluruh data saat ini akan diganti. Salinan otomatis dibuat sebelum penggantian.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".db,application/octet-stream"
            onChange={pickFile}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={restoring}
            onClick={() => fileRef.current?.click()}
          >
            Pilih file backup...
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={pendingFile !== null}
        title="Pulihkan database?"
        destructive
        loading={restoring}
        confirmLabel="Ya, timpa data sekarang"
        message={
          <>
            Semua produk, transaksi, pelanggan, dan pengaturan yang ada sekarang akan{' '}
            <strong>diganti</strong> oleh isi file <strong>{pendingFile?.name}</strong>.
            <br />
            <br />
            Data lama tetap disimpan sebagai file cadangan di folder aplikasi, jadi masih bisa dikembalikan bila
            ternyata salah file.
          </>
        }
        onConfirm={handleRestore}
        onCancel={() => setPendingFile(null)}
      />
    </section>
  );
}
