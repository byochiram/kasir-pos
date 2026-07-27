'use client';

import { useEffect, useState } from 'react';
import { api, errorFields, errorMessage } from '@/lib/api-client';
import { useFetch } from '@/hooks/useFetch';
import { formatRupiah } from '@/lib/format';
import { useApp } from '@/components/AppProvider';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/PageHeader';
import BackupPanel from '@/components/BackupPanel';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { ErrorState, PageLoader } from '@/components/ui/States';
import type { Settings } from '@/lib/types';

const TIMEZONES = [
  { value: 420, label: 'WIB — Waktu Indonesia Barat (UTC+7)' },
  { value: 480, label: 'WITA — Waktu Indonesia Tengah (UTC+8)' },
  { value: 540, label: 'WIT — Waktu Indonesia Timur (UTC+9)' },
];

type FormState = {
  store_name: string;
  store_address: string;
  store_phone: string;
  store_logo: string;
  tax_rate: string;
  receipt_footer: string;
  low_stock_threshold: string;
  points_per_amount: string;
  tz_offset_minutes: string;
};

function toForm(settings: Settings): FormState {
  return {
    store_name: settings.store_name ?? '',
    store_address: settings.store_address ?? '',
    store_phone: settings.store_phone ?? '',
    store_logo: settings.store_logo ?? '',
    tax_rate: String(settings.tax_rate ?? 0),
    receipt_footer: settings.receipt_footer ?? '',
    low_stock_threshold: String(settings.low_stock_threshold ?? 0),
    points_per_amount: String(settings.points_per_amount ?? 10000),
    tz_offset_minutes: String(settings.tz_offset_minutes ?? 420),
  };
}

export default function SettingsPage() {
  // Form hanya dibuat setelah data ada. `key` memaksa state form direset
  // ketika data dimuat ulang, sehingga tidak perlu menyalin props ke state
  // lewat effect.
  const { data: settings, loading, error, reload } = useFetch<Settings>('/api/settings');

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !settings) return <PageLoader label="Memuat pengaturan..." />;

  return <SettingsForm key={settings.id + settings.tz_offset_minutes} settings={settings} />;
}

