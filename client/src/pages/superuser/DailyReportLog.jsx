import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';

export default function DailyReportLog() {
  const [logs, setLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({ project_id: '', date_from: '', date_to: '' });

  const load = (f = filters) => {
    const params = new URLSearchParams();
    if (f.project_id) params.set('project_id', f.project_id);
    if (f.date_from)  params.set('date_from', f.date_from);
    if (f.date_to)    params.set('date_to', f.date_to);
    api.get(`/reports/daily-log?${params}`).then(r => setLogs(r.data)).catch(() => {});
  };

  useEffect(() => {
    load();
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []); // eslint-disable-line

  const clear = () => {
    const empty = { project_id: '', date_from: '', date_to: '' };
    setFilters(empty); load(empty);
  };

  const hasFilters = Object.values(filters).some(Boolean);

  const cols = [
    { key: 'report_date', header: 'Date', render: v => v?.slice(0,10) },
    { key: 'project_name', header: 'Project' },
    { key: 'issued_count', header: 'Issued' },
    { key: 'returned_count', header: 'Returned' },
    { key: 'pending_count', header: 'Pending' },
    { key: 'overdue_count', header: 'Overdue', render: v => <span className={v > 0 ? 'text-red-600 font-bold' : ''}>{v}</span> },
    { key: 'sent_at', header: 'Sent At', render: v => v ? new Date(v).toLocaleString() : '—' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Daily Report Log</h2>

      <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
          <select value={filters.project_id} onChange={e => setFilters(f => ({ ...f, project_id: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date From</label>
          <input type="date" value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date To</label>
          <input type="date" value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={() => load()} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Apply
        </button>
        {hasFilters && (
          <button onClick={clear} className="border px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            ✕ Clear
          </button>
        )}
      </div>

      {logs.length > 0 && <p className="text-xs text-gray-400 mb-2">{logs.length} records</p>}
      <Table columns={cols} data={logs} emptyText="No daily reports found" />
    </div>
  );
}
