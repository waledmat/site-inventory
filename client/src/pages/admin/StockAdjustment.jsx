import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';

export default function StockAdjustment() {
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
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

  // Pending adjustment requests from superuser
  const [pendingReqs, setPendingReqs] = useState([]);
  const [reviewingId, setReviewingId] = useState(null);

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
    loadPendingRequests();
  }, []);

  const loadPendingRequests = () => {
    api.get('/stock/adjustment-requests?status=pending').then(r => setPendingReqs(r.data)).catch(() => {});
  };

  async function approveRequest(id) {
    setReviewingId(id);
    try {
      await api.post(`/stock/adjustment-requests/${id}/approve`, {});
      loadPendingRequests();
      if (selected) fetchTransactions(selected.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve request');
    }
    setReviewingId(null);
  }

  async function rejectRequest(id) {
    const notes = window.prompt('Reject reason (optional):', '');
    if (notes === null) return;
    setReviewingId(id);
    try {
      await api.post(`/stock/adjustment-requests/${id}/reject`, { review_notes: notes.trim() || null });
      loadPendingRequests();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject request');
    }
    setReviewingId(null);
  }

  async function runSearch({ q, project_id }) {
    if (!q && !project_id) { setResults([]); return; }
    setSearching(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (q) params.set('q', q);
      if (project_id) params.set('project_id', project_id);
      const r = await api.get(`/stock/search?${params}`);
      setResults(r.data.rows || []);
    } catch { setResults([]); }
    setSearching(false);
  }

  async function handleSearch(e) {
    e.preventDefault();
    runSearch({ q: query.trim(), project_id: projectId });
  }

  function handleProjectChange(id) {
    setProjectId(id);
    if (id) runSearch({ q: query.trim(), project_id: id });
    else if (query.trim()) runSearch({ q: query.trim() });
    else setResults([]);
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
        <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
          <select value={projectId} onChange={e => handleProjectChange(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={projectId ? 'Filter by item number or description… (or leave blank to browse project)' : 'Search by item number or description…'}
            className="flex-1 min-w-[220px] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" disabled={searching || (!query.trim() && !projectId)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {results.length > 0 && (
          <div className="mt-3 border rounded-lg divide-y max-h-72 overflow-y-auto">
            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 sticky top-0">{results.length} item{results.length === 1 ? '' : 's'}</div>
            {results.map(item => (
              <button key={item.id} onClick={() => handleSelect(item)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors">
                <div className="font-medium text-sm text-gray-800">{item.item_number} — {item.description_1}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.project_name} · {item.category || '—'} · On Hand: <span className="font-semibold">{item.qty_on_hand}</span> {item.uom}</div>
              </button>
            ))}
          </div>
        )}
        {!searching && results.length === 0 && (query || projectId) && (
          <p className="mt-3 text-sm text-gray-400 text-center py-4">No stock items found.</p>
        )}
      </div>

      {/* Pending adjustment requests from superuser */}
      {pendingReqs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-amber-900">⏳ Pending Adjustment Requests ({pendingReqs.length})</h3>
            <button onClick={loadPendingRequests} className="text-xs text-amber-700 hover:underline">Refresh</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-amber-800 border-b border-amber-200">
                <tr>
                  <th className="pb-2 text-left">No.</th>
                  <th className="pb-2 text-left">Date</th>
                  <th className="pb-2 text-left">Requested By</th>
                  <th className="pb-2 text-left">Project</th>
                  <th className="pb-2 text-left">Item</th>
                  <th className="pb-2 text-right">Current Qty</th>
                  <th className="pb-2 text-right">Adjustment</th>
                  <th className="pb-2 text-right">After</th>
                  <th className="pb-2 text-left">Reason</th>
                  <th className="pb-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200">
                {pendingReqs.map(r => {
                  const after = Number(r.qty_on_hand) + Number(r.adjustment);
                  const negative = after < 0;
                  return (
                    <tr key={r.id} className="hover:bg-amber-100/40">
                      <td className="py-2 text-xs font-mono text-blue-700">{r.adjustment_no || '—'}</td>
                      <td className="py-2 text-xs text-gray-600">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="py-2 text-xs">
                        <div className="font-medium">{r.requested_by_name}</div>
                        <div className="text-gray-500">{r.requested_by_employee_id}</div>
                      </td>
                      <td className="py-2 text-xs text-gray-700">{r.project_name || '—'}</td>
                      <td className="py-2 text-xs">
                        <div className="font-mono">{r.item_number || '—'}</div>
                        <div className="text-gray-500">{r.description_1}</div>
                      </td>
                      <td className="py-2 text-right text-xs">{r.qty_on_hand} {r.uom}</td>
                      <td className={`py-2 text-right font-semibold ${Number(r.adjustment) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {Number(r.adjustment) > 0 ? '+' : ''}{Number(r.adjustment)}
                      </td>
                      <td className={`py-2 text-right font-semibold ${negative ? 'text-red-700' : 'text-gray-800'}`}>
                        {after}{negative && ' ⚠'}
                      </td>
                      <td className="py-2 text-xs text-gray-700 max-w-[260px]">{r.reason}</td>
                      <td className="py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => approveRequest(r.id)} disabled={reviewingId === r.id || negative}
                            title={negative ? 'Would result in negative stock' : 'Approve and apply adjustment'}
                            className="bg-green-600 text-white px-2.5 py-1 rounded text-xs font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">
                            ✓ Approve
                          </button>
                          <button onClick={() => rejectRequest(r.id)} disabled={reviewingId === r.id}
                            className="bg-red-600 text-white px-2.5 py-1 rounded text-xs font-medium hover:bg-red-700 disabled:opacity-40">
                            ✕ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
