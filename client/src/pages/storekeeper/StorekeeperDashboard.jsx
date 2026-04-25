import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/axiosInstance';
import StatCard from '../../components/common/StatCard';
import CostSummaryPanel from '../../components/common/CostSummaryPanel';
import ListModal from '../../components/common/ListModal';
import { useAuth } from '../../context/AuthContext';

const num = (n) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function StorekeeperDashboard() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [requests, setRequests] = useState([]);
  const [issues, setIssues] = useState([]);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    api.get('/returns/pending').then(r => setPending(r.data)).catch(() => {});
    api.get('/requests?status=pending').then(r => setRequests(r.data)).catch(() => {});
    const today = new Date().toISOString().slice(0,10);
    api.get(`/issues?date_from=${today}&date_to=${today}`).then(r => setIssues(r.data)).catch(() => {});
  }, []);

  const today = new Date().toISOString().slice(0,10);
  const overdue = pending.filter(p => p.issue_date < today);

  const pendingColumns = [
    { key: 'project_name',     header: 'Project' },
    { key: 'item_number',      header: 'Item No.' },
    { key: 'description_1',    header: 'Description' },
    { key: 'quantity_issued',  header: 'Issued',    align: 'right', render: v => num(v) },
    { key: 'qty_returned',     header: 'Returned',  align: 'right', render: v => num(v) },
    { key: 'qty_remaining',    header: 'Remaining', align: 'right', render: v => num(v) },
    { key: 'issue_date',       header: 'Issue Date', render: v => v?.slice(0, 10) },
    { key: 'receiver_name',    header: 'Receiver' },
  ];
  const issuesColumns = [
    { key: 'dn_number',        header: 'DN #' },
    { key: 'project_name',     header: 'Project' },
    { key: 'receiver_name',    header: 'Receiver' },
    { key: 'issue_date',       header: 'Date', render: v => v?.slice(0, 10) },
  ];

  const openModal = (key) => {
    if (key === 'issued_today') setModal({ title: 'Issued Today', columns: issuesColumns, rows: issues, loading: false });
    if (key === 'overdue')      setModal({ title: 'Overdue Returns', columns: pendingColumns, rows: overdue, loading: false });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Welcome, {user?.name}</h2>
        <p className="text-gray-500 text-sm mt-1">Storekeeper Dashboard</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Incoming Requests" value={requests.length} icon="📥" color="blue"   to="/storekeeper/incoming" />
        <StatCard title="Issued Today"      value={issues.length}   icon="📤" color="green"  onClick={() => openModal('issued_today')} />
        <StatCard title="Pending Returns"   value={pending.length}  icon="⏳"  color="yellow" to="/storekeeper/returns" />
        <StatCard title="Overdue"           value={overdue.length}  icon="⚠️" color="red"    onClick={() => openModal('overdue')} />
      </div>
      <CostSummaryPanel title="Material Value (Your Projects)" />

      <div className="flex flex-wrap gap-3">
        <Link to="/storekeeper/incoming" className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700">📥 Incoming Requests</Link>
        <Link to="/storekeeper/pending" className="border px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50">⏳ Pending Returns</Link>
        <Link to="/storekeeper/stock" className="border px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50">🔍 Stock Search</Link>
        <button
          onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'}/reports/packing-list?token=${localStorage.getItem('token')}`, '_blank')}
          className="border px-4 py-2.5 rounded-xl text-sm hover:bg-green-50 text-green-700 border-green-300 font-medium">
          📦 On Hand Qty Report
        </button>
      </div>
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-700 mb-2">⚠️ Overdue Returns</h3>
          {overdue.slice(0,3).map(item => (
            <div key={item.id} className="text-sm text-red-600 py-1 border-b border-red-100 last:border-0">
              {item.description_1} — Remaining: {item.qty_remaining} {item.uom} · {item.project_name}
            </div>
          ))}
          {overdue.length > 3 && <Link to="/storekeeper/returns" className="text-xs text-red-500 underline mt-1 block">View all {overdue.length} overdue</Link>}
        </div>
      )}

      {modal && (
        <ListModal
          title={modal.title}
          columns={modal.columns}
          rows={modal.rows}
          loading={modal.loading}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
