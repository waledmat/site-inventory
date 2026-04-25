import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/axiosInstance';
import StatCard from '../../components/common/StatCard';
import CostSummaryPanel from '../../components/common/CostSummaryPanel';
import ListModal from '../../components/common/ListModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const startOfMonth = () => {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);
const sevenDaysAgo = () => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
const num = (n) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [modal, setModal] = useState(null); // { key, title, columns, rows, loading }
  const [pendingDeletions, setPendingDeletions] = useState([]);
  const [delActing, setDelActing] = useState(null); // project id currently being approved/rejected

  const loadPendingDeletions = () =>
    api.get('/projects/pending-deletions').then(r => setPendingDeletions(r.data)).catch(() => {});

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {});
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
    api.get('/reports/summary').then(r => setSummary(r.data)).catch(() => {});
    api.get('/reports/kpis').then(r => setKpis(r.data)).catch(() => {});
    api.get('/stock/low-stock').then(r => setLowStock(r.data)).catch(() => {});
    loadPendingDeletions();
  }, []);

  const approveDeletion = async (p) => {
    if (!window.confirm(
      `Approve deletion of "${p.name}"?\n\n` +
      `This project has ${p.stock_item_count} stock item(s) and ${p.issue_count} issue record(s). ` +
      `Approving will archive the project (is_active=false). Records are preserved.`
    )) return;
    setDelActing(p.id);
    try {
      await api.post(`/projects/${p.id}/approve-deletion`);
      await loadPendingDeletions();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve');
    } finally { setDelActing(null); }
  };

  const rejectDeletion = async (p) => {
    const reason = window.prompt(`Reject deletion request for "${p.name}"?\n\nReason (optional):`, '');
    if (reason === null) return;
    setDelActing(p.id);
    try {
      await api.post(`/projects/${p.id}/reject-deletion`, { rejection_reason: reason.trim() || null });
      await loadPendingDeletions();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject');
    } finally { setDelActing(null); }
  };

  async function openModal(key) {
    if (key === 'low_stock') {
      setModal({
        key, title: 'Low Stock Items', loading: false, rows: lowStock,
        columns: [
          { key: 'item_number',   header: 'Item No.' },
          { key: 'description_1', header: 'Description' },
          { key: 'project_name',  header: 'Project' },
          { key: 'qty_on_hand',   header: 'On Hand', align: 'right', render: v => num(v) },
          { key: 'reorder_point', header: 'Reorder At', align: 'right', render: v => num(v) },
          { key: 'uom',           header: 'UOM' },
        ],
      });
      return;
    }

    let url, title, columns;
    if (key === 'pending_requests') {
      url = '/requests?status=pending';
      title = 'Pending Requests';
      columns = [
        { key: 'request_number', header: 'Request #' },
        { key: 'project_name',   header: 'Project' },
        { key: 'requester_name', header: 'Requester' },
        { key: 'created_at',     header: 'Submitted', render: v => v?.slice(0, 10) },
        { key: 'status',         header: 'Status' },
      ];
    } else if (key === 'requests_7d') {
      url = `/requests?date_from=${sevenDaysAgo()}`;
      title = 'Requests — Last 7 Days';
      columns = [
        { key: 'request_number', header: 'Request #' },
        { key: 'project_name',   header: 'Project' },
        { key: 'requester_name', header: 'Requester' },
        { key: 'created_at',     header: 'Submitted', render: v => v?.slice(0, 10) },
        { key: 'status',         header: 'Status' },
      ];
    } else if (key === 'issued_month') {
      url = `/issues?date_from=${startOfMonth()}&date_to=${today()}`;
      title = 'Issued This Month';
      columns = [
        { key: 'dn_number',       header: 'DN #' },
        { key: 'project_name',    header: 'Project' },
        { key: 'receiver_name',   header: 'Receiver' },
        { key: 'storekeeper_name',header: 'Storekeeper' },
        { key: 'issue_date',      header: 'Date', render: v => v?.slice(0, 10) },
      ];
    } else {
      return;
    }

    setModal({ key, title, columns, rows: [], loading: true });
    try {
      const r = await api.get(url);
      setModal({ key, title, columns, rows: r.data || [], loading: false });
    } catch {
      setModal({ key, title, columns, rows: [], loading: false });
    }
  }

  const chartData = summary?.issued?.map(row => ({
    name: row.project_name?.slice(0, 12),
    Issued: parseInt(row.total_qty) || 0,
    Returned: parseInt(summary.returned?.find(r => r.project_name === row.project_name)?.total_returned) || 0,
  })) || [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>

      {/* User / Project stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users"     value={users.length}                                    icon="👥"  color="blue"   to="/admin/users" />
        <StatCard title="Active Projects" value={projects.filter(p => p.is_active).length}        icon="🏗️" color="green"  to="/admin/projects" />
        <StatCard title="Storekeepers"    value={users.filter(u => u.role === 'storekeeper').length} icon="🏪" color="gray"   to="/admin/users?role=storekeeper" />
        <StatCard title="Requesters"      value={users.filter(u => u.role === 'requester').length}   icon="📝" color="yellow" to="/admin/users?role=requester" />
      </div>

      {/* KPI cards */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Pending Requests"  value={kpis.pending_requests}     icon="⏱️" color={kpis.pending_requests > 0 ? 'yellow' : 'gray'} onClick={() => openModal('pending_requests')} />
          <StatCard title="Issued This Month" value={kpis.issued_this_month}    icon="📤" color="blue"                                          onClick={() => openModal('issued_month')} />
          <StatCard title="Low Stock Items"   value={kpis.low_stock_count}      icon="⚠️" color={kpis.low_stock_count > 0 ? 'red' : 'gray'}    onClick={() => openModal('low_stock')} />
          <StatCard title="Requests (7 days)" value={kpis.requests_last_7_days} icon="📅" color="gray"                                          onClick={() => openModal('requests_7d')} />
          <StatCard title="Rejection Rate"    value={`${kpis.rejection_rate ?? 0}%`} icon="🚫" color={kpis.rejection_rate > 20 ? 'red' : kpis.rejection_rate > 10 ? 'yellow' : 'gray'} />
        </div>
      )}

      {/* Pending project deletions — admin approval queue */}
      {pendingDeletions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-amber-800">
              ⏳ Pending Project Deletion Requests
              <span className="ml-2 text-sm font-normal text-amber-700">({pendingDeletions.length})</span>
            </h3>
          </div>
          <div className="space-y-2">
            {pendingDeletions.map(p => (
              <div key={p.id} className="bg-white border border-amber-200 rounded-lg p-3 flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[240px]">
                  <div className="font-semibold text-gray-800">
                    {p.project_number ? <span className="text-xs text-gray-500 mr-1">[{p.project_number}]</span> : null}
                    {p.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Requested by <strong>{p.pending_deletion_by_name || 'unknown'}</strong> on {new Date(p.pending_deletion_at).toLocaleString()}
                  </div>
                  {p.pending_deletion_reason && (
                    <div className="text-xs text-gray-600 mt-1 italic">"{p.pending_deletion_reason}"</div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {p.stock_item_count} stock item(s) · {p.issue_count} issue record(s) — will be preserved on archive
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveDeletion(p)} disabled={delActing === p.id}
                    className="bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium disabled:opacity-50">
                    {delActing === p.id ? '…' : '✓ Approve'}
                  </button>
                  <button onClick={() => rejectDeletion(p)} disabled={delActing === p.id}
                    className="border text-sm px-3 py-1.5 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50">
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Material value (cost-based) */}
      <CostSummaryPanel title="Material Value by Project" />

      {/* Top 5 most issued items */}
      {kpis?.top_items?.length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Top 5 Most Issued Items</h3>
          <div className="space-y-2">
            {kpis.top_items.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (item.total / kpis.top_items[0].total) * 100)}%` }}
                  />
                </div>
                <span className="text-sm text-gray-700 w-48 truncate">{item.description_1}</span>
                <span className="text-sm font-semibold text-gray-800 w-12 text-right">{item.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-red-700">⚠️ Low Stock Alert ({lowStock.length} items)</h3>
            <Link to="/admin/stock-adjustment" className="text-xs text-red-600 underline">Adjust Stock →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {lowStock.slice(0, 6).map(item => (
              <div key={item.id} className="bg-white border border-red-100 rounded-lg px-3 py-2 text-sm">
                <div className="font-medium text-gray-800">{item.item_number} — {item.description_1}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {item.project_name} · On Hand: <span className="text-red-600 font-semibold">{item.qty_on_hand}</span>
                  {' '}/ Reorder at: {item.reorder_point} {item.uom}
                </div>
              </div>
            ))}
          </div>
          {lowStock.length > 6 && (
            <p className="text-xs text-red-500 mt-2">+{lowStock.length - 6} more items below reorder point</p>
          )}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-gray-700 mb-4">Issued vs Returned by Project</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Issued" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Returned" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quick links */}
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold text-gray-700 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/stock-adjustment" className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600">
            📦 Stock Adjustment
          </Link>
          <Link to="/admin/audit-log" className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
            📋 Audit Log
          </Link>
          <Link to="/admin/users" className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            👥 Manage Users
          </Link>
          <Link to="/admin/projects" className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            🏗️ Manage Projects
          </Link>
        </div>
      </div>

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
