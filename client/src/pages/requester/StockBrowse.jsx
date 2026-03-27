import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axiosInstance';

const CATEGORY_COLORS = {
  CH: 'bg-blue-100 text-blue-700',
  DC: 'bg-purple-100 text-purple-700',
  SPARE: 'bg-orange-100 text-orange-700',
};

export default function StockBrowse() {
  const navigate = useNavigate();

  // Filters
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');

  // Results
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 30;

  // Cart
  const [cart, setCart] = useState([]);
  const [activeRowId, setActiveRowId] = useState(null);
  const [activeQty, setActiveQty] = useState('1');

  // Submit modal
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  const fetchStock = useCallback(async (pId, cat, query, pg) => {
    if (!pId) { setRows([]); setTotal(0); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ project_id: pId, page: pg, limit });
      if (cat) params.set('category', cat);
      if (query.length >= 2) params.set('q', query);
      const { data } = await api.get(`/stock/search?${params}`);
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch { setRows([]); setTotal(0); }
    setLoading(false);
  }, []);

  // Re-fetch on filter change (debounced for search)
  useEffect(() => {
    if (q.length > 0 && q.length < 2) return;
    const delay = setTimeout(() => {
      setPage(1);
      fetchStock(projectId, category, q, 1);
    }, 300);
    return () => clearTimeout(delay);
  }, [projectId, category, q, fetchStock]);

  // Re-fetch on page change
  useEffect(() => {
    if (projectId) fetchStock(projectId, category, q, page);
  }, [page]); // eslint-disable-line

  const handleProjectChange = (pid) => {
    setProjectId(pid);
    setPage(1);
    setRows([]);
    setCart([]);
    setActiveRowId(null);
  };

  // --- Cart helpers ---
  const cartMap = Object.fromEntries(cart.map(i => [i.stock_item_id, i]));

  const openInline = (item) => {
    const existing = cartMap[item.id];
    setActiveRowId(item.id);
    setActiveQty(existing ? String(existing.quantity_requested) : '1');
  };

  const cancelInline = () => { setActiveRowId(null); setActiveQty('1'); };

  const confirmAdd = (item) => {
    const qty = parseFloat(activeQty);
    if (isNaN(qty) || qty <= 0) return;
    setCart(prev => {
      const idx = prev.findIndex(i => i.stock_item_id === item.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity_requested: qty };
        return updated;
      }
      return [...prev, {
        stock_item_id: item.id,
        description_1: item.description_1,
        item_number: item.item_number,
        uom: item.uom,
        qty_on_hand: item.qty_on_hand,
        quantity_requested: qty,
      }];
    });
    setActiveRowId(null);
    setActiveQty('1');
  };

  const removeFromCart = (stockItemId) => {
    setCart(prev => prev.filter(i => i.stock_item_id !== stockItemId));
  };

  const updateCartQty = (stockItemId, val) => {
    setCart(prev => prev.map(i =>
      i.stock_item_id === stockItemId ? { ...i, quantity_requested: val } : i
    ));
  };

  // --- Submit ---
  const handleSubmit = async () => {
    if (!cart.length) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await api.post('/requests', {
        project_id: projectId,
        items: cart.map(i => ({
          stock_item_id: i.stock_item_id,
          quantity_requested: i.quantity_requested,
          description_1: i.description_1,
          description_2: i.description_2 || null,
          item_number: i.item_number || null,
          uom: i.uom,
        })),
        notes,
      });
      navigate('/requester/requests');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Failed to submit request');
    }
    setSubmitting(false);
  };

  const totalPages = Math.ceil(total / limit);
  const selectedProject = projects.find(p => p.id === projectId);

  return (
    <div className="space-y-5 pb-28">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Browse Stock</h2>
        <p className="text-sm text-gray-500 mt-1">Browse items, click to add to your request, then submit.</p>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Project</label>
          <select
            value={projectId}
            onChange={e => handleProjectChange(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select project…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.project_number ? `[${p.project_number}] ` : ''}{p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1); }}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            <option value="CH">CH — Chargeable</option>
            <option value="DC">DC — Direct Cost</option>
            <option value="SPARE">SPARE — Spare</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Item number or description…"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Empty state */}
      {!projectId && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-2">📦</div>
          <p className="text-sm">Select a project to browse stock</p>
        </div>
      )}

      {projectId && (
        <>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{loading ? 'Loading…' : `${total} item${total !== 1 ? 's' : ''} in ${selectedProject?.name || ''}`}</span>
            {total > 0 && !loading && <span>Page {page} of {totalPages}</span>}
          </div>

          {/* Stock table */}
          <div className="bg-white border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b">
                <tr>
                  <th className="px-4 py-3 text-left">Item No.</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-center">On Hand</th>
                  <th className="px-4 py-3 text-center">UOM</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading…</td></tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">No items found</td></tr>
                )}
                {rows.map(item => {
                  const inCart = !!cartMap[item.id];
                  const isActive = activeRowId === item.id;
                  const outOfStock = parseFloat(item.qty_on_hand) <= 0;

                  return (
                    <tr key={item.id} className={`transition-colors ${inCart ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.item_number || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{item.description_1}</div>
                        {item.description_2 && <div className="text-xs text-gray-400 mt-0.5">{item.description_2}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {item.category
                          ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-600'}`}>{item.category}</span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${outOfStock ? 'text-red-500' : 'text-gray-800'}`}>
                          {parseFloat(item.qty_on_hand)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 text-xs">{item.uom}</td>
                      <td className="px-4 py-3 text-center">
                        {outOfStock ? (
                          <span className="text-xs text-red-400">Out of stock</span>
                        ) : isActive ? (
                          /* Inline qty input */
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              autoFocus
                              value={activeQty}
                              onChange={e => setActiveQty(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') confirmAdd(item); if (e.key === 'Escape') cancelInline(); }}
                              className="w-20 border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => confirmAdd(item)}
                              className="bg-blue-600 text-white px-2 py-1 rounded-lg text-xs font-medium hover:bg-blue-700"
                            >
                              ✓
                            </button>
                            <button
                              onClick={cancelInline}
                              className="text-gray-400 hover:text-gray-600 px-1 py-1 text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        ) : inCart ? (
                          /* Already in cart */
                          <button
                            onClick={() => openInline(item)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                          >
                            ✓ In Request <span className="text-green-500">· edit</span>
                          </button>
                        ) : (
                          /* Add button */
                          <button
                            onClick={() => openInline(item)}
                            className="px-3 py-1 rounded-lg text-xs font-medium border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
                          >
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
            <div className="flex items-center justify-between text-sm">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
              <span className="text-gray-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-4 py-2 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
            </div>
          )}
        </>
      )}

      {/* Sticky cart bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-lg px-4 py-3 flex items-center justify-between gap-4 lg:pl-72">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-800">
              {cart.length} item{cart.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => { setCart([]); setActiveRowId(null); }}
              className="text-xs text-gray-400 hover:text-red-500 underline"
            >
              Clear
            </button>
          </div>
          <button
            onClick={() => { setShowModal(true); setSubmitError(''); }}
            className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 shrink-0"
          >
            Submit Request →
          </button>
        </div>
      )}

      {/* Submit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-lg">Submit Request</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Project */}
              <div className="text-sm text-gray-500">
                Project: <span className="font-semibold text-gray-800">{selectedProject?.name}</span>
              </div>

              {/* Cart items */}
              <div className="space-y-2">
                {cart.map(item => (
                  <div key={item.stock_item_id} className="flex items-center gap-3 border rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-800 truncate">{item.description_1}</div>
                      <div className="text-xs text-gray-400">{item.item_number} · {item.uom}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500">Qty</span>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        value={item.quantity_requested}
                        onChange={e => updateCartQty(item.stock_item_id, parseFloat(e.target.value) || '')}
                        className="w-20 border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={() => removeFromCart(item.stock_item_id)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any additional notes…"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {submitError}
                </div>
              )}
            </div>

            <div className="p-5 border-t flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || cart.length === 0}
                className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : `Submit ${cart.length} item${cart.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
