import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';

export default function StockSearch() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 50;

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
    search();
  }, []);

  const search = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.append('q', q);
      if (category) params.append('category', category);
      if (projectId) params.append('project_id', projectId);
      params.append('page', p);
      params.append('limit', PAGE_SIZE);
      const { data } = await api.get(`/stock/search?${params}`);
      setResults(data.rows);
      setTotal(data.total);
      setPage(p);
    } finally { setLoading(false); }
  };

  const catLabel = { CH: 'Chargeable', DC: 'Consumable', SPARE: 'Spare Parts' };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Stock Search</h2>
      <div className="bg-white rounded-xl border p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search by item code or description…"
            className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm" />
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Categories</option>
            <option value="CH">Chargeable</option>
            <option value="DC">Consumable</option>
            <option value="SPARE">Spare Parts</option>
          </select>
          <select value={projectId} onChange={e => setProjectId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={search} disabled={loading}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Searching…' : '🔍 Search'}
          </button>
        </div>
      </div>

      {total > 0 && (
        <p className="text-xs text-gray-500 mb-2">{total} item{total !== 1 ? 's' : ''} found</p>
      )}

      {results.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
              <tr>
                {['Item No.','Description','Category','UOM','On Hand','Warehouse Balance','Issued','Pending Return','Contract'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.map(item => (
                <tr key={item.id} className={`hover:bg-gray-50 ${item.qty_on_hand <= 0 ? 'bg-yellow-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs">{item.item_number || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.description_1}</div>
                    {item.description_2 && <div className="text-xs text-gray-400">{item.description_2}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{catLabel[item.category] || item.category || '—'}</span>
                  </td>
                  <td className="px-4 py-3">{item.uom}</td>
                  <td className={`px-4 py-3 font-bold ${item.qty_on_hand <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {item.qty_on_hand}
                  </td>
                  <td className={`px-4 py-3 font-bold ${item.qty_pending_warehouse < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                    {item.qty_pending_warehouse}
                  </td>
                  <td className="px-4 py-3">{item.qty_issued}</td>
                  <td className="px-4 py-3 text-orange-600">{item.qty_pending_return}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{item.contract_no || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {results.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-400">No items found</div>
      )}
      {loading && results.length === 0 && (
        <div className="text-center py-8 text-gray-400">Loading…</div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button onClick={() => search(page - 1)} disabled={page === 1 || loading}
            className="px-4 py-2 border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
          <span className="text-gray-500">Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
          <button onClick={() => search(page + 1)} disabled={page >= Math.ceil(total / PAGE_SIZE) || loading}
            className="px-4 py-2 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      )}
    </div>
  );
}
