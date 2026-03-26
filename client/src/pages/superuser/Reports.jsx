import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';

export default function Reports() {
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({ project_id: '', date_from: '', date_to: '' });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get('/projects').then(r => setProjects(r.data)); }, []);

  const load = async () => {
    setLoading(true);
    const p = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
    try { const { data } = await api.get(`/reports/summary?${p}`); setSummary(data); }
    finally { setLoading(false); }
  };

  const exportExcel = () => {
    const p = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
    const token = localStorage.getItem('token');
    window.open(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/reports/export?${p}&token=${token}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Reports</h2>
      <div className="bg-white rounded-xl border p-5">
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={filters.project_id} onChange={e => setFilters(f => ({ ...f, project_id: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {[['date_from','From'],['date_to','To']].map(([k,l]) => (
            <div key={k} className="flex items-center gap-1">
              <span className="text-sm text-gray-500">{l}:</span>
              <input type="date" value={filters[k]} onChange={e => setFilters(f => ({ ...f, [k]: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
          <button onClick={load} disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Loading…' : '📊 Load Report'}
          </button>
          <button onClick={exportExcel} className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">⬇️ Export Excel</button>
        </div>

        {summary && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Issues by Project</h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                    <tr><th className="px-4 py-3 text-left">Project</th><th className="px-4 py-3 text-left">Issue Transactions</th><th className="px-4 py-3 text-left">Total Qty Issued</th><th className="px-4 py-3 text-left">Total Qty Returned</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {summary.issued.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{row.project_name}</td>
                        <td className="px-4 py-3">{row.issue_count}</td>
                        <td className="px-4 py-3 text-blue-600 font-bold">{parseFloat(row.total_qty || 0).toFixed(0)}</td>
                        <td className="px-4 py-3 text-green-600 font-bold">
                          {parseFloat(summary.returned?.find(r => r.project_name === row.project_name)?.total_returned || 0).toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
