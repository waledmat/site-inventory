import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [filters, setFilters] = useState({ user_id: '', entity_type: '', date_from: '', date_to: '' });
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {});
    api.get('/audit/entity-types').then(r => setEntityTypes(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchLog(); }, [page, filters]);

  async function fetchLog() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit, ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v)) });
      const r = await api.get(`/audit?${params}`);
      setRows(r.data.rows);
      setTotal(r.data.total);
    } catch { setRows([]); }
    setLoading(false);
  }

  function handleFilter(e) {
    setFilters(f => ({ ...f, [e.target.name]: e.target.value }));
    setPage(1);
  }

  const actionColor = (action) => {
    if (action.includes('CREATED')) return 'bg-green-100 text-green-800';
    if (action.includes('ADJUSTED') || action.includes('UPDATED')) return 'bg-yellow-100 text-yellow-800';
    if (action.includes('DELETED') || action.includes('REJECTED')) return 'bg-red-100 text-red-800';
    if (action.includes('LOGGED') || action.includes('RESOLVED')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-700';
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">Audit Log</h2>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <select name="user_id" value={filters.user_id} onChange={handleFilter} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Users</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
        </select>
        <select name="entity_type" value={filters.entity_type} onChange={handleFilter} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Entity Types</option>
          {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" name="date_from" value={filters.date_from} onChange={handleFilter} className="border rounded-lg px-3 py-2 text-sm" placeholder="From" />
        <input type="date" name="date_to" value={filters.date_to} onChange={handleFilter} className="border rounded-lg px-3 py-2 text-sm" placeholder="To" />
      </div>

      <div className="text-sm text-gray-500">{total} total entries</div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">Entity ID</th>
              <th className="px-4 py-3 text-left">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No audit entries found</td></tr>
            )}
            {rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{row.user_name || '—'}</div>
                  <div className="text-xs text-gray-400 capitalize">{row.user_role}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColor(row.action)}`}>
                    {row.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{row.entity_type}</td>
                <td className="px-4 py-3 text-gray-400 text-xs font-mono">{row.entity_id?.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                  {row.new_value && (
                    <details className="cursor-pointer">
                      <summary className="text-blue-600 hover:underline">View</summary>
                      <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(JSON.parse(row.new_value), null, 2)}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
            className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
          <span className="text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
            className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      )}
    </div>
  );
}
