import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';

const PAGE_SIZE = 20;

export default function PendingReturns() {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filterProject, setFilterProject] = useState('');
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState('all');
  const [returnForm, setReturnForm] = useState({});
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const load = () => api.get('/returns/pending').then(r => setItems(r.data)).catch(() => {});
  useEffect(() => {
    load();
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  const logReturn = async (itemId) => {
    const f = returnForm[itemId] || {};
    if (!f.quantity_returned || !f.condition) return;
    setSaving(itemId);
    try {
      await api.post('/returns', { issue_item_id: itemId, quantity_returned: f.quantity_returned, condition: f.condition, notes: f.notes });
      setMsg('Return logged successfully');
      setReturnForm(p => { const n = { ...p }; delete n[itemId]; return n; });
      load();
    } catch (err) { setMsg(err.response?.data?.error || 'Error'); }
    finally { setSaving(null); setTimeout(() => setMsg(''), 3000); }
  };

  const today = new Date().toISOString().slice(0,10);

  // Filter chain
  let filtered = items;
  if (filterProject) filtered = filtered.filter(i => i.project_id === filterProject || i.project_name === projects.find(p => p.id === filterProject)?.name);
  if (searchText) {
    const q = searchText.toLowerCase();
    filtered = filtered.filter(i =>
      i.description_1?.toLowerCase().includes(q) ||
      i.item_number?.toLowerCase().includes(q) ||
      i.delivery_note_id?.toLowerCase().includes(q)
    );
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleFilterChange = (setter, value) => {
    setter(value);
    setCurrentPage(1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Pending Returns</h2>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All Storekeepers</option>
          <option value="mine">My Issues Only</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3">
        <input value={searchText} onChange={e => handleFilterChange(setSearchText, e.target.value)}
          placeholder="Search by item name, item no., or DN number…"
          className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm" />
        <select value={filterProject} onChange={e => handleFilterChange(setFilterProject, e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(searchText || filterProject) && (
          <button onClick={() => { setSearchText(''); setFilterProject(''); setCurrentPage(1); }}
            className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 border rounded-lg">
            ✕ Clear
          </button>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-gray-500 mb-3">{filtered.length} item{filtered.length !== 1 ? 's' : ''} pending return</p>
      )}

      {msg && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg">{msg}</div>}

      {paginated.length === 0
        ? <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No pending returns</div>
        : (
          <div className="space-y-3">
            {paginated.map(item => {
              const isOverdue = item.issue_date < today;
              const f = returnForm[item.id] || {};
              return (
                <div key={item.id} className={`bg-white rounded-xl border p-4 ${isOverdue ? 'border-red-300 bg-red-50' : ''}`}>
                  <div className="flex flex-wrap gap-4 items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {isOverdue && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">⚠️ Overdue</span>}
                        <span className="font-semibold text-gray-800 text-sm truncate">{item.description_1}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.project_name} · DN: {item.delivery_note_id} · Issued by: {item.storekeeper_name}
                        {item.receiver_name && ` · To: ${item.receiver_name}`}
                      </div>
                      <div className="flex gap-4 mt-2 text-xs">
                        <span>Issued: <strong>{item.quantity_issued}</strong></span>
                        <span>Returned: <strong>{item.qty_returned}</strong></span>
                        <span className="text-orange-600 font-bold">Remaining: {item.qty_remaining}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 items-end flex-wrap">
                      <input type="number" min="0.001" step="any" placeholder="Qty" value={f.quantity_returned || ''}
                        onChange={e => setReturnForm(p => ({ ...p, [item.id]: { ...f, quantity_returned: e.target.value } }))}
                        className="w-20 border rounded-lg px-2 py-1.5 text-sm" />
                      <select value={f.condition || ''} onChange={e => setReturnForm(p => ({ ...p, [item.id]: { ...f, condition: e.target.value } }))}
                        className="border rounded-lg px-2 py-1.5 text-sm">
                        <option value="">Condition</option>
                        <option value="good">Good</option>
                        <option value="damaged">Damaged</option>
                        <option value="lost">Lost</option>
                      </select>
                      <button onClick={() => logReturn(item.id)} disabled={saving === item.id}
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        {saving === item.id ? '…' : 'Log'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
          <span className="text-gray-500">Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages}
            className="px-4 py-2 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      )}
    </div>
  );
}
