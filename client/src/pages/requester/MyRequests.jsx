import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import TransactionHistoryModal from '../../components/common/TransactionHistoryModal';

const STATUSES = ['pending', 'issued', 'rejected', 'escalated'];
const PAGE_SIZE = 15;

export default function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({ status: '', project_id: '', date_from: '', date_to: '' });
  const [detail, setDetail] = useState(null);
  const [escalateNote, setEscalateNote] = useState('');
  const [historyRef, setHistoryRef] = useState(null);

  // edit state
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // add item search inside edit mode
  const [addQ, setAddQ] = useState('');
  const [addResults, setAddResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);

  useEffect(() => { api.get('/projects').then(r => setProjects(r.data)).catch(() => {}); }, []);

  const load = (f = filters, p = page) => {
    const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
    if (f.status) params.append('status', f.status);
    if (f.project_id) params.append('project_id', f.project_id);
    if (f.date_from) params.append('date_from', f.date_from);
    if (f.date_to) params.append('date_to', f.date_to);
    api.get(`/requests?${params}`).then(r => {
      if (r.data?.data) { setRequests(r.data.data); setTotal(r.data.total); }
      else { setRequests(r.data); setTotal(r.data.length); }
    });
  };

  useEffect(() => { load(); }, [page]); // eslint-disable-line

  const applyFilters = () => { setPage(1); load(filters, 1); };
  const clearFilters = () => {
    const empty = { status: '', project_id: '', date_from: '', date_to: '' };
    setFilters(empty); setPage(1); load(empty, 1);
  };

  const openDetail = async id => {
    const { data } = await api.get(`/requests/${id}`);
    setDetail(data); setEscalateNote('');
  };

  const escalate = async () => {
    await api.put(`/requests/${detail.id}/escalate`, { notes: escalateNote });
    setDetail(null); load();
  };

  const startEdit = () => {
    setEditItems(detail.items.map(i => ({ ...i, quantity_requested: parseFloat(i.quantity_requested) })));
    setEditNotes(detail.notes || '');
    setEditError('');
    setAddQ('');
    setAddResults([]);
    setEditMode(true);
  };

  const searchAddItems = async (q) => {
    setAddQ(q);
    if (!q || q.length < 2) { setAddResults([]); return; }
    setAddSearching(true);
    try {
      const params = new URLSearchParams({ q, project_id: detail.project_id });
      const { data } = await api.get(`/stock/search?${params}`);
      const rows = (data.rows ?? data).filter(s => parseFloat(s.qty_on_hand) > 0);
      setAddResults(rows);
    } finally { setAddSearching(false); }
  };

  const addEditItem = (stock) => {
    const existing = editItems.findIndex(i => i.stock_item_id === stock.id);
    if (existing >= 0) {
      const updated = [...editItems];
      updated[existing].quantity_requested += 1;
      setEditItems(updated);
    } else {
      setEditItems(prev => [...prev, {
        stock_item_id: stock.id,
        item_number: stock.item_number || '',
        description_1: stock.description_1,
        description_2: stock.description_2 || null,
        uom: stock.uom,
        qty_on_hand: parseFloat(stock.qty_on_hand),
        quantity_requested: 1,
      }]);
    }
    setAddQ('');
    setAddResults([]);
  };

  const saveEdit = async () => {
    setEditSaving(true); setEditError('');
    try {
      await api.put(`/requests/${detail.id}`, { items: editItems, notes: editNotes });
      const { data } = await api.get(`/requests/${detail.id}`);
      setDetail(data);
      setEditMode(false);
      load();
    } catch (err) { setEditError(err.response?.data?.error || 'Failed to save'); }
    finally { setEditSaving(false); }
  };

  const confirmDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.delete(`/requests/${detail.id}`);
      setDetail(null); setDeleteConfirm(false); load();
    } catch (err) { alert(err.response?.data?.error || 'Failed to delete'); }
    finally { setDeleteLoading(false); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = Object.values(filters).some(Boolean);

  const cols = [
    { key: 'request_number', header: 'Ref', render: v => v
      ? <button onClick={() => setHistoryRef(v)} className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200">{v}</button>
      : <span className="text-gray-300 text-xs">—</span>
    },
    { key: 'created_at', header: 'Date', render: v => v?.slice(0,10) },
    { key: 'project_name', header: 'Project' },
    { key: 'item_count', header: 'Items' },
    { key: 'status', header: 'Status', render: v => <Badge value={v} /> },
    { key: 'rejection_reason', header: 'Rejection Reason', render: v => v || '—' },
    { key: 'id', header: '', render: id => <button onClick={() => openDetail(id)} className="text-xs text-blue-600 hover:underline">View</button> },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">My Requests</h2>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap gap-3">
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.project_id} onChange={e => setFilters(f => ({ ...f, project_id: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm" />
        <input type="date" value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm" />
        <button onClick={applyFilters} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Apply
        </button>
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 border rounded-lg">
            ✕ Clear
          </button>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 font-medium">No requests found</p>
          <p className="text-gray-400 text-sm mt-1">Submit a request to see it here.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-2">{total} request{total !== 1 ? 's' : ''}</p>
          <Table columns={cols} data={requests} />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
            </div>
          )}
        </>
      )}

      <Modal isOpen={!!detail} onClose={() => { setDetail(null); setEditMode(false); setDeleteConfirm(false); }} title={`Request — ${detail?.project_name}`} wide>
        {detail && (
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-4 text-sm">
                <div><span className="text-gray-500">Status:</span> <Badge value={detail.status} /></div>
                <div><span className="text-gray-500">Date:</span> {detail.created_at?.slice(0,10)}</div>
                {detail.request_number && <div className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{detail.request_number}</div>}
              </div>
              {detail.status === 'pending' && !editMode && (
                <div className="flex gap-2">
                  <button onClick={startEdit}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50">
                    ✏️ Edit
                  </button>
                  <button onClick={() => setDeleteConfirm(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-300 text-red-500 rounded-lg hover:bg-red-50">
                    🗑 Delete
                  </button>
                </div>
              )}
            </div>

            {/* Delete confirm */}
            {deleteConfirm && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-2">
                <p className="text-sm font-medium text-red-700">Are you sure you want to delete this request? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={confirmDelete} disabled={deleteLoading}
                    className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                    {deleteLoading ? 'Deleting…' : 'Yes, Delete'}
                  </button>
                  <button onClick={() => setDeleteConfirm(false)}
                    className="border px-4 py-1.5 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}

            {detail.notes && !editMode && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
                <strong>Your notes:</strong> {detail.notes}
              </div>
            )}
            {detail.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <strong>Rejection reason:</strong> {detail.rejection_reason}
              </div>
            )}

            {/* Edit mode */}
            {editMode ? (
              <div className="space-y-3">
                {/* Search to add items */}
                <div className="relative">
                  <input
                    value={addQ}
                    onChange={e => searchAddItems(e.target.value)}
                    placeholder="+ Search to add item…"
                    className="w-full border border-dashed border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 placeholder-blue-400"
                  />
                  {addSearching && <span className="absolute right-3 top-2.5 text-xs text-gray-400">Searching…</span>}
                  {addResults.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {addResults.map(s => (
                        <div key={s.id} onClick={() => addEditItem(s)}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 cursor-pointer border-b last:border-0 text-sm">
                          <div>
                            <div className="font-medium text-gray-800">{s.description_1}</div>
                            <div className="text-xs text-gray-400">{s.item_number} · {s.uom}</div>
                          </div>
                          <span className="text-xs font-bold text-green-600 ml-4 shrink-0">On Hand: {s.qty_on_hand}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Current items */}
                <div className="space-y-2">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 border rounded-lg px-3 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 truncate">{item.description_1}</div>
                        <div className="text-xs text-gray-400">{item.item_number} · {item.uom}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-xs text-gray-500">Qty</label>
                        <input type="number" min="0.001" step="any" value={item.quantity_requested}
                          onChange={e => { const updated = [...editItems]; updated[idx].quantity_requested = parseFloat(e.target.value); setEditItems(updated); }}
                          className="w-20 border rounded-lg px-2 py-1 text-sm text-center" />
                      </div>
                      <button type="button" onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                {editError && <p className="text-red-500 text-sm">{editError}</p>}
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={editSaving || !editItems.length}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {editSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            ) : (
              <table className="w-full text-sm border rounded-lg overflow-hidden">
                <thead className="bg-gray-50"><tr>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Item No.</th>
                  <th className="px-3 py-2 text-left">Qty</th>
                  <th className="px-3 py-2 text-left">UOM</th>
                </tr></thead>
                <tbody>{detail.items?.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{item.description_1}</td>
                    <td className="px-3 py-2">{item.item_number || '—'}</td>
                    <td className="px-3 py-2">{item.quantity_requested}</td>
                    <td className="px-3 py-2">{item.uom}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}

            {detail.status === 'rejected' && !editMode && (
              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">Escalate to Project Coordinator</p>
                <textarea value={escalateNote} onChange={e => setEscalateNote(e.target.value)}
                  placeholder="Add a note about why you're escalating…" rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <button onClick={escalate} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
                  🚨 Escalate to Coordinator
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
