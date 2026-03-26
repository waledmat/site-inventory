import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export default function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [detail, setDetail] = useState(null);
  const [escalateNote, setEscalateNote] = useState('');

  const load = () => api.get('/requests').then(r => setRequests(r.data));
  useEffect(() => { load(); }, []);

  const openDetail = async id => {
    const { data } = await api.get(`/requests/${id}`);
    setDetail(data);
  };

  const escalate = async () => {
    await api.put(`/requests/${detail.id}/escalate`, { notes: escalateNote });
    setDetail(null); load();
  };

  const cols = [
    { key: 'created_at', header: 'Date', render: v => v?.slice(0,10) },
    { key: 'project_name', header: 'Project' },
    { key: 'item_count', header: 'Items' },
    { key: 'status', header: 'Status', render: v => <Badge value={v} /> },
    { key: 'rejection_reason', header: 'Rejection Reason', render: v => v || '—' },
    { key: 'id', header: '', render: id => <button onClick={() => openDetail(id)} className="text-xs text-blue-600 hover:underline">View</button> },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">My Requests</h2>
      <Table columns={cols} data={requests} />

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={`Request — ${detail?.project_name}`} wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <div><span className="text-gray-500">Status:</span> <Badge value={detail.status} /></div>
              <div><span className="text-gray-500">Date:</span> {detail.created_at?.slice(0,10)}</div>
            </div>
            {detail.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <strong>Rejection reason:</strong> {detail.rejection_reason}
              </div>
            )}
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-gray-50"><tr>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Item No.</th>
                <th className="px-3 py-2 text-left">Qty</th>
                <th className="px-3 py-2 text-left">UOM</th>
              </tr></thead>
              <tbody>{detail.items?.map((item, i) => (
                <tr key={i} className="border-t"><td className="px-3 py-2">{item.description_1}</td>
                  <td className="px-3 py-2">{item.item_number || '—'}</td>
                  <td className="px-3 py-2">{item.quantity_requested}</td>
                  <td className="px-3 py-2">{item.uom}</td>
                </tr>
              ))}</tbody>
            </table>
            {detail.status === 'rejected' && (
              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">Escalate to Project Coordinator</p>
                <textarea value={escalateNote} onChange={e => setEscalateNote(e.target.value)}
                  placeholder="Add a note about why you're escalating…" rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <button onClick={escalate} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
                  🚨 Escalate to Coordinator
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
