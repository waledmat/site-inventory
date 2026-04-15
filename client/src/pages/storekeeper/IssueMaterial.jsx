import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/axiosInstance';
import QRScanner from '../../components/common/QRScanner';

const DRAFT_KEY = (id) => `issue_draft_${id}`;

export default function IssueMaterial() {
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [request, setRequest]       = useState(null);
  const [items, setItems]           = useState([]);
  const [receiverId, setReceiverId] = useState('');
  const [users, setUsers]           = useState([]);
  const [issued, setIssued]         = useState(null);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // QR scan
  const [scanning, setScanning]       = useState(false);
  const [scanMsg, setScanMsg]         = useState('');   // success/error banner
  const [highlightIdx, setHighlightIdx] = useState(null); // flashes matched row
  const itemRefs = useRef([]);

  // Draft notification
  const [draftSaved, setDraftSaved] = useState(false);

  // ── Load request ───────────────────────────────────────────────
  useEffect(() => {
    if (!requestId) return;
    api.get(`/requests/${requestId}`).then(r => {
      setRequest(r.data);
      setReceiverId(r.data.requester_id || '');

      // Restore saved draft if present
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY(requestId)) || 'null');
      if (draft?.items) {
        setItems(draft.items);
        if (draft.receiverId) setReceiverId(draft.receiverId);
      } else {
        setItems(r.data.items?.map(i => ({
          ...i,
          quantity_issued: i.quantity_requested,
          batch_number: '',
        })) || []);
      }
    });
    api.get('/users?role=requester').then(r => setUsers(r.data)).catch(() => {});
  }, [requestId]);

  const selectedReceiver = users.find(u => String(u.id) === String(receiverId));

  const updateItem = (idx, field, value) => {
    setItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u; });
  };

  // ── Save draft ─────────────────────────────────────────────────
  const saveDraft = () => {
    localStorage.setItem(DRAFT_KEY(requestId), JSON.stringify({ items, receiverId }));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2500);
  };

  const clearDraft = () => localStorage.removeItem(DRAFT_KEY(requestId));

  // ── QR scan handler ────────────────────────────────────────────
  const handleScan = (raw) => {
    setScanMsg('');
    if (!raw.startsWith('ITEM:')) {
      setScanMsg(`Unrecognized QR: "${raw}". Expected ITEM:… format.`);
      return;
    }
    const scannedNumber = raw.slice(5).trim();
    const idx = items.findIndex(i =>
      i.item_number && i.item_number.trim().toLowerCase() === scannedNumber.toLowerCase()
    );
    if (idx === -1) {
      setScanMsg(`Item "${scannedNumber}" not found in this request.`);
      return;
    }
    // Highlight row and scroll to it
    setHighlightIdx(idx);
    itemRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setScanMsg(`Matched: ${items[idx].description_1} · ${items[idx].item_number} · ${items[idx].uom}`);
    setTimeout(() => { setHighlightIdx(null); setScanMsg(''); }, 4000);
  };

  // ── Submit issue ───────────────────────────────────────────────
  const submit = async () => {
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/issues', {
        request_id: requestId || null,
        project_id: request.project_id,
        receiver_id: receiverId || null,
        items: items.map(i => ({
          stock_item_id: i.stock_item_id || null,
          item_number: i.item_number,
          description_1: i.description_1,
          description_2: i.description_2 || null,
          uom: i.uom,
          quantity_issued: parseFloat(i.quantity_issued),
          batch_number: i.batch_number || null,
        })),
      });
      clearDraft();
      setIssued(data);
      setShowPreview(false);
    } catch (err) { setError(err.response?.data?.error || 'Failed to issue'); }
    finally { setLoading(false); }
  };

  const downloadDN = () => {
    window.open(
      `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/issues/${issued.id}/delivery-note?token=${localStorage.getItem('token')}`,
      '_blank'
    );
  };

  // ── Success screen ─────────────────────────────────────────────
  if (issued) return (
    <div className="max-w-md mx-auto text-center space-y-4 py-12">
      <div className="text-5xl">✅</div>
      <h2 className="text-2xl font-bold text-gray-800">Material Issued!</h2>
      <p className="text-gray-500">Delivery Note: <strong>{issued.delivery_note_id}</strong></p>
      <button onClick={downloadDN} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 w-full">
        📄 Download Delivery Note PDF
      </button>
      <button onClick={() => navigate('/storekeeper')} className="border px-6 py-3 rounded-xl w-full text-sm">
        Back to Dashboard
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Issue Material</h2>

      {/* Reference + request info banner */}
      {request && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-center gap-4 flex-wrap">
          {request.request_number && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-400 font-medium uppercase tracking-wide">Ref</span>
              <span className="font-mono font-bold text-blue-800">{request.request_number}</span>
            </div>
          )}
          <div className="text-sm text-gray-600">
            <strong>{request.project_name}</strong> · {request.requester_name}
            {request.requester_position && <span className="text-gray-400"> ({request.requester_position})</span>}
          </div>
          {request.request_number && (
            <span className="ml-auto text-xs text-blue-300">{request.created_at?.slice(0,10)}</span>
          )}
        </div>
      )}

      <div className="space-y-4">
        {/* Receiver */}
        <div className="bg-white rounded-xl border p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Receiver (Authorized Requester)</label>
          <select value={receiverId} onChange={e => setReceiverId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Select receiver…</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.position || u.email}</option>)}
          </select>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">Items to Issue</h3>
            <button
              onClick={() => { setScanMsg(''); setScanning(true); }}
              className="flex items-center gap-1.5 text-xs border border-blue-300 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5A2.5 2.5 0 0116 18H8a2.5 2.5 0 01-2.5-2.5V8A2.5 2.5 0 018 5.5h8A2.5 2.5 0 0118.5 8v.5" />
              </svg>
              Scan QR
            </button>
          </div>

          {/* Scan result banner */}
          {scanMsg && (
            <div className={`text-sm px-3 py-2 rounded-lg mb-3 flex items-center justify-between
              ${scanMsg.startsWith('Matched') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
              <span>{scanMsg}</span>
              <button onClick={() => setScanMsg('')} className="ml-2 text-current opacity-60 hover:opacity-100">×</button>
            </div>
          )}

          {items.map((item, idx) => {
            const onHand    = parseFloat(item.qty_on_hand ?? 0);
            const requested = parseFloat(item.quantity_requested);
            const sufficient = onHand >= requested;
            const isHighlighted = highlightIdx === idx;
            return (
              <div
                key={idx}
                ref={el => itemRefs.current[idx] = el}
                className={`border rounded-lg p-3 mb-2 transition-all duration-300
                  ${isHighlighted ? 'border-green-400 bg-green-50 ring-2 ring-green-300' : !sufficient ? 'border-red-200 bg-red-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{item.description_1}</div>
                    {item.description_2 && <div className="text-xs text-gray-400">{item.description_2}</div>}
                  </div>
                  {isHighlighted && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0">✓ Scanned</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mb-3 font-mono">{item.item_number || '—'} · {item.uom}</div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-500 mb-0.5">Requested</div>
                    <div className="font-bold text-gray-800">{requested}</div>
                  </div>
                  <div className={`rounded-lg p-2 text-center ${sufficient ? 'bg-green-50' : 'bg-red-100'}`}>
                    <div className="text-xs text-gray-500 mb-0.5">On Hand</div>
                    <div className={`font-bold ${sufficient ? 'text-green-700' : 'text-red-600'}`}>
                      {onHand}{!sufficient && <span className="text-xs ml-1">⚠</span>}
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-500 mb-0.5">Issue Qty</div>
                    <input
                      type="number" min="0" step="any"
                      value={item.quantity_issued}
                      onChange={e => updateItem(idx, 'quantity_issued', e.target.value)}
                      className="w-full text-center font-bold text-blue-700 bg-transparent border-none outline-none text-sm p-0"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Batch / Lot Number <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LOT-2026-001"
                    value={item.batch_number}
                    onChange={e => updateItem(idx, 'batch_number', e.target.value)}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>

                {!sufficient && (
                  <div className="text-xs text-red-600 bg-red-100 rounded px-2 py-1 mt-2">
                    ⚠ Insufficient stock — on hand ({onHand}) is less than requested ({requested}). Adjust issue qty.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        {draftSaved && <p className="text-green-600 text-sm bg-green-50 px-3 py-2 rounded-lg">Draft saved.</p>}

        {/* Save + Confirm buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={saveDraft}
            className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50"
          >
            💾 Save Draft
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700"
          >
            ✅ Confirm Issue
          </button>
        </div>
      </div>

      {/* QR scanner modal */}
      <QRScanner isOpen={scanning} onClose={() => setScanning(false)} onScan={handleScan} />

      {/* Preview + Confirm Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Delivery Note Preview</h3>
                {request?.request_number && (
                  <p className="text-xs text-gray-400 mt-0.5">Ref: <span className="font-mono">{request.request_number}</span></p>
                )}
              </div>
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
                <div><span className="text-gray-500">Project:</span> <strong>{request?.project_name}</strong></div>
                {request?.request_number && (
                  <div><span className="text-gray-500">Request Ref:</span> <strong>{request.request_number}</strong></div>
                )}
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
                        <td className="px-2 py-1.5 font-medium">
                          {item.description_1}{item.description_2 ? ` / ${item.description_2}` : ''}
                        </td>
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
                  <div className="text-gray-400">(Storekeeper)</div>
                  <div className="mt-3 text-gray-500">Signature: ______________________</div>
                  <div className="mt-1 text-gray-500">Date: ___________________________</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-0.5">Received By:</div>
                  <div className="font-bold">{selectedReceiver?.name || '—'}</div>
                  <div className="text-gray-400">({selectedReceiver?.position || 'Requester'})</div>
                  <div className="mt-3 text-gray-500">Signature: ______________________</div>
                  <div className="mt-1 text-gray-500">Date: ___________________________</div>
                </div>
              </div>
            </div>

            {error && <p className="mx-6 text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-3 px-6 py-4 border-t">
              <button onClick={() => setShowPreview(false)} className="flex-1 border py-2.5 rounded-xl text-sm">
                ← Back to Edit
              </button>
              <button onClick={submit} disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Issuing…' : '✅ Confirm & Generate PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
