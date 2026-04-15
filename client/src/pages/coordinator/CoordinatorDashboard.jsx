import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
    purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value ?? '—'}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CoordinatorDashboard() {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [detail, setDetail] = useState(null);
  const [resolution, setResolution] = useState('');

  const load = () => {
    api.get('/requests?status=escalated').then(r => setRequests(r.data)).catch(() => {});
    api.get('/requests/escalation-stats').then(r => setStats(r.data)).catch(() => {});
  };
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

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Pending Escalations" value={stats.pending} color="orange" />
          <StatCard label="Resolved This Week" value={stats.resolved_this_week} color="green" />
          <StatCard label="Total Resolved" value={stats.resolved_total} color="blue" />
          <StatCard label="Avg Resolution Time" value={stats.avg_resolution_hours ? `${stats.avg_resolution_hours}h` : '—'} sub="average hours to resolve" color="purple" />
        </div>
      )}

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
              <div><span className="text-gray-500">Date:</span> {detail.created_at?.slice(0,10)}</div>
            </div>

            {/* Rejection reason from storekeeper */}
            {detail.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                <p className="font-semibold text-red-700 mb-0.5">Storekeeper Rejection Reason</p>
                <p className="text-red-600">{detail.rejection_reason}</p>
              </div>
            )}

            {/* Escalation notes from requester */}
            {detail.escalation?.escalation_notes && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm">
                <p className="font-semibold text-orange-700 mb-0.5">Requester Escalation Notes</p>
                <p className="text-orange-600">{detail.escalation.escalation_notes}</p>
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
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{item.description_1}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{item.item_number || '—'}</td>
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
