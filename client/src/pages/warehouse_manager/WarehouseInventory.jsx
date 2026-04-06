import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';

const CATEGORY_COLORS = {
  CH: 'bg-blue-100 text-blue-700',
  DC: 'bg-purple-100 text-purple-700',
  SPARE: 'bg-orange-100 text-orange-700',
  GENERAL: 'bg-gray-100 text-gray-700',
};

export default function WarehouseInventory() {
  const toast = useToast();
  const [stock, setStock] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [binStock, setBinStock] = useState([]);
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ bin_id: '', qty_adjustment: '', notes: '' });
  const [adjustError, setAdjustError] = useState('');
  const [allBins, setAllBins] = useState([]);

  const load = (q = search, cat = category, ls = lowStock) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (cat) params.set('category', cat);
    if (ls) params.set('low_stock', 'true');
    api.get(`/wms/inventory?${params}`).then(r => setStock(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [search, category, lowStock]);

  const viewBins = async item => {
    setSelectedItem(item);
    const { data } = await api.get(`/wms/inventory/${item.item_master_id}/bins`);
    setBinStock(data);
  };

  const openAdjust = async () => {
    // Load all bins for the dropdown
    const { data: zones } = await api.get('/wms/locations/zones');
    // Get bins for all zones — simplified: just show bins from existing stock
    setAllBins(binStock);
    setAdjustForm({ bin_id: binStock[0]?.bin_id || '', qty_adjustment: '', notes: '' });
    setAdjustError('');
    setAdjustModal(selectedItem);
  };

  const submitAdjust = async e => {
    e.preventDefault(); setAdjustError('');
    try {
      await api.post('/wms/inventory/adjust', {
        bin_id: adjustForm.bin_id,
        item_master_id: adjustModal.item_master_id,
        qty_adjustment: parseFloat(adjustForm.qty_adjustment),
        notes: adjustForm.notes,
      });
      toast('Stock adjusted successfully', 'success');
      setAdjustModal(null);
      load();
      // Refresh bin stock if item detail is open
      if (selectedItem) viewBins(selectedItem);
    } catch (err) { setAdjustError(err.response?.data?.error || 'Error adjusting'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Warehouse Inventory</h2>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Search items…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Categories</option>
          <option value="CH">CH</option>
          <option value="DC">DC</option>
          <option value="SPARE">SPARE</option>
          <option value="GENERAL">GENERAL</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)}
            className="rounded" />
          Low Stock Only
        </label>
        <span className="ml-auto text-sm text-gray-400">{stock.length} items</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock List */}
        <div className="bg-white border rounded-xl overflow-hidden">
          {loading ? (
            <p className="p-8 text-center text-gray-400">Loading…</p>
          ) : stock.length === 0 ? (
            <EmptyState icon="box" title="No stock found" message="Complete putaway tasks to add stock to the warehouse." />
          ) : (
            <div className="divide-y overflow-y-auto max-h-[600px]">
              {stock.map(item => {
                const isLow = item.reorder_point > 0 && item.total_qty_available <= item.reorder_point;
                return (
                  <button key={item.item_master_id}
                    onClick={() => viewBins(item)}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${selectedItem?.item_master_id === item.item_master_id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-500">{item.item_number}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-600'}`}>
                          {item.category}
                        </span>
                        {isLow && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Low</span>}
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{item.total_qty_available} {item.uom}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 truncate">{item.description_1}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      On hand: {item.total_qty_on_hand} · Reserved: {item.total_qty_reserved} · {item.bin_count} bin(s)
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bin Detail */}
        <div className="bg-white border rounded-xl">
          {!selectedItem ? (
            <div className="p-12 text-center text-gray-400">
              <p className="text-3xl mb-2">📦</p>
              <p>Select an item to view bin locations</p>
            </div>
          ) : (
            <div>
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{selectedItem.item_number}</p>
                  <p className="text-sm text-gray-500 truncate">{selectedItem.description_1}</p>
                </div>
                <button onClick={openAdjust}
                  className="text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200 px-3 py-1.5 rounded-lg font-medium">
                  Adjust Stock
                </button>
              </div>
              {binStock.length === 0 ? (
                <p className="p-6 text-center text-gray-400 text-sm">No bin stock records yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs text-gray-500">Bin</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500">On Hand</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500">Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {binStock.map(bs => (
                      <tr key={bs.id} className="border-b last:border-0">
                        <td className="px-4 py-2 font-mono text-sm text-blue-700">{bs.full_code}</td>
                        <td className="px-4 py-2 text-right">{bs.qty_on_hand}</td>
                        <td className="px-4 py-2 text-right text-green-600 font-medium">{bs.qty_available}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Adjust Modal */}
      <Modal isOpen={!!adjustModal} onClose={() => setAdjustModal(null)} title="Stock Adjustment">
        {adjustModal && (
          <form onSubmit={submitAdjust} className="space-y-4">
            <p className="text-sm text-gray-600">
              Adjusting stock for <strong>{adjustModal.item_number}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bin *</label>
              <select value={adjustForm.bin_id} required onChange={e => setAdjustForm(f => ({ ...f, bin_id: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select bin…</option>
                {allBins.map(b => <option key={b.bin_id} value={b.bin_id}>{b.full_code} (current: {b.qty_on_hand})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Adjustment *</label>
              <input type="number" step="any" required value={adjustForm.qty_adjustment}
                onChange={e => setAdjustForm(f => ({ ...f, qty_adjustment: e.target.value }))}
                placeholder="e.g. +10 or -5"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">Use positive to add, negative to remove</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
              <input type="text" required value={adjustForm.notes}
                onChange={e => setAdjustForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Physical count variance"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {adjustError && <p className="text-red-500 text-sm">{adjustError}</p>}
            <div className="flex gap-3">
              <button type="submit" className="flex-1 bg-yellow-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-yellow-600">
                Apply Adjustment
              </button>
              <button type="button" onClick={() => setAdjustModal(null)}
                className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
