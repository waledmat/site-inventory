import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/axiosInstance';

export default function IssueMaterial() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [items, setItems] = useState([]);
  const [receiverId, setReceiverId] = useState('');
  const [users, setUsers] = useState([]);
  const [issued, setIssued] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (requestId) {
      api.get(`/requests/${requestId}`).then(r => {
        setRequest(r.data);
        setReceiverId(r.data.requester_id || '');
        setItems(r.data.items?.map(i => ({
          ...i,
          quantity_issued: i.quantity_requested,
          batch_number: '',
        })) || []);
      });
    }
    api.get('/users?role=requester').then(r => setUsers(r.data)).catch(() => {});
  }, [requestId]);

  const selectedReceiver = users.find(u => String(u.id) === String(receiverId));

  const updateItem = (idx, field, value) => {
    setItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u; });
  };

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
        }))
      });
      setIssued(data);
      setShowPreview(false);
    } catch (err) { setError(err.response?.data?.error || 'Failed to issue'); }
    finally { setLoading(false); }
  };

  const downloadDN = () => {
    window.open(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/issues/${issued.id}/delivery-note?token=${localStorage.getItem('token')}`, '_blank');
  };

  if (issued) return (
    <div className="max-w-md mx-auto text-center space-y-4 py-12">
      <div className="text-5xl">✅</div>
      <h2 className="text-2xl font-bold text-gray-800">Material Issued!</h2>
      <p className="text-gray-500">Delivery Note: <strong>{issued.delivery_note_id}</strong></p>
      <button onClick={downloadDN} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 w-full">
        📄 Download Delivery Note PDF
      </button>
      <button onClick={() => navigate('/storekeeper')} className="border px-6 py-3 rounded-xl w-full text-sm">Back to Dashboard</button>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Issue Material</h2>
      {request && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm">
          <strong>Request:</strong> {request.project_name} · {request.requester_name} ({request.requester_position})
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
          <h3 className="font-semibold text-gray-700 mb-3">Items to Issue</h3>
          {items.map((item, idx) => {
            const onHand = parseFloat(item.qty_on_hand ?? 0);
            const requested = parseFloat(item.quantity_requested);
            const sufficient = onHand >= requested;
            return (
              <div key={idx} className={`border rounded-lg p-3 mb-2 ${!sufficient ? 'border-red-200 bg-red-50' : ''}`}>
                <div className="text-sm font-medium text-gray-800">{item.description_1}</div>
                <div className="text-xs text-gray-500 mb-3">{item.item_number || '—'} · {item.uom}</div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-500 mb-0.5">Requested</div>
                    <div className="font-bold text-gray-800">{requested}</div>
                  </div>
                  <div className={`rounded-lg p-2 text-center ${sufficient ? 'bg-green-50' : 'bg-red-100'}`}>
                    <div className="text-xs text-gray-500 mb-0.5">On Hand</div>
                    <div className={`font-bold ${sufficient ? 'text-green-700' : 'text-red-600'}`}>
                      {onHand}
                      {!sufficient && <span className="text-xs ml-1">⚠</span>}
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
                  <label className="text-xs text-gray-500 block mb-1">Batch / Lot Number <span className="text-gray-400">(optional)</span></label>
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
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700"
        >
          👁 Preview Delivery Note
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Delivery Note Preview</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            {/* DN preview body */}
            <div className="px-6 py-5 space-y-4 font-mono text-sm">
              {/* Header block */}
              <div className="text-center border-b pb-3">
                <div className="font-bold text-base">SITE INVENTORY MANAGEMENT SYSTEM</div>
                <div className="font-semibold text-gray-700">DELIVERY NOTE</div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-500">DN Number:</span> <strong className="text-gray-400">[auto-generated]</strong></div>
                <div><span className="text-gray-500">Date:</span> <strong>{new Date().toISOString().slice(0,10)}</strong></div>
                <div className="col-span-2"><span className="text-gray-500">Project:</span> <strong>{request?.project_name}</strong></div>
              </div>

              {/* Items table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left w-6">#</th>
                      <th className="px-2 py-2 text-left">Item No.</th>
                      <th className="px-2 py-2 text-left">Description</th>
                      <th className="px-2 py-2 text-left">Batch No.</th>
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

              {/* Footer signatures */}
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

            {/* Actions */}
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
