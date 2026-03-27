import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export default function IncomingRequests() {
  const [requests, setRequests] = useState([]);
  const [detail, setDetail] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const navigate = useNavigate();

  const load = () => api.get('/requests?status=pending').then(r => setRequests(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const openDetail = async id => {
    const { data } = await api.get(`/requests/${id}`);
    setDetail(data); setShowReject(false); setRejectReason('');
  };

  const reject = async () => {
    await api.put(`/requests/${detail.id}/reject`, { rejection_reason: rejectReason });
    setDetail(null); load();
  };

  const goIssue = () => {
    navigate(`/storekeeper/issue/${detail.id}`);
  };

  const cols = [
    { key: 'created_at', header: 'Date', render: v => v?.slice(0,10) },
    { key: 'project_name', header: 'Project' },
    { key: 'requester_name', header: 'Requester' },
    { key: 'requester_position', header: 'Position' },
    { key: 'item_count', header: 'Items' },
    { key: 'status', header: 'Status', render: v => <Badge value={v} /> },
    { key: 'id', header: '', render: id => <button onClick={() => openDetail(id)} className="text-xs text-blue-600 hover:underline">Review</button> },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Incoming Requests</h2>
      {requests.length === 0
        ? <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No pending requests</div>
        : <Table columns={cols} data={requests} />
      }

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title="Review Request" wide>
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Project:</span> <strong>{detail.project_name}</strong></div>
              <div><span className="text-gray-500">Requester:</span> {detail.requester_name}</div>
              <div><span className="text-gray-500">Position:</span> {detail.requester_position || '—'}</div>
              <div><span className="text-gray-500">Date:</span> {detail.created_at?.slice(0,10)}</div>
            </div>
            {detail.notes && <div className="bg-gray-50 rounded-lg p-3 text-sm"><strong>Notes:</strong> {detail.notes}</div>}
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-gray-50"><tr>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Item No.</th>
                <th className="px-3 py-2 text-center">Requested</th>
                <th className="px-3 py-2 text-center">On Hand</th>
                <th className="px-3 py-2 text-left">UOM</th>
              </tr></thead>
              <tbody>{detail.items?.map((item, i) => {
                const onHand = parseFloat(item.qty_on_hand ?? 0);
                const requested = parseFloat(item.quantity_requested);
                const sufficient = onHand >= requested;
                return (
                  <tr key={i} className={`border-t ${!sufficient ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-2">{item.description_1}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{item.item_number || '—'}</td>
                    <td className="px-3 py-2 text-center font-semibold">{requested}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`font-bold ${sufficient ? 'text-green-600' : 'text-red-600'}`}>
                        {onHand}
                      </span>
                      {!sufficient && (
                        <span className="ml-1 text-xs text-red-500">⚠ Low</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{item.uom}</td>
                  </tr>
                );
              })}</tbody>
            </table>

            {showReject ? (
              <div className="space-y-2">
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                  placeholder="Reason for rejection (e.g. No stock available)…"
                  className="w-full border rounded-lg px-3 py-2 text-sm" autoFocus />
                <div className="flex gap-3">
                  <button onClick={reject} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium">Confirm Reject</button>
                  <button onClick={() => setShowReject(false)} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 pt-2">
                <button onClick={goIssue} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700">📤 Issue Material</button>
                <button onClick={() => setShowReject(true)} className="flex-1 bg-red-50 text-red-600 border border-red-200 py-2.5 rounded-lg text-sm font-medium hover:bg-red-100">❌ Reject</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
