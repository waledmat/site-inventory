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

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={`Request — ${detail?.project_name}`} wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <div><span className="text-gray-500">Status:</span> <Badge value={detail.status} /></div>
              <div><span className="text-gray-500">Date:</span> {detail.created_at?.slice(0,10)}</div>
            </div>
            {detail.notes && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
                <strong>Your notes:</strong> {detail.notes}
              </div>
            )}
            {detail.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <strong>Rejection reason:</strong> {detail.rejection_reason}
              </div>
            )}
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
            {detail.status === 'rejected' && (
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
