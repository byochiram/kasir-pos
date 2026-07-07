'use client';

import { useState, useEffect } from 'react';

interface Settings {
  id: string;
  store_name: string;
  store_address: string;
  store_phone: string;
  tax_rate: number;
  receipt_footer: string;
  low_stock_threshold: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    id: 'default',
    store_name: '',
    store_address: '',
    store_phone: '',
    tax_rate: 11,
    receipt_footer: '',
    low_stock_threshold: 5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setSettings(data);
      } catch {
        setMessage({ type: 'error', text: 'Gagal memuat pengaturan' });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (field: keyof Settings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: settings.store_name,
          store_address: settings.store_address,
          store_phone: settings.store_phone,
          tax_rate: settings.tax_rate,
          receipt_footer: settings.receipt_footer,
          low_stock_threshold: settings.low_stock_threshold,
        }),
      });
      if (!res.ok) throw new Error();
      setMessage({ type: 'success', text: 'Pengaturan berhasil disimpan' });
    } catch {
      setMessage({ type: 'error', text: 'Gagal menyimpan pengaturan' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Pengaturan</h1>
        <p className="text-slate-500 mb-8">Kelola pengaturan aplikasi kasir</p>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12">
          <div className="flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin mb-3" />
            Memuat pengaturan...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan</h1>
        <p className="text-slate-500 mt-1">Kelola pengaturan aplikasi kasir</p>
      </div>

      {message && (
        <div className={`mb-6 rounded-xl p-4 text-sm font-medium flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
            : 'bg-red-50 text-red-700 border border-red-200/60'
        }`}>
          {message.type === 'success' ? (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama Toko</label>
          <input
            type="text"
            value={settings.store_name}
            onChange={(e) => handleChange('store_name', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="Nama toko Anda"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Alamat Toko</label>
          <textarea
            value={settings.store_address}
            onChange={(e) => handleChange('store_address', e.target.value)}
            rows={2}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
            placeholder="Alamat lengkap toko"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Telepon Toko</label>
          <input
            type="text"
            value={settings.store_phone}
            onChange={(e) => handleChange('store_phone', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="Nomor telepon toko"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tarif Pajak (%)</label>
            <input
              type="number"
              value={settings.tax_rate}
              onChange={(e) => handleChange('tax_rate', parseFloat(e.target.value) || 0)}
              min={0}
              max={100}
              step={0.5}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="11"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Batas Stok Minimum</label>
            <input
              type="number"
              value={settings.low_stock_threshold}
              onChange={(e) => handleChange('low_stock_threshold', parseInt(e.target.value) || 0)}
              min={0}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="5"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Footer Struk</label>
          <textarea
            value={settings.receipt_footer}
            onChange={(e) => handleChange('receipt_footer', e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
            placeholder="Teks footer yang muncul di struk"
          />
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 py-2.5 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Simpan Pengaturan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
