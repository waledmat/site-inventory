import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export default function CoordinatorDashboard() {
  const [requests, setRequests] = useState([]);
  const [detail, setDetail] = useState(null);
  const [resolution, setResolution] = useState('');

  const load = () => api.get('/requests?status=escalated').then(r => setRequests(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const openDetail = async id => {
    const { data } = await api.get(`/requests/${id}`);
    setDetail(data); setResolution('');
  };

  const resolve = async () => {
    await api.put(`/requests/${detail.id}/resolve`, { resolution });
    setDetail(null); load();
  };

  const cols = [
    { key: 'created_at', header: 'Date', render: v => v?.slice(0,10) },
    { key: 'project_name', header: 'Project' },
    { key: 'requester_name', header: 'Requester' },
    { key: 'requester_position', header: 'Position' },
    { key: 'item_count', header: 'Items' },
    { key: 'rejection_reason', header: 'Rejection Reason' },
    { key: 'status', header: 'Status', render: v => <Badge value={v} /> },
    { key: 'id', header: '', render: id => <button onClick={() => openDetail(id)} className="text-xs text-blue-600 hover:underline">Review</button> },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Escalated Requests</h2>
      <p className="text-gray-500 text-sm">These requests were rejected by the storekeeper and escalated by requesters.</p>
      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">✅ No escalated requests</div>
      ) : (
        <Table columns={cols} data={requests} />
      )}

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title="Review Escalation" wide>
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Project:</span> {detail.project_name}</div>
              <div><span className="text-gray-500">Requester:</span> {detail.requester_name}</div>
              <div><span className="text-gray-500">Position:</span> {detail.requester_position}</div>
            </div>
            {detail.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                <strong>Rejection reason:</strong> {detail.rejection_reason}
              </div>
            )}
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-gray-50"><tr>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Qty</th>
                <th className="px-3 py-2 text-left">UOM</th>
              </tr></thead>
              <tbody>{detail.items?.map((item, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{item.description_1}</td>
                  <td className="px-3 py-2">{item.quantity_requested}</td>
                  <td className="px-3 py-2">{item.uom}</td>
                </tr>
              ))}</tbody>
            </table>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resolution / Action Taken</label>
              <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={3}
                placeholder="e.g. Arranged procurement, stock will arrive on 2026-04-01…"
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3">
              <button onClick={resolve} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">✅ Mark Resolved</button>
              <button onClick={() => setDetail(null)} className="flex-1 border py-2 rounded-lg text-sm">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
