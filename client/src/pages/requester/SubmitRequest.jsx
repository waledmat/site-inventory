import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../utils/axiosInstance';
import { useNavigate } from 'react-router-dom';

const CATEGORY_COLORS = {
  CH: 'bg-blue-100 text-blue-700',
  DC: 'bg-purple-100 text-purple-700',
  SPARE: 'bg-orange-100 text-orange-700',
};

export default function SubmitRequest() {
  const [projects, setProjects]     = useState([]);
  const [projectId, setProjectId]   = useState('');
  const [q, setQ]                   = useState('');
  const [stockRows, setStockRows]   = useState([]);
  const [stockTotal, setStockTotal] = useState(0);
  const [stockPage, setStockPage]   = useState(1);
  const [loadingStock, setLoadingStock] = useState(false);
  const limit = 30;

  // inline qty input per row
  const [activeRowId, setActiveRowId] = useState(null);
  const [activeQty, setActiveQty]     = useState('1');

  // request items cart
  const [items, setItems]   = useState([]);
  const [notes, setNotes]   = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const searchRef = useRef(null);

  useEffect(() => { api.get('/projects').then(r => setProjects(r.data)); }, []);

  const fetchStock = useCallback(async (pid, query, pg) => {
    if (!pid) { setStockRows([]); setStockTotal(0); return; }
    setLoadingStock(true);
    try {
      const params = new URLSearchParams({ project_id: pid, page: pg, limit });
      if (query.length >= 2) params.set('q', query);
      const { data } = await api.get(`/stock/search?${params}`);
      const rows = (data.rows || []).filter(s => parseFloat(s.qty_on_hand) > 0);
      setStockRows(rows);
      setStockTotal(data.total || 0);
    } catch { setStockRows([]); setStockTotal(0); }
    setLoadingStock(false);
  }, []);

  // fetch when project / search / page changes
  useEffect(() => {
    if (q.length > 0 && q.length < 2) return;
    const t = setTimeout(() => { setStockPage(1); fetchStock(projectId, q, 1); }, 300);
    return () => clearTimeout(t);
  }, [projectId, q, fetchStock]);

  useEffect(() => {
    if (projectId) fetchStock(projectId, q, stockPage);
  }, [stockPage]); // eslint-disable-line

  const handleProjectChange = (pid) => {
    setProjectId(pid);
    setStockPage(1);
    setStockRows([]);
    setItems([]);
    setActiveRowId(null);
    setQ('');
  };

  // --- inline add ---
  const cartMap = Object.fromEntries(items.map(i => [i.stock_item_id, i]));

  const openInline = (row) => {
    const existing = cartMap[row.id];
    setActiveRowId(row.id);
    setActiveQty(existing ? String(existing.quantity_requested) : '1');
  };

  const cancelInline = () => { setActiveRowId(null); setActiveQty('1'); };

  const confirmAdd = (row) => {
    const qty = parseFloat(activeQty);
    if (isNaN(qty) || qty <= 0) return;
    setItems(prev => {
      const idx = prev.findIndex(i => i.stock_item_id === row.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity_requested: qty };
        return updated;
      }
      return [...prev, {
        stock_item_id: row.id,
        item_number: row.item_number || '',
        description_1: row.description_1,
        uom: row.uom,
        qty_on_hand: parseFloat(row.qty_on_hand),
        quantity_requested: qty,
      }];
    });
    setActiveRowId(null);
    setActiveQty('1');
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
  const totalPages = Math.ceil(stockTotal / limit);

  return (
    <div className="max-w-4xl space-y-5 pb-10">
      <h2 className="text-2xl font-bold text-gray-800">Submit Material Request</h2>

      <form onSubmit={submit} className="space-y-5">

        {/* Project */}
        <div className="bg-white rounded-xl border p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
          <select required value={projectId}
            onChange={e => handleProjectChange(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Select project…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.project_number ? `[${p.project_number}] ` : ''}{p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Browse available stock */}
        {projectId && (
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-700">Available Stock — {selectedProject?.name}</h3>
              <input
                ref={searchRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search item number or description…"
                className="w-64 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">Item No.</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-center">On Hand</th>
                    <th className="px-4 py-3 text-center">UOM</th>
                    <th className="px-4 py-3 text-center">Add</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loadingStock && (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>
                  )}
                  {!loadingStock && stockRows.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">No available items found</td></tr>
                  )}
                  {stockRows.map(row => {
                    const inCart  = !!cartMap[row.id];
                    const isActive = activeRowId === row.id;
                    return (
                      <tr key={row.id} className={`transition-colors ${inCart ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.item_number || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{row.description_1}</div>
                          {row.description_2 && <div className="text-xs text-gray-400 mt-0.5">{row.description_2}</div>}
                        </td>
                        <td className="px-4 py-3">
                          {row.category
                            ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[row.category] || 'bg-gray-100 text-gray-600'}`}>{row.category}</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-green-600">{parseFloat(row.qty_on_hand)}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">{row.uom}</td>
                        <td className="px-4 py-3 text-center">
                          {isActive ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number" min="0.001" step="any" autoFocus
                                value={activeQty}
                                onChange={e => setActiveQty(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') confirmAdd(row); if (e.key === 'Escape') cancelInline(); }}
                                className="w-20 border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button type="button" onClick={() => confirmAdd(row)}
                                className="bg-blue-600 text-white px-2 py-1 rounded-lg text-xs font-medium hover:bg-blue-700">✓</button>
                              <button type="button" onClick={cancelInline}
                                className="text-gray-400 hover:text-gray-600 px-1 text-sm">✕</button>
                            </div>
                          ) : inCart ? (
                            <button type="button" onClick={() => openInline(row)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200">
                              ✓ Added <span className="text-green-500">· edit</span>
                            </button>
                          ) : (
                            <button type="button" onClick={() => openInline(row)}
                              className="px-3 py-1 rounded-lg text-xs font-medium border border-blue-300 text-blue-600 hover:bg-blue-50">
                              + Add
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm pt-1">
                <button type="button" onClick={() => setStockPage(p => Math.max(1, p - 1))} disabled={stockPage === 1}
                  className="px-4 py-2 border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
                <span className="text-gray-500">Page {stockPage} of {totalPages}</span>
                <button type="button" onClick={() => setStockPage(p => Math.min(totalPages, p + 1))} disabled={stockPage === totalPages}
                  className="px-4 py-2 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
              </div>
            )}
          </div>
        )}

        {/* Request items */}
        {items.length > 0 && (
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-700 mb-3">Request Items ({items.length})</h3>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 text-sm ${item.quantity_requested > item.qty_on_hand ? 'border-yellow-300 bg-yellow-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{item.description_1}</span>
                      {item.quantity_requested > item.qty_on_hand && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-300 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                          ⚠ Exceeds Stock
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.item_number} · {item.uom}</div>
                  </div>
                  <div className="shrink-0 text-center">
                    <div className="text-sm font-bold text-green-600">{item.qty_on_hand}</div>
                    <div className="text-xs text-gray-400">On Hand</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-xs text-gray-500">Qty</label>
                    <input type="number" min="0.001" step="any" value={item.quantity_requested} required
                      onChange={e => updateQty(idx, parseFloat(e.target.value))}
                      className="w-20 border rounded-lg px-2 py-1 text-sm text-center" />
                  </div>
                  <button type="button" onClick={() => removeItem(idx)}
                    className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">&times;</button>
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
