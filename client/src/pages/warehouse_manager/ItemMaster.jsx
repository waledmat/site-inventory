import { useEffect, useRef, useState } from 'react';
import api from '../../utils/axiosInstance';
import { useToast } from '../../context/ToastContext';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import QRCodeDisplay from '../../components/common/QRCodeDisplay';
import QRScanner from '../../components/common/QRScanner';
import LabelPrintActions from '../../components/common/LabelPrintActions';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = ['CH', 'DC', 'SPARE', 'GENERAL'];
const empty = { item_number: '', description_1: '', description_2: '', category: 'GENERAL', uom: 'EA', reorder_point: 0, min_stock_level: 0 };

export default function ItemMaster() {
  const toast = useToast();
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [labelItem, setLabelItem] = useState(null);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const debounce = useRef(null);
  const qrRef = useRef(null);

  const load = (q = '', cat = '') => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (cat) params.set('category', cat);
    api.get(`/wms/items?${params}`).then(r => { setItems(r.data); setLoadError(''); }).catch(() => setLoadError('Failed to load items'));
  };

  useEffect(() => { load(); }, []);

  const handleSearch = val => {
    setSearch(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(val, category), 350);
  };

  const handleCategory = val => {
    setCategory(val);
    load(search, val);
  };

  const openCreate = () => { setEditing(null); setForm(empty); setModal(true); setError(''); };
  const openEdit = item => { setEditing(item.id); setForm(item); setModal(true); setError(''); };

  const save = async e => {
    e.preventDefault(); setError('');
    try {
      if (editing) await api.put(`/wms/items/${editing}`, form);
      else await api.post('/wms/items', form);
      setModal(false);
      toast(editing ? 'Item updated' : 'Item created', 'success');
      load(search, category);
    } catch (err) { setError(err.response?.data?.error || 'Error saving item'); }
  };

  const handleScan = (text) => {
    if (text.startsWith('ITEM:')) {
      const itemNumber = text.replace('ITEM:', '');
      setSearch(itemNumber);
      load(itemNumber, category);
    }
  };

  const cols = [
    { key: 'item_number', header: 'Item Number' },
    { key: 'description_1', header: 'Description' },
    { key: 'description_2', header: 'Description 2' },
    { key: 'category', header: 'Category', render: v => <Badge value={v} /> },
    { key: 'uom', header: 'UOM' },
    { key: 'reorder_point', header: 'Reorder Pt.' },
    { key: 'is_active', header: 'Status', render: v => <Badge value={v ? 'active' : 'inactive'} label={v ? 'Active' : 'Inactive'} /> },
    {
      key: 'id', header: 'Actions',
      render: (id, row) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(row)} className="text-xs text-blue-600 hover:underline">Edit</button>
          <button onClick={() => setLabelItem(row)} className="text-xs text-purple-600 hover:underline">QR Label</button>
        </div>
      )
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Item Master</h2>
        <div className="flex gap-2">
          <button onClick={() => setScanOpen(true)}
            className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5A2.5 2.5 0 0116.5 18h-9A2.5 2.5 0 015 15.5v-9A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5" />
            </svg>
            Scan
          </button>
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Add Item</button>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 mb-5 flex flex-wrap gap-3">
        <input value={search} onChange={e => handleSearch(e.target.value)}
          placeholder="Search by item number or description…"
          className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm" />
        <select value={category} onChange={e => handleCategory(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loadError && <p className="text-red-500 text-sm mb-2">{loadError}</p>}
      <p className="text-xs text-gray-500 mb-2">{items.length} items</p>
      <Table columns={cols} data={items} />

      {/* QR Label Modal */}
      <Modal isOpen={!!labelItem} onClose={() => setLabelItem(null)} title={`Item Label — ${labelItem?.item_number}`}>
        {labelItem && (
          <div className="flex flex-col items-center gap-4">
            <QRCodeDisplay ref={qrRef} value={`ITEM:${labelItem.item_number}`} size={200} />
            <div className="text-center">
              <p className="text-2xl font-mono font-bold text-gray-800">{labelItem.item_number}</p>
              <p className="text-sm text-gray-600 mt-1">{labelItem.description_1}</p>
              {labelItem.description_2 && <p className="text-xs text-gray-400">{labelItem.description_2}</p>}
              <p className="text-xs text-gray-500 mt-1">{labelItem.category} · {labelItem.uom}</p>
            </div>
            <LabelPrintActions
              type="item"
              data={labelItem}
              qrRef={qrRef}
              pdfUrl={`/api/wms/items/${labelItem.id}/label?token=${token}`}
            />
          </div>
        )}
      </Modal>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Item' : 'Add Item'}>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Number *</label>
            <input value={form.item_number || ''} required disabled={!!editing}
              onChange={e => setForm(p => ({ ...p, item_number: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description 1 *</label>
            <input value={form.description_1 || ''} required
              onChange={e => setForm(p => ({ ...p, description_1: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description 2</label>
            <input value={form.description_2 || ''}
              onChange={e => setForm(p => ({ ...p, description_2: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={form.category || 'GENERAL'}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UOM *</label>
              <input value={form.uom || ''} required
                onChange={e => setForm(p => ({ ...p, uom: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Point</label>
              <input type="number" min="0" value={form.reorder_point ?? 0}
                onChange={e => setForm(p => ({ ...p, reorder_point: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Level</label>
              <input type="number" min="0" value={form.min_stock_level ?? 0}
                onChange={e => setForm(p => ({ ...p, min_stock_level: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Save</button>
            <button type="button" onClick={() => setModal(false)} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* QR Scanner — auto-searches for scanned item */}
      <QRScanner isOpen={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />
    </div>
  );
}
