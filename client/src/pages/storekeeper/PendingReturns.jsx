import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import TransactionHistoryModal from '../../components/common/TransactionHistoryModal';
import QRScanner from '../../components/common/QRScanner';
import { useAuth } from '../../context/AuthContext';

const PAGE_SIZE = 20;

export default function PendingReturns() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filterProject, setFilterProject] = useState('');
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState('all');
  const [returnForm, setReturnForm] = useState({});
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [historyRef, setHistoryRef] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanInfo, setScanInfo] = useState(null); // { item_number, description_1, uom, qty_on_hand }

  const load = (myFilter = filter) => {
    const params = new URLSearchParams();
    if (myFilter === 'mine' && user?.id) params.set('storekeeper_id', user.id);
    api.get(`/returns/pending?${params}`).then(r => setItems(r.data)).catch(() => {});
  };
  useEffect(() => {
    load('all');
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []); // eslint-disable-line

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

  const handleScan = async (raw) => {
    setScanInfo(null);
    if (raw.startsWith('ITEM:')) {
      const itemNumber = raw.slice(5).trim();
      handleFilterChange(setSearchText, itemNumber);
      // Look up full item info to show in the info card
      try {
        const { data } = await api.get(`/stock/lookup?item_number=${encodeURIComponent(itemNumber)}`);
        if (data.length) setScanInfo(data[0]);
      } catch { /* silently ignore */ }
    } else if (raw.startsWith('DN:')) {
      handleFilterChange(setSearchText, raw.slice(3).trim());
    } else {
      handleFilterChange(setSearchText, raw);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Pending Returns</h2>
        <select value={filter} onChange={e => { setFilter(e.target.value); setCurrentPage(1); load(e.target.value); }}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All Storekeepers</option>
          <option value="mine">My Issues Only</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3">
        <input value={searchText} onChange={e => { handleFilterChange(setSearchText, e.target.value); setScanInfo(null); }}
          placeholder="Search by item name, item no., or DN number…"
          className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm" />
        <select value={filterProject} onChange={e => handleFilterChange(setFilterProject, e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button
          onClick={() => setScanning(true)}
          className="flex items-center gap-1.5 border border-blue-300 text-blue-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-50"
          title="Scan item QR to filter"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5A2.5 2.5 0 0116 18H8a2.5 2.5 0 01-2.5-2.5V8A2.5 2.5 0 018 5.5h8A2.5 2.5 0 0118.5 8v.5" />
          </svg>
          Scan QR
        </button>
        {(searchText || filterProject) && (
          <button onClick={() => { setSearchText(''); setFilterProject(''); setCurrentPage(1); setScanInfo(null); }}
            className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 border rounded-lg">
            ✕ Clear
          </button>
        )}
      </div>

      {/* Scanned item info card */}
      {scanInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-start gap-4">
          <div className="flex-1">
            <div className="text-xs text-blue-500 font-medium mb-1">Scanned Item</div>
            <div className="font-semibold text-gray-800">{scanInfo.description_1}</div>
            {scanInfo.description_2 && <div className="text-sm text-gray-500">{scanInfo.description_2}</div>}
            <div className="flex gap-4 mt-2 text-xs text-gray-600">
              <span>Code: <strong className="font-mono">{scanInfo.item_number}</strong></span>
              <span>UOM: <strong>{scanInfo.uom}</strong></span>
              <span>On Hand: <strong className="text-green-700">{scanInfo.qty_on_hand}</strong></span>
            </div>
          </div>
          <button onClick={() => setScanInfo(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
      )}

      <QRScanner isOpen={scanning} onClose={() => setScanning(false)} onScan={handleScan} />

      {filtered.length > 0 && (
        <p className="text-xs text-gray-500 mb-3">{filtered.length} item{filtered.length !== 1 ? 's' : ''} pending return</p>
      )}

      <TransactionHistoryModal refNumber={historyRef} onClose={() => setHistoryRef(null)} />
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
                      <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
                        <span>{item.project_name} · DN:</span>
                        <button onClick={() => setHistoryRef(item.delivery_note_id)}
                          className="font-mono text-blue-600 hover:underline">
                          {item.delivery_note_id}
                        </button>
                        <span>· Issued by: {item.storekeeper_name}</span>
                        {item.receiver_name && <span>· To: {item.receiver_name}</span>}
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
