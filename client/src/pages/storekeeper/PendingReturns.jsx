import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';

export default function PendingReturns() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'mine'
  const [returnForm, setReturnForm] = useState({});
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api.get('/returns/pending').then(r => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

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
  const displayed = filter === 'mine'
    ? items // backend already handles scoping; further front-end filter if needed
    : items;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Pending Returns</h2>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All Storekeepers</option>
          <option value="mine">My Issues Only</option>
        </select>
      </div>

      {msg && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg">{msg}</div>}

      {displayed.length === 0
        ? <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No pending returns</div>
        : (
          <div className="space-y-3">
            {displayed.map(item => {
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
    </div>
  );
}
