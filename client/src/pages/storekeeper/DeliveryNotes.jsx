import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';

export default function DeliveryNotes() {
  const [issues, setIssues] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [filters, setFilters] = useState({
    dn_number: '',
    project_id: '',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
    load({});
  }, []);

  const load = async (f) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.dn_number) params.set('dn_number', f.dn_number);
      if (f.project_id) params.set('project_id', f.project_id);
      if (f.date_from) params.set('date_from', f.date_from);
      if (f.date_to) params.set('date_to', f.date_to);
      const { data } = await api.get(`/issues?${params.toString()}`);
      setIssues(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const search = () => load(filters);

  const clearFilters = () => {
    const cleared = { dn_number: '', project_id: '', date_from: '', date_to: '' };
    setFilters(cleared);
    load(cleared);
  };

  const openDetail = async (id) => {
    setDetailLoading(true);
    setDetail({ id, loading: true });
    try {
      const { data } = await api.get(`/issues/${id}`);
      setDetail(data);
    } catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  const downloadDN = (issue) => {
    window.open(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/issues/${issue.id}/delivery-note?token=${localStorage.getItem('token')}`,
      '_blank'
    );
  };

  const setFilter = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Delivery Notes</h2>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">DN Number</label>
            <input
              type="text"
              placeholder="e.g. DN-2026-0001"
              value={filters.dn_number}
              onChange={e => setFilter('dn_number', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
            <select
              value={filters.project_id}
              onChange={e => setFilter('project_id', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date From</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={e => setFilter('date_from', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date To</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={e => setFilter('date_to', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={search}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            🔍 Search
          </button>
          <button onClick={clearFilters}
            className="border px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Clear
          </button>
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-xs text-gray-500 mb-3">{issues.length} delivery note{issues.length !== 1 ? 's' : ''} found</p>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Loading…</div>
      ) : issues.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No delivery notes found</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">DN Number</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Project</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Receiver</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Issued By</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Items</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, i) => (
                <tr key={issue.id} className={`border-t hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-blue-700">{issue.delivery_note_id}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{String(issue.issue_date).slice(0, 10)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{issue.project_name}</td>
                  <td className="px-4 py-3 text-gray-600">{issue.receiver_name || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{issue.storekeeper_name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-gray-100 text-gray-700 rounded-full px-2 py-0.5 text-xs font-medium">
                      {issue.item_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openDetail(issue.id)}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        View
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => downloadDN(issue)}
                        className="text-xs text-green-600 hover:underline font-medium"
                      >
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  {detail.loading ? 'Loading…' : detail.delivery_note_id}
                </h3>
                {!detail.loading && (
                  <p className="text-xs text-gray-500 mt-0.5">{detail.project_name} · {String(detail.issue_date).slice(0, 10)}</p>
                )}
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            {!detail.loading && (
              <div className="px-6 py-5 space-y-4">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Issued By:</span> <strong>{detail.storekeeper_name}</strong></div>
                  <div><span className="text-gray-500">Receiver:</span> <strong>{detail.receiver_name || '—'}</strong></div>
                  {detail.receiver_position && (
                    <div><span className="text-gray-500">Position:</span> {detail.receiver_position}</div>
                  )}
                </div>

                {/* Items */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">#</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Item No.</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Description</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Batch No.</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Qty</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">UOM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.items || []).map((item, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{item.item_number || '—'}</td>
                          <td className="px-3 py-2 font-medium">
                            {item.description_1}
                            {item.description_2 && <span className="text-gray-400"> / {item.description_2}</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{item.batch_number || '—'}</td>
                          <td className="px-3 py-2 text-right font-bold">{parseFloat(item.quantity_issued)}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{item.uom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Download */}
                <button
                  onClick={() => downloadDN(detail)}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 text-sm"
                >
                  📄 Download PDF
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