function SettingsForm({ settings }: { settings: Settings }) {
  const { refreshSettings } = useApp();
  const toast = useToast();

  const [initial, setInitial] = useState<FormState>(() => toForm(settings));
  const [form, setForm] = useState<FormState>(() => toForm(settings));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  // Peringatkan sebelum menutup tab kalau ada perubahan yang belum disimpan.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      const saved = await api.put<Settings>('/api/settings', form);
      const next = toForm(saved);
      setForm(next);
      setInitial(next);
      await refreshSettings();
      toast.success('Pengaturan disimpan');
    } catch (err) {
      setFieldErrors(errorFields(err));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const previewTax = Math.round((100_000 * (Number(form.tax_rate) || 0)) / 100);

  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Identitas toko, pajak, dan aturan operasional"
        actions={
          <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
            Ganti Password
          </Button>
        }
      />

      <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Identitas Toko" description="Tampil di header struk penjualan.">
            <TextField
              label="Nama Toko"
              required
              maxLength={200}
              value={form.store_name}
              error={fieldErrors.store_name}
              onChange={(event) => setForm({ ...form, store_name: event.target.value })}
            />
            <TextAreaField
              label="Alamat"
              rows={2}
              value={form.store_address}
              error={fieldErrors.store_address}
              onChange={(event) => setForm({ ...form, store_address: event.target.value })}
            />
            <TextField
              label="No. Telepon"
              inputMode="tel"
              maxLength={30}
              value={form.store_phone}
              error={fieldErrors.store_phone}
              onChange={(event) => setForm({ ...form, store_phone: event.target.value })}
            />
            <TextAreaField
              label="Footer Struk"
              rows={2}
              value={form.receipt_footer}
              error={fieldErrors.receipt_footer}
              hint="Contoh: Terima kasih atas kunjungan Anda!"
              onChange={(event) => setForm({ ...form, receipt_footer: event.target.value })}
            />
          </Section>

          <Section title="Operasional" description="Memengaruhi perhitungan transaksi dan laporan.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Tarif Pajak (%)"
                type="number"
                min={0}
                max={100}
                step="0.1"
                required
                value={form.tax_rate}
                error={fieldErrors.tax_rate}
                hint={`Rp 100.000 → pajak ${formatRupiah(previewTax)}`}
                onChange={(event) => setForm({ ...form, tax_rate: event.target.value })}
              />
              <TextField
                label="Batas Stok Minimum"
                type="number"
                min={0}
                required
                value={form.low_stock_threshold}
                error={fieldErrors.low_stock_threshold}
                hint="Default untuk produk baru"
                onChange={(event) => setForm({ ...form, low_stock_threshold: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Rupiah per 1 Poin"
                type="number"
                min={0}
                required
                value={form.points_per_amount}
                error={fieldErrors.points_per_amount}
                hint="Isi 0 untuk menonaktifkan poin"
                onChange={(event) => setForm({ ...form, points_per_amount: event.target.value })}
              />
              <SelectField
                label="Zona Waktu Toko"
                required
                value={form.tz_offset_minutes}
                error={fieldErrors.tz_offset_minutes}
                hint="Menentukan batas hari untuk laporan"
                onChange={(event) => setForm({ ...form, tz_offset_minutes: event.target.value })}
              >
                {TIMEZONES.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </SelectField>
            </div>
          </Section>

          <div className="flex flex-col-reverse items-center gap-2 sm:flex-row sm:justify-end">
            {dirty && <span className="text-xs text-amber-600 dark:text-amber-300">Ada perubahan yang belum disimpan</span>}
            <Button
              variant="secondary"
              disabled={!dirty || saving}
              onClick={() => setForm(initial)}
              className="w-full sm:w-auto"
            >
              Batalkan Perubahan
            </Button>
            <Button type="submit" loading={saving} disabled={!dirty} className="w-full sm:w-auto">
              Simpan Pengaturan
            </Button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-ink">Pratinjau Struk</h3>
            <div className="rounded-xl border border-dashed border-line bg-surface-2 p-4 font-mono text-xs">
              <p className="text-center font-bold uppercase">{form.store_name || 'Nama Toko'}</p>
              {form.store_address && <p className="text-center text-[10px] text-ink-muted">{form.store_address}</p>}
              {form.store_phone && <p className="text-center text-[10px] text-ink-muted">Telp {form.store_phone}</p>}
              <div className="my-2 border-t border-dashed border-line" />
              <div className="flex justify-between">
                <span>Contoh Produk</span>
                <span>{formatRupiah(100_000)}</span>
              </div>
              <div className="my-2 border-t border-dashed border-line" />
              <div className="flex justify-between text-ink-muted">
                <span>Subtotal</span>
                <span>{formatRupiah(100_000)}</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Pajak ({form.tax_rate || 0}%)</span>
                <span>{formatRupiah(previewTax)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-line pt-1 font-bold">
                <span>TOTAL</span>
                <span>{formatRupiah(100_000 + previewTax)}</span>
              </div>
              <p className="mt-3 text-center text-[10px] text-ink-muted">
                {form.receipt_footer || 'Terima kasih atas kunjungan Anda!'}
              </p>
            </div>
          </div>
        </aside>
      </form>

      {/* Di luar <form> pengaturan: backup bukan bagian dari "simpan pengaturan". */}
      <div className="mt-4 lg:w-2/3 lg:pr-2">
        <BackupPanel />
      </div>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <h2 className="font-bold text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      await api.post('/api/auth/change-password', form);
      toast.success('Password berhasil diubah');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
      onClose();
    } catch (err) {
      setFieldErrors(errorFields(err));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Ganti Password" size="sm" disableBackdropClose onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="Password Saat Ini"
          type="password"
          required
          autoComplete="current-password"
          value={form.current_password}
          error={fieldErrors.current_password}
          onChange={(event) => setForm({ ...form, current_password: event.target.value })}
        />
        <TextField
          label="Password Baru"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={form.new_password}
          error={fieldErrors.new_password}
          hint="Minimal 6 karakter"
          onChange={(event) => setForm({ ...form, new_password: event.target.value })}
        />
        <TextField
          label="Konfirmasi Password Baru"
          type="password"
          required
          autoComplete="new-password"
          value={form.confirm_password}
          error={fieldErrors.confirm_password}
          onChange={(event) => setForm({ ...form, confirm_password: event.target.value })}
        />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" loading={saving}>
            Ganti Password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
