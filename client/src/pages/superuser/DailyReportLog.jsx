import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';

export default function DailyReportLog() {
  const [logs, setLogs] = useState([]);

  useEffect(() => { api.get('/reports/daily-log').then(r => setLogs(r.data)).catch(() => {}); }, []);

  const cols = [
    { key: 'report_date', header: 'Date', render: v => v?.slice(0,10) },
    { key: 'project_name', header: 'Project' },
    { key: 'issued_count', header: 'Issued' },
    { key: 'returned_count', header: 'Returned' },
    { key: 'pending_count', header: 'Pending' },
    { key: 'overdue_count', header: 'Overdue', render: v => <span className={v > 0 ? 'text-red-600 font-bold' : ''}>{v}</span> },
    { key: 'sent_at', header: 'Sent At', render: v => v ? new Date(v).toLocaleString() : '—' },
    { key: 'channel', header: 'Channel' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Daily Report Log</h2>
      <Table columns={cols} data={logs} emptyText="No daily reports sent yet" />
    </div>
  );
}
