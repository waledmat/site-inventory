import { useState } from 'react';
import api from '../../utils/axiosInstance';

export default function StockAdjustment() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ adjustment: '', reason: '' });
  const [costForm, setCostForm] = useState('');
  const [costSaving, setCostSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState(null);

  // Stock transactions history
  const [txRows, setTxRows] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txFilters, setTxFilters] = useState({ type: '', date_from: '', date_to: '' });

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await api.get(`/stock/search?q=${encodeURIComponent(query)}&limit=20`);
      setResults(r.data.rows || []);
    } catch { setResults([]); }
    setSearching(false);
  }

  async function handleSelect(item) {
    setSelected(item);
    setForm({ adjustment: '', reason: '' });
    setCostForm(item.unit_cost ? String(item.unit_cost) : '');
    setMsg(null);
    setResults([]);
    setQuery('');
    fetchTransactions(item.id);
  }

  async function handleSaveCost(e) {
    e.preventDefault();
    if (!selected) return;
    const cost = parseFloat(costForm);
    if (isNaN(cost) || cost < 0) { setMsg({ type: 'error', text: 'Unit cost must be a non-negative number' }); return; }
    setCostSaving(true);
    setMsg(null);
    try {
      const r = await api.put(`/stock/${selected.id}/unit-cost`, { unit_cost: cost });
      setSelected(s => ({ ...s, unit_cost: r.data.unit_cost }));
      setMsg({ type: 'success', text: `Unit cost updated to ${cost}` });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update unit cost' });
    }
    setCostSaving(false);
  }

  async function fetchTransactions(itemId) {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({ stock_item_id: itemId, limit: 20, ...Object.fromEntries(Object.entries(txFilters).filter(([,v]) => v)) });
      const r = await api.get(`/stock/transactions?${params}`);
      setTxRows(r.data.rows || []);
    } catch { setTxRows([]); }
    setTxLoading(false);
  }

  async function handleAdjust(e) {
    e.preventDefault();
    if (!selected) return;
    const adj = parseFloat(form.adjustment);
    if (isNaN(adj) || adj === 0) { setMsg({ type: 'error', text: 'Enter a non-zero adjustment value' }); return; }
    if (!form.reason.trim()) { setMsg({ type: 'error', text: 'Reason is required' }); return; }

    setLoading(true);
    setMsg(null);
    try {
      const r = await api.post('/stock/adjust', {
        stock_item_id: selected.id,
        adjustment: adj,
        reason: form.reason,
      });
      setSelected(s => ({ ...s, qty_on_hand: r.data.new_qty }));
      setMsg({ type: 'success', text: `Adjusted by ${adj > 0 ? '+' : ''}${adj}. New qty: ${r.data.new_qty}` });
      setForm({ adjustment: '', reason: '' });
      fetchTransactions(selected.id);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Adjustment failed' });
    }
    setLoading(false);
  }

  const txTypeColor = (type) => {
    if (type === 'issue') return 'bg-red-100 text-red-700';
    if (type === 'return') return 'bg-green-100 text-green-700';
    if (type === 'adjustment') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-2xl font-bold text-gray-800">Stock Adjustment</h2>
      <p className="text-sm text-gray-500">Manually correct stock quantities. All adjustments are logged in the audit trail.</p>

      {/* Search */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold text-gray-700 mb-3">Search Stock Item</h3>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by item number or description..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" disabled={searching}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results.length > 0 && (
          <div className="mt-3 border rounded-lg divide-y max-h-60 overflow-y-auto">
            {results.map(item => (
              <button key={item.id} onClick={() => handleSelect(item)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors">
                <div className="font-medium text-sm text-gray-800">{item.item_number} — {item.description_1}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.project_name} · On Hand: <span className="font-semibold">{item.qty_on_hand}</span> {item.uom}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Adjustment form */}
      {selected && (
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">{selected.item_number} — {selected.description_1}</h3>
              <p className="text-sm text-gray-500">{selected.project_name}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-3 text-sm">
            <div><div className="text-xs text-gray-500">On Hand</div><div className="font-bold text-lg text-gray-800">{selected.qty_on_hand}</div></div>
            <div><div className="text-xs text-gray-500">Issued</div><div className="font-semibold text-gray-600">{selected.qty_issued}</div></div>
            <div><div className="text-xs text-gray-500">UOM</div><div className="font-semibold text-gray-600">{selected.uom}</div></div>
            <div>
              <div className="text-xs text-gray-500">Unit Cost</div>
              <div className="font-semibold text-gray-800">{Number(selected.unit_cost || 0).toFixed(2)}</div>
              <div className="text-[10px] text-gray-400">On-hand value: {(Number(selected.qty_on_hand) * Number(selected.unit_cost || 0)).toFixed(2)}</div>
            </div>
          </div>

          <form onSubmit={handleSaveCost} className="flex flex-wrap items-end gap-2 border-t pt-4">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost</label>
              <input
                type="number"
                step="any"
                min="0"
                value={costForm}
                onChange={e => setCostForm(e.target.value)}
                placeholder="e.g. 12.50"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button type="submit" disabled={costSaving}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {costSaving ? 'Saving…' : 'Update Unit Cost'}
            </button>
          </form>

          {msg && (
            <div className={`px-4 py-3 rounded-lg text-sm font-medium ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleAdjust} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adjustment Quantity <span className="text-gray-400 font-normal">(use negative to deduct, e.g. -5)</span>
              </label>
              <input
                type="number"
                step="any"
                value={form.adjustment}
                onChange={e => setForm(f => ({ ...f, adjustment: e.target.value }))}
                placeholder="e.g. +10 or -3"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              {form.adjustment && !isNaN(parseFloat(form.adjustment)) && (
                <p className="text-xs text-gray-500 mt-1">
                  New qty will be: <span className="font-semibold">{parseFloat(selected.qty_on_hand) + parseFloat(form.adjustment)}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Notes <span className="text-red-500">*</span></label>
              <textarea
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Cycle count correction, damaged goods write-off..."
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button type="submit" disabled={loading}
              className="bg-yellow-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-600 disabled:opacity-50">
              {loading ? 'Adjusting…' : 'Apply Adjustment'}
            </button>
          </form>
        </div>
      )}

      {/* Transaction history */}
      {selected && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Transaction History</h3>
          {txLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : txRows.length === 0 ? (
            <p className="text-sm text-gray-400">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="pb-2 text-left">Date</th>
                    <th className="pb-2 text-left">Type</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-left">Reference</th>
                    <th className="pb-2 text-left">User</th>
                    <th className="pb-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {txRows.map(tx => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-500 text-xs">{new Date(tx.created_at).toLocaleString()}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${txTypeColor(tx.transaction_type)}`}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className={`py-2 text-right font-semibold ${tx.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                      </td>
                      <td className="py-2 text-gray-600 text-xs">{tx.reference_id || '—'}</td>
                      <td className="py-2 text-gray-600 text-xs">{tx.user_name || '—'}</td>
                      <td className="py-2 text-gray-400 text-xs">{tx.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
