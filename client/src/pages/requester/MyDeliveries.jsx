import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

export default function MyDeliveries() {
  const [issues, setIssues] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/issues').then(r => { setIssues(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const openDetail = async id => {
    const { data } = await api.get(`/issues/${id}`);
    setDetail(data);
  };

  const downloadDN = (id, dn) => {
    const token = localStorage.getItem('token');
    window.open(`/api/issues/${id}/delivery-note?token=${token}`, '_blank');
  };

  const cols = [
    { key: 'created_at', header: 'Date', render: v => v?.slice(0, 10) },
    { key: 'project_name', header: 'Project' },
    { key: 'delivery_note_id', header: 'DN Number', render: v => <span className="font-mono text-blue-700">{v}</span> },
    { key: 'storekeeper_name', header: 'Issued By' },
    { key: 'item_count', header: 'Items' },
    {
      key: 'id', header: 'Actions',
      render: (id, row) => (
        <div className="flex gap-3">
          <button onClick={() => openDetail(id)} className="text-xs text-blue-600 hover:underline">View</button>
          <button onClick={() => downloadDN(id, row.delivery_note_id)} className="text-xs text-green-600 hover:underline">Download PDF</button>
        </div>
      )
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">My Deliveries</h2>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : issues.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-4xl mb-3">📦</div>
          <p className="text-gray-500 font-medium">No deliveries yet</p>
          <p className="text-gray-400 text-sm mt-1">Issued materials will appear here once your requests are fulfilled.</p>
        </div>
      ) : (
        <Table columns={cols} data={issues} />
      )}

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={`Delivery Note — ${detail?.delivery_note_id}`} wide>
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Project:</span> <strong>{detail.project_name}</strong></div>
              <div><span className="text-gray-500">Issued By:</span> {detail.storekeeper_name}</div>
              <div><span className="text-gray-500">Receiver:</span> {detail.receiver_name || '—'}</div>
              <div><span className="text-gray-500">Date:</span> {detail.created_at?.slice(0, 10)}</div>
            </div>

            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Item No.</th>
                  <th className="px-3 py-2 text-center">Qty Issued</th>
                  <th className="px-3 py-2 text-left">UOM</th>
                  <th className="px-3 py-2 text-left">Batch</th>
                </tr>
              </thead>
              <tbody>
                {detail.items?.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{item.description_1}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{item.item_number || '—'}</td>
                    <td className="px-3 py-2 text-center font-semibold text-blue-700">{item.quantity_issued}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{item.uom}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{item.batch_number || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button onClick={() => downloadDN(detail.id, detail.delivery_note_id)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              📄 Download Delivery Note PDF
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
