import { useEffect, useState, useRef } from 'react';
import api from '../../utils/axiosInstance';
import { useNavigate } from 'react-router-dom';

export default function SubmitRequest() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [stockResults, setStockResults] = useState([]);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { api.get('/projects').then(r => setProjects(r.data)); }, []);

  const searchStock = async (q) => {
    setSearchQ(q);
    if (!q || q.length < 2 || !projectId) { setStockResults([]); return; }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q, project_id: projectId });
      const { data } = await api.get(`/stock/search?${params}`);
      setStockResults(data.rows ?? data);
    } finally { setSearching(false); }
  };

  const addItem = (stock) => {
    const existing = items.findIndex(i => i.stock_item_id === stock.id);
    if (existing >= 0) {
      const updated = [...items];
      updated[existing].quantity_requested += 1;
      setItems(updated);
    } else {
      setItems(prev => [...prev, {
        stock_item_id: stock.id,
        item_number: stock.item_number || '',
        description_1: stock.description_1,
        uom: stock.uom,
        qty_on_hand: stock.qty_on_hand,
        quantity_requested: 1,
      }]);
    }
    setSearchQ('');
    setStockResults([]);
    searchRef.current?.focus();
  };

  const updateQty = (idx, val) => {
    const updated = [...items];
    updated[idx].quantity_requested = val;
    setItems(updated);
  };

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await api.post('/requests', { project_id: projectId, items, notes });
      navigate('/requester/requests');
    } catch (err) { setError(err.response?.data?.error || 'Failed to submit'); }
    finally { setLoading(false); }
  };

  const selectedProject = projects.find(p => p.id === projectId);

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Submit Material Request</h2>
      <form onSubmit={submit} className="space-y-5">

        {/* Project */}
        <div className="bg-white rounded-xl border p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
          <select required value={projectId} onChange={e => { setProjectId(e.target.value); setItems([]); setStockResults([]); setSearchQ(''); }}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Select project…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_number ? `[${p.project_number}] ` : ''}{p.name}</option>)}
          </select>
        </div>

        {/* Search */}
        {projectId && (
          <div className="bg-white rounded-xl border p-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Items</label>
            <div className="relative">
              <input
                ref={searchRef}
                value={searchQ}
                onChange={e => searchStock(e.target.value)}
                placeholder="Type item number or description…"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searching && <span className="absolute right-3 top-2.5 text-xs text-gray-400">Searching…</span>}
              {stockResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {stockResults.map(s => (
                    <div key={s.id} onClick={() => addItem(s)}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-medium text-sm">{s.description_1}</span>
                          {s.description_2 && <span className="text-xs text-gray-500 ml-2">{s.description_2}</span>}
                          <div className="text-xs text-gray-500 mt-0.5">{s.item_number} · {s.uom}</div>
                        </div>
                        <span className={`text-xs font-semibold ml-4 whitespace-nowrap ${s.qty_on_hand > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          On Hand: {s.qty_on_hand}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {searchQ.length >= 2 && !searching && stockResults.length === 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-xl shadow px-4 py-3 text-sm text-gray-500">
                  No items found in {selectedProject?.name}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Items list */}
        {items.length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-700 mb-3">Request Items ({items.length})</h3>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 border rounded-lg px-3 py-2.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.description_1}</div>
                    <div className="text-xs text-gray-500">{item.item_number} · {item.uom} · <span className={item.qty_on_hand > 0 ? 'text-green-600' : 'text-red-500'}>On Hand: {item.qty_on_hand}</span></div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-xs text-gray-500">Qty</label>
                    <input type="number" min="0.001" step="any" value={item.quantity_requested} required
                      onChange={e => updateQty(idx, parseFloat(e.target.value))}
                      className="w-20 border rounded-lg px-2 py-1 text-sm text-center" />
                  </div>
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">&times;</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-xl border p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Any additional notes…" />
        </div>

        {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <button type="submit" disabled={loading || !projectId || !items.length}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Submitting…' : `Submit Request${items.length ? ` (${items.length} item${items.length > 1 ? 's' : ''})` : ''}`}
        </button>
      </form>
    </div>
  );
}
