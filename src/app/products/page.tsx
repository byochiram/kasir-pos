'use client';

import { useState, useEffect } from 'react';

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  barcode: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    cost_price: '',
    stock: '',
    min_stock: '',
    category: '',
    barcode: ''
  });
  const [stockData, setStockData] = useState({ quantity: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  async function fetchProducts() {
    try {
      setLoading(true);
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCategories() {
    try {
      const res = await fetch('/api/products?categories=true');
      const data = await res.json();
      setCategories(data.map((c: any) => c.category));
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
    const matchCategory = !filterCategory || p.category === filterCategory;
    return matchSearch && matchCategory;
  });

  function openCreateModal() {
    setEditingProduct(null);
    setFormData({ name: '', price: '', cost_price: '', stock: '', min_stock: '', category: '', barcode: '' });
    setShowModal(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: String(product.price),
      cost_price: String(product.cost_price),
      stock: String(product.stock),
      min_stock: String(product.min_stock),
      category: product.category,
      barcode: product.barcode
    });
    setShowModal(true);
  }

  function openStockModal(product: Product) {
    setSelectedProduct(product);
    setStockData({ quantity: '', notes: '' });
    setShowStockModal(true);
  }

  function openDeleteModal(product: Product) {
    setSelectedProduct(product);
    setShowDeleteModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          price: Number(formData.price),
          cost_price: Number(formData.cost_price),
          stock: Number(formData.stock),
          min_stock: Number(formData.min_stock),
          category: formData.category,
          barcode: formData.barcode
        })
      });
      setShowModal(false);
      fetchProducts();
    } catch (error) {
      console.error('Failed to save product:', error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStockIn(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmitting(true);
    try {
      await fetch('/api/products/stock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          quantity: Number(stockData.quantity),
          notes: stockData.notes
        })
      });
      setShowStockModal(false);
      fetchProducts();
    } catch (error) {
      console.error('Failed to stock in:', error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedProduct) return;
    setSubmitting(true);
    try {
      await fetch(`/api/products/${selectedProduct.id}`, { method: 'DELETE' });
      setShowDeleteModal(false);
      fetchProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center mb-8 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kelola Produk</h1>
          <p className="text-slate-500 mt-1">Kelola daftar produk dan inventaris</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2"
        >
          <span className="text-lg">+</span> Tambah Produk
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 mb-6 animate-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="Cari produk atau barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          >
            <option value="">Semua Kategori</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">Memuat data...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kategori</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Harga Jual</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Harga Beli</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Stok</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="text-4xl mb-2">📦</div>
                      <p className="text-slate-400">Tidak ada produk ditemukan</p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-800">{product.name}</div>
                        {product.barcode && <div className="text-xs text-slate-400 font-mono mt-0.5">{product.barcode}</div>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-medium">{product.category}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-800">{formatRupiah(product.price)}</td>
                      <td className="px-5 py-3.5 text-right text-slate-600">{formatRupiah(product.cost_price)}</td>
                      <td className={`px-5 py-3.5 text-right font-semibold ${product.stock <= product.min_stock ? 'text-red-600' : 'text-slate-800'}`}>
                        {product.stock}
                        {product.stock <= product.min_stock && (
                          <span className="ml-2 text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold">Low</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => openEditModal(product)} className="px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">Edit</button>
                          <button onClick={() => openStockModal(product)} className="px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">Stok Masuk</button>
                          <button onClick={() => openDeleteModal(product)} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
            <div className="px-6 py-5 border-b border-slate-200/60">
              <h2 className="text-xl font-bold text-slate-800">{editingProduct ? 'Edit Produk' : 'Tambah Produk'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama Produk</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  placeholder="Masukkan nama produk"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Harga Jual</label>
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Harga Beli</label>
                  <input
                    type="number"
                    required
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Stok</label>
                  <input
                    type="number"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Stok Minimum</label>
                  <input
                    type="number"
                    required
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Kategori</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                >
                  <option value="">Pilih Kategori</option>
                  <option value="Makanan">Makanan</option>
                  <option value="Minuman">Minuman</option>
                  <option value="Snack">Snack</option>
                  <option value="Umum">Umum</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Barcode</label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  placeholder="Opsional"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/60">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-medium text-sm transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
            <div className="px-6 py-5 border-b border-slate-200/60">
              <h2 className="text-xl font-bold text-slate-800">Stok Masuk</h2>
              <p className="text-sm text-slate-500 mt-1">{selectedProduct.name}</p>
            </div>
            <form onSubmit={handleStockIn} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Jumlah</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={stockData.quantity}
                  onChange={(e) => setStockData({ ...stockData, quantity: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  placeholder="Masukkan jumlah stok"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Catatan</label>
                <input
                  type="text"
                  value={stockData.notes}
                  onChange={(e) => setStockData({ ...stockData, notes: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  placeholder="Opsional"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/60">
                <button type="button" onClick={() => setShowStockModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-medium text-sm transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'Memproses...' : 'Proses'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in">
            <div className="p-6">
              <div className="flex items-center justify-center w-14 h-14 bg-red-50 rounded-2xl mx-auto mb-4">
                <span className="text-3xl">🗑️</span>
              </div>
              <h2 className="text-xl font-bold text-slate-800 text-center mb-2">Hapus Produk</h2>
              <p className="text-slate-500 text-sm text-center mb-6">
                Yakin ingin menghapus <span className="font-semibold text-slate-700">{selectedProduct.name}</span>? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-medium text-sm transition-colors">
                  Batal
                </button>
                <button onClick={handleDelete} disabled={submitting} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'Menghapus...' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
