import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';

const STATUS_BADGE = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function StockAdjustmentRequest() {
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ adjustment: '', reason: '' });
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
    loadRequests();
  }, []);

  const loadRequests = () => {
    api.get('/stock/adjustment-requests?status=all').then(r => setRequests(r.data)).catch(() => {});
  };

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

  function handleProjectChange(id) {
    setProjectId(id);
    if (id || query.trim()) runSearch({ q: query.trim(), project_id: id });
    else setResults([]);
  }

  function handleSelect(item) {
    setSelected(item);
    setForm({ adjustment: '', reason: '' });
    setMsg(null);
    setResults([]);
    setQuery('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selected) return;
    const adj = parseFloat(form.adjustment);
    if (isNaN(adj) || adj === 0) { setMsg({ type: 'error', text: 'Enter a non-zero adjustment value' }); return; }
    if (!form.reason.trim()) { setMsg({ type: 'error', text: 'Reason is required for an adjustment request' }); return; }

    setSubmitting(true); setMsg(null);
    try {
      const { data } = await api.post('/stock/adjustment-requests', {
        stock_item_id: selected.id,
        adjustment: adj,
        reason: form.reason.trim(),
      });
      setMsg({ type: 'success', text: `Request ${data.adjustment_no} submitted (${adj > 0 ? '+' : ''}${adj}). Awaiting admin approval.` });
      setForm({ adjustment: '', reason: '' });
      setSelected(null);
      loadRequests();
    } catch (err) {
      const status = err.response?.status;
      let text = err.response?.data?.error || 'Failed to submit request';
      if (status === 403) text = 'Your session looks stale. Please log out and log back in, then try again.';
      setMsg({ type: 'error', text });
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Stock Adjustment Request</h2>
        <p className="text-sm text-gray-500 mt-1">
          Submit a stock-quantity correction for admin approval. Quantity won’t change until an admin approves.
          A reason is required.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold text-gray-700 mb-3">Find Stock Item</h3>
        <form onSubmit={(e) => { e.preventDefault(); runSearch({ q: query.trim(), project_id: projectId }); }}
          className="flex flex-wrap gap-2">
          <select value={projectId} onChange={e => handleProjectChange(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder={projectId ? 'Filter by item number or description… (or leave blank to browse project)' : 'Search by item number or description…'}
            className="flex-1 min-w-[220px] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
      </div>

      {/* Request form */}
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
            <div><div className="text-xs text-gray-500">Unit Cost</div><div className="font-semibold text-gray-800">{Number(selected.unit_cost || 0).toFixed(2)}</div></div>
          </div>

          {msg && (
            <div className={`px-4 py-3 rounded-lg text-sm font-medium ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adjustment Quantity <span className="text-gray-400 font-normal">(use negative to deduct, e.g. -5)</span>
              </label>
              <input type="number" step="any" value={form.adjustment}
                onChange={e => setForm(f => ({ ...f, adjustment: e.target.value }))}
                placeholder="e.g. +10 or -3"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required />
              {form.adjustment && !isNaN(parseFloat(form.adjustment)) && (
                <p className="text-xs text-gray-500 mt-1">
                  If approved, qty will become: <span className="font-semibold">{parseFloat(selected.qty_on_hand) + parseFloat(form.adjustment)}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Justification <span className="text-red-500">*</span></label>
              <textarea value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Why is this adjustment needed? (cycle count variance, damaged goods, lost in transit, etc.)"
                rows={3} required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="submit" disabled={submitting}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Submitting…' : '📤 Submit Request to Admin'}
            </button>
          </form>
        </div>
      )}

      {msg && !selected && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* My requests */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold text-gray-700 mb-3">Recent Adjustment Requests</h3>
        {requests.length === 0 ? (
          <p className="text-sm text-gray-400">No requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="pb-2 text-left">No.</th>
                  <th className="pb-2 text-left">Date</th>
                  <th className="pb-2 text-left">Project</th>
                  <th className="pb-2 text-left">Item</th>
                  <th className="pb-2 text-right">Adjustment</th>
                  <th className="pb-2 text-left">Reason</th>
                  <th className="pb-2 text-left">Status</th>
                  <th className="pb-2 text-left">Reviewed By</th>
                  <th className="pb-2 text-left">Review Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-2 text-xs font-mono text-blue-700">{r.adjustment_no || '—'}</td>
                    <td className="py-2 text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 text-xs text-gray-700">{r.project_name || '—'}</td>
                    <td className="py-2 text-xs">
                      <div className="font-mono">{r.item_number || '—'}</div>
                      <div className="text-gray-500">{r.description_1}</div>
                    </td>
                    <td className={`py-2 text-right font-semibold ${Number(r.adjustment) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(r.adjustment) > 0 ? '+' : ''}{Number(r.adjustment)}
                    </td>
                    <td className="py-2 text-xs text-gray-600 max-w-[260px]">{r.reason}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-600">{r.reviewed_by_name || '—'}</td>
                    <td className="py-2 text-xs text-gray-500 max-w-[200px]">{r.review_notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
