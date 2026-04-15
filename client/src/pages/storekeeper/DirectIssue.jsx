import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axiosInstance';
import QRScanner from '../../components/common/QRScanner';

export default function DirectIssue() {
  const navigate = useNavigate();

  // Mode: 'scan' or 'browse'
  const [mode, setMode] = useState('scan');

  // QR scanner
  const [scanning, setScanning] = useState(false);

  // Item found by QR or clicked in browse
  const [pendingItem, setPendingItem] = useState(null); // item info card
  const [pendingQty, setPendingQty] = useState('');
  const [pendingBatch, setPendingBatch] = useState('');
  const [pendingError, setPendingError] = useState('');

  // Browse mode
  const [searchQ, setSearchQ] = useState('');
  const [searchProject, setSearchProject] = useState('');
  const [projects, setProjects] = useState([]);
  const [stockResults, setStockResults] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  // Issue list
  const [items, setItems] = useState([]);          // accumulated items to issue
  const [lockedProjectId, setLockedProjectId] = useState(null);
  const [lockedProjectName, setLockedProjectName] = useState('');

  // Receiver
  const [receiverId, setReceiverId] = useState('');
  const [users, setUsers] = useState([]);

  // Submit
  const [showPreview, setShowPreview] = useState(false);
  const [issued, setIssued] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  // Scan notification
  const [scanMsg, setScanMsg] = useState('');

  useEffect(() => {
    api.get('/users?role=requester').then(r => setUsers(r.data)).catch(() => {});
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  // ── Browse: search stock ─────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'browse') return;
    const timer = setTimeout(() => {
      if (!searchQ && !searchProject) { setStockResults([]); return; }
      setBrowseLoading(true);
      const params = new URLSearchParams();
      if (searchQ) params.set('q', searchQ);
      if (searchProject) params.set('project_id', searchProject);
      if (lockedProjectId) params.set('project_id', lockedProjectId);
      params.set('limit', '30');
      api.get(`/stock/search?${params}`)
        .then(r => setStockResults(r.data.rows || []))
        .catch(() => {})
        .finally(() => setBrowseLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQ, searchProject, mode, lockedProjectId]);

  // ── QR scan handler ──────────────────────────────────────────────
  const handleScan = async (raw) => {
    setScanMsg('');
    setPendingError('');
    if (!raw.startsWith('ITEM:')) {
      setScanMsg(`Unrecognized QR: "${raw}". Expected ITEM:... format.`);
      return;
    }
    const itemNumber = raw.slice(5).trim();
    try {
      const params = new URLSearchParams({ item_number: itemNumber });
      if (lockedProjectId) params.set('project_id', lockedProjectId);
      const { data } = await api.get(`/stock/lookup?${params}`);
      if (!data.length) {
        setScanMsg(`Item "${itemNumber}" not found in your assigned projects.`);
        return;
      }
      // If multiple matches (same item_number in multiple projects), take first or show picker
      openPendingItem(data[0]);
    } catch {
      setScanMsg('Failed to look up item. Try again.');
    }
  };

  const openPendingItem = (item) => {
    if (lockedProjectId && item.project_id !== lockedProjectId) {
      setScanMsg(`This item belongs to a different project (${item.project_name}). Current issue is locked to "${lockedProjectName}".`);
      return;
    }
    setPendingItem(item);
    setPendingQty('');
    setPendingBatch('');
    setPendingError('');
  };

  const addToList = () => {
    if (!pendingItem) return;
    const qty = parseFloat(pendingQty);
    if (!qty || qty <= 0) { setPendingError('Enter a valid quantity'); return; }
    if (qty > parseFloat(pendingItem.qty_on_hand)) {
      setPendingError(`Qty exceeds on-hand stock (${pendingItem.qty_on_hand} ${pendingItem.uom})`);
      return;
    }
    // Check if item already in list
    const exists = items.find(i => i.stock_item_id === pendingItem.id);
    if (exists) {
      setPendingError('This item is already in the issue list. Edit quantity there.');
      return;
    }
    setItems(prev => [...prev, {
      stock_item_id: pendingItem.id,
      item_number: pendingItem.item_number,
      description_1: pendingItem.description_1,
      description_2: pendingItem.description_2 || null,
      uom: pendingItem.uom,
      qty_on_hand: pendingItem.qty_on_hand,
      quantity_issued: qty,
      batch_number: pendingBatch,
    }]);
    if (!lockedProjectId) {
      setLockedProjectId(pendingItem.project_id);
      setLockedProjectName(pendingItem.project_name);
    }
    setPendingItem(null);
    setScanMsg(`"${pendingItem.description_1}" added to list.`);
    setTimeout(() => setScanMsg(''), 3000);
  };

  const removeItem = (idx) => {
    setItems(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      if (!updated.length) { setLockedProjectId(null); setLockedProjectName(''); }
      return updated;
    });
  };

  const updateQty = (idx, val) => {
    setItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], quantity_issued: val }; return u; });
  };

  // ── Submit issue ─────────────────────────────────────────────────
  const submit = async () => {
    setSubmitError(''); setLoading(true);
    try {
      const { data } = await api.post('/issues', {
        request_id: null,
        project_id: lockedProjectId,
        receiver_id: receiverId || null,
        items: items.map(i => ({
          stock_item_id: i.stock_item_id,
          item_number: i.item_number,
          description_1: i.description_1,
          description_2: i.description_2 || null,
          uom: i.uom,
          quantity_issued: parseFloat(i.quantity_issued),
          batch_number: i.batch_number || null,
        })),
      });
      setIssued(data);
      setShowPreview(false);
    } catch (err) { setSubmitError(err.response?.data?.error || 'Failed to issue'); }
    finally { setLoading(false); }
  };

  const downloadDN = () => {
    window.open(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/issues/${issued.id}/delivery-note?token=${localStorage.getItem('token')}`, '_blank');
  };

  const selectedReceiver = users.find(u => String(u.id) === String(receiverId));

  // ── Success screen ───────────────────────────────────────────────
  if (issued) return (
    <div className="max-w-md mx-auto text-center space-y-4 py-12">
      <div className="text-5xl">✅</div>
      <h2 className="text-2xl font-bold text-gray-800">Material Issued!</h2>
      <p className="text-gray-500">Delivery Note: <strong>{issued.delivery_note_id}</strong></p>
      <button onClick={downloadDN} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 w-full">
        Download Delivery Note PDF
      </button>
      <button onClick={() => navigate('/storekeeper')} className="border px-6 py-3 rounded-xl w-full text-sm">Back to Dashboard</button>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Direct Issue</h2>
        {lockedProjectName && (
          <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
            Project: {lockedProjectName}
          </span>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => { setMode('scan'); setPendingItem(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'scan' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Scan QR
        </button>
        <button
          onClick={() => { setMode('browse'); setPendingItem(null); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'browse' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Browse List
        </button>
      </div>

      {/* Scan mode */}
      {mode === 'scan' && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <button
            onClick={() => setScanning(true)}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5A2.5 2.5 0 0116 18H8a2.5 2.5 0 01-2.5-2.5V8A2.5 2.5 0 018 5.5h8A2.5 2.5 0 0118.5 8v.5" />
            </svg>
            Scan Item QR Code
          </button>
          {scanMsg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${scanMsg.includes('added') ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
              {scanMsg}
            </p>
          )}
        </div>
      )}

      {/* Browse mode */}
      {mode === 'browse' && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="flex gap-2">
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search by item no. or description…"
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
            {!lockedProjectId && (
              <select
                value={searchProject}
                onChange={e => setSearchProject(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          {browseLoading && <p className="text-xs text-gray-400">Searching…</p>}
          {!browseLoading && stockResults.length === 0 && (searchQ || searchProject) && (
            <p className="text-xs text-gray-400 text-center py-4">No items found</p>
          )}
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {stockResults.map(item => (
              <button
                key={item.id}
                onClick={() => openPendingItem(item)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors"
              >
                <div className="text-sm font-medium text-gray-800">{item.description_1}</div>
                <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                  <span className="font-mono">{item.item_number}</span>
                  <span>{item.uom}</span>
                  <span className="text-green-700">On hand: {item.qty_on_hand}</span>
                  <span className="text-gray-400">{item.project_name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending item card — shown after scan or browse selection */}
      {pendingItem && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-gray-800 text-base">{pendingItem.description_1}</div>
              {pendingItem.description_2 && <div className="text-sm text-gray-500">{pendingItem.description_2}</div>}
            </div>
            <button onClick={() => setPendingItem(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-3">×</button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-white rounded-lg p-2.5 border">
              <div className="text-xs text-gray-400 mb-0.5">Item Code</div>
              <div className="font-mono font-semibold text-gray-800">{pendingItem.item_number || '—'}</div>
            </div>
            <div className="bg-white rounded-lg p-2.5 border">
              <div className="text-xs text-gray-400 mb-0.5">UOM</div>
              <div className="font-semibold text-gray-800">{pendingItem.uom}</div>
            </div>
            <div className="bg-white rounded-lg p-2.5 border">
              <div className="text-xs text-gray-400 mb-0.5">On Hand</div>
              <div className="font-semibold text-green-700">{pendingItem.qty_on_hand}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Quantity to Issue</label>
              <input
                type="number" min="0.001" step="any"
                value={pendingQty}
                onChange={e => setPendingQty(e.target.value)}
                placeholder={`Max: ${pendingItem.qty_on_hand}`}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Batch / Lot <span className="text-gray-400">(optional)</span></label>
              <input
                type="text"
                value={pendingBatch}
                onChange={e => setPendingBatch(e.target.value)}
                placeholder="e.g. LOT-2026-001"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          {pendingError && <p className="text-red-500 text-xs bg-red-50 px-2 py-1 rounded">{pendingError}</p>}
          <button
            onClick={addToList}
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 text-sm"
          >
            + Add to Issue List
          </button>
        </div>
      )}

      {/* Issue list */}
      {items.length > 0 && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="font-semibold text-gray-700">Issue List ({items.length} item{items.length !== 1 ? 's' : ''})</h3>
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 border rounded-lg px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{item.description_1}</div>
                <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
                  <span className="font-mono">{item.item_number || '—'}</span>
                  <span>{item.uom}</span>
                  {item.batch_number && <span className="text-gray-400">Batch: {item.batch_number}</span>}
                </div>
              </div>
              <input
                type="number" min="0.001" step="any"
                value={item.quantity_issued}
                onChange={e => updateQty(idx, e.target.value)}
                className="w-20 border rounded-lg px-2 py-1.5 text-sm text-center font-bold text-blue-700"
              />
              <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 text-xl leading-none px-1">×</button>
            </div>
          ))}
        </div>
      )}

      {/* Receiver */}
      {items.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Receiver <span className="text-gray-400 font-normal">(optional)</span></label>
          <select
            value={receiverId}
            onChange={e => setReceiverId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Select receiver…</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.position || u.email}</option>)}
          </select>
        </div>
      )}

      {/* Action */}
      {items.length > 0 && (
        <button
          onClick={() => setShowPreview(true)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700"
        >
          Preview Delivery Note
        </button>
      )}

      {/* QR scanner modal */}
      <QRScanner isOpen={scanning} onClose={() => setScanning(false)} onScan={handleScan} />

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Delivery Note Preview</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4 font-mono text-sm">
              <div className="text-center border-b pb-3">
                <div className="font-bold text-base">SITE INVENTORY MANAGEMENT SYSTEM</div>
                <div className="font-semibold text-gray-700">DELIVERY NOTE</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-500">DN Number:</span> <strong className="text-gray-400">[auto-generated]</strong></div>
                <div><span className="text-gray-500">Date:</span> <strong>{new Date().toISOString().slice(0,10)}</strong></div>
                <div className="col-span-2"><span className="text-gray-500">Project:</span> <strong>{lockedProjectName}</strong></div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left w-6">#</th>
                      <th className="px-2 py-2 text-left">Item No.</th>
                      <th className="px-2 py-2 text-left">Description</th>
                      <th className="px-2 py-2 text-left">Batch</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-left">UOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1.5 text-gray-500">{i + 1}</td>
                        <td className="px-2 py-1.5 text-gray-500">{item.item_number || '—'}</td>
                        <td className="px-2 py-1.5 font-medium">{item.description_1}{item.description_2 ? ` / ${item.description_2}` : ''}</td>
                        <td className="px-2 py-1.5">{item.batch_number || <span className="text-gray-400">—</span>}</td>
                        <td className="px-2 py-1.5 text-right font-bold">{parseFloat(item.quantity_issued)}</td>
                        <td className="px-2 py-1.5 text-gray-500">{item.uom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-6 pt-3 border-t text-xs">
                <div>
                  <div className="text-gray-500 mb-0.5">Issued By:</div>
                  <div className="font-bold">[Storekeeper]</div>
                  <div className="mt-3 text-gray-500">Signature: ______________________</div>
                  <div className="mt-1 text-gray-500">Date: ___________________________</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-0.5">Received By:</div>
                  <div className="font-bold">{selectedReceiver?.name || '—'}</div>
                  <div className="text-gray-400">({selectedReceiver?.position || 'Receiver'})</div>
                  <div className="mt-3 text-gray-500">Signature: ______________________</div>
                  <div className="mt-1 text-gray-500">Date: ___________________________</div>
                </div>
              </div>
            </div>
            {submitError && <p className="mx-6 text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{submitError}</p>}
            <div className="flex gap-3 px-6 py-4 border-t">
              <button onClick={() => setShowPreview(false)} className="flex-1 border py-2.5 rounded-xl text-sm">
                Back to Edit
              </button>
              <button onClick={submit} disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Issuing…' : 'Confirm & Generate PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
