import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import TransactionHistoryModal from '../../components/common/TransactionHistoryModal';

export default function IncomingRequests() {
  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filterProject, setFilterProject] = useState('');
  const [filterName, setFilterName] = useState('');
  const [detail, setDetail] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [historyRef, setHistoryRef] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { api.get('/projects').then(r => setProjects(r.data)).catch(() => {}); }, []);

  const load = (projectId = '') => {
    const params = new URLSearchParams({ status: 'pending' });
    if (projectId) params.append('project_id', projectId);
    api.get(`/requests?${params}`).then(r => setRequests(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleProjectChange = e => {
    setFilterProject(e.target.value);
    load(e.target.value);
  };

  const openDetail = async id => {
    const { data } = await api.get(`/requests/${id}`);
    setDetail(data); setShowReject(false); setRejectReason('');
  };

  const reject = async () => {
    await api.put(`/requests/${detail.id}/reject`, { rejection_reason: rejectReason });
    setDetail(null); load(filterProject);
  };

  const goIssue = () => { navigate(`/storekeeper/issue/${detail.id}`); };

  const displayed = filterName
    ? requests.filter(r => r.requester_name?.toLowerCase().includes(filterName.toLowerCase()))
    : requests;

  const cols = [
    { key: 'request_number', header: 'Ref', render: v => v
      ? <button onClick={() => setHistoryRef(v)} className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200">{v}</button>
      : <span className="text-gray-300 text-xs">—</span>
    },
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

      <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3">
        <input value={filterName} onChange={e => setFilterName(e.target.value)}
          placeholder="Search by requester name…"
          className="flex-1 min-w-40 border rounded-lg px-3 py-2 text-sm" />
        <select value={filterProject} onChange={handleProjectChange}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(filterName || filterProject) && (
          <button onClick={() => { setFilterName(''); setFilterProject(''); load(''); }}
            className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 border rounded-lg">
            ✕ Clear
          </button>
        )}
      </div>

      {displayed.length === 0
        ? <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No pending requests</div>
        : <Table columns={cols} data={displayed} />
      }

      <TransactionHistoryModal refNumber={historyRef} onClose={() => setHistoryRef(null)} />

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title="Review Request" wide>
        {detail && (
          <div className="space-y-4">
            {detail.request_number && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                <span className="text-xs text-blue-500 font-medium uppercase tracking-wide">Ref</span>
                <span className="font-mono font-bold text-blue-800 text-base">{detail.request_number}</span>
                <span className="ml-auto text-xs text-blue-400">{detail.created_at?.slice(0,10)}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Project:</span> <strong>{detail.project_name}</strong></div>
              <div><span className="text-gray-500">Requester:</span> {detail.requester_name}</div>
              <div><span className="text-gray-500">Position:</span> {detail.requester_position || '—'}</div>
              <div><span className="text-gray-500">Status:</span> <strong>{detail.status}</strong></div>
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
                      <span className={`font-bold ${sufficient ? 'text-green-600' : 'text-red-600'}`}>{onHand}</span>
                      {!sufficient && <span className="ml-1 text-xs text-red-500">⚠ Low</span>}
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
