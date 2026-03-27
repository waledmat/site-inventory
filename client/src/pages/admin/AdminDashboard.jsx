import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/axiosInstance';
import StatCard from '../../components/common/StatCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [lowStock, setLowStock] = useState([]);

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {});
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
    api.get('/reports/summary').then(r => setSummary(r.data)).catch(() => {});
    api.get('/reports/kpis').then(r => setKpis(r.data)).catch(() => {});
    api.get('/stock/low-stock').then(r => setLowStock(r.data)).catch(() => {});
  }, []);

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
        <StatCard title="Total Users" value={users.length} icon="👥" color="blue" />
        <StatCard title="Active Projects" value={projects.filter(p => p.is_active).length} icon="🏗️" color="green" />
        <StatCard title="Storekeepers" value={users.filter(u => u.role === 'storekeeper').length} icon="🏪" color="gray" />
        <StatCard title="Requesters" value={users.filter(u => u.role === 'requester').length} icon="📝" color="yellow" />
      </div>

      {/* KPI cards */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Pending Requests</p>
            <p className={`text-3xl font-bold ${kpis.pending_requests > 0 ? 'text-orange-500' : 'text-gray-800'}`}>{kpis.pending_requests}</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Issued This Month</p>
            <p className="text-3xl font-bold text-blue-600">{kpis.issued_this_month}</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Low Stock Items</p>
            <p className={`text-3xl font-bold ${kpis.low_stock_count > 0 ? 'text-red-500' : 'text-gray-800'}`}>{kpis.low_stock_count}</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Requests (7 days)</p>
            <p className="text-3xl font-bold text-gray-800">{kpis.requests_last_7_days}</p>
          </div>
        </div>
      )}

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
    </div>
  );
}
