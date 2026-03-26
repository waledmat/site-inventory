import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import StatCard from '../../components/common/StatCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {});
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
    api.get('/reports/summary').then(r => setSummary(r.data)).catch(() => {});
  }, []);

  const chartData = summary?.issued?.map(row => ({
    name: row.project_name?.slice(0, 12),
    Issued: parseInt(row.total_qty) || 0,
    Returned: parseInt(summary.returned?.find(r => r.project_name === row.project_name)?.total_returned) || 0,
  })) || [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={users.length} icon="👥" color="blue" />
        <StatCard title="Active Projects" value={projects.filter(p => p.is_active).length} icon="🏗️" color="green" />
        <StatCard title="Storekeepers" value={users.filter(u => u.role === 'storekeeper').length} icon="🏪" color="gray" />
        <StatCard title="Requesters" value={users.filter(u => u.role === 'requester').length} icon="📝" color="yellow" />
      </div>
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-gray-700 mb-4">Issued vs Returned by Project</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Issued" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="Returned" fill="#22c55e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
