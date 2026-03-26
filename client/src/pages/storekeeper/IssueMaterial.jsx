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

  useEffect(() => {
    if (requestId) {
      api.get(`/requests/${requestId}`).then(r => {
        setRequest(r.data);
        setReceiverId(r.data.requester_id || '');
        setItems(r.data.items?.map(i => ({ ...i, quantity_issued: i.quantity_requested })) || []);
      });
    }
    api.get('/users?role=requester').then(r => setUsers(r.data)).catch(() => {});
  }, [requestId]);

  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
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
        }))
      });
      setIssued(data);
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
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-white rounded-xl border p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Receiver (Authorized Requester)</label>
          <select value={receiverId} onChange={e => setReceiverId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Select receiver…</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.position || u.email}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Items to Issue</h3>
          {items.map((item, idx) => (
            <div key={idx} className="border rounded-lg p-3 mb-2">
              <div className="text-sm font-medium text-gray-800">{item.description_1}</div>
              <div className="text-xs text-gray-500 mb-2">{item.item_number || '—'} · {item.uom}</div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Requested: {item.quantity_requested}</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Issue Qty</label>
                  <input type="number" min="0.001" step="any" value={item.quantity_issued}
                    onChange={e => { const u = [...items]; u[idx].quantity_issued = e.target.value; setItems(u); }}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm mt-0.5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Issuing…' : '✅ Confirm Issue & Generate Delivery Note'}
        </button>
      </form>
    </div>
  );
}
