import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/axiosInstance';
import StatCard from '../../components/common/StatCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function SuperUserDashboard() {
  const [summary, setSummary] = useState(null);
  const [pending, setPending] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    api.get('/reports/summary').then(r => setSummary(r.data)).catch(() => {});
    api.get('/returns/pending').then(r => setPending(r.data)).catch(() => {});
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  const today = new Date().toISOString().slice(0,10);
  const overdue = pending.filter(p => p.issue_date < today);

  const chartData = summary?.issued?.map(row => ({
    name: row.project_name?.slice(0,12),
    Issued: parseInt(row.total_qty) || 0,
    Returned: parseInt(summary.returned?.find(r => r.project_name === row.project_name)?.total_returned) || 0,
  })) || [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Super User Dashboard</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Projects" value={projects.filter(p => p.is_active).length} icon="🏗️" color="blue" />
        <StatCard title="Pending Returns" value={pending.length} icon="⏳" color="yellow" />
        <StatCard title="Overdue" value={overdue.length} icon="⚠️" color="red" />
        <StatCard title="Total Projects" value={projects.length} icon="📋" color="gray" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/superuser/upload" className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700">📂 Upload Packing List</Link>
        <Link to="/superuser/reports" className="border px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50">📊 Reports</Link>
        <Link to="/superuser/daily-log" className="border px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50">📅 Daily Log</Link>
      </div>
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-gray-700 mb-4">Issued vs Returned by Project</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip /><Legend />
              <Bar dataKey="Issued" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="Returned" fill="#22c55e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* Project Duration */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-700 mb-3">Project Timelines</h3>
        <div className="space-y-2">
          {projects.filter(p => p.is_active).map(p => {
            const start = p.start_date ? new Date(p.start_date) : null;
            const end = p.end_date ? new Date(p.end_date) : null;
            const now = new Date();
            const remaining = end ? Math.ceil((end - now) / 86400000) : null;
            return (
              <div key={p.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <span className="font-medium">{p.name}</span>
                <div className="flex gap-4 text-xs text-gray-500">
                  {p.start_date && <span>Start: {p.start_date.slice(0,10)}</span>}
                  {p.end_date && <span>End: {p.end_date.slice(0,10)}</span>}
                  {remaining !== null && (
                    <span className={remaining < 0 ? 'text-red-600 font-bold' : remaining < 7 ? 'text-orange-500 font-bold' : 'text-green-600'}>
                      {remaining < 0 ? `${Math.abs(remaining)}d overdue` : `${remaining}d left`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
