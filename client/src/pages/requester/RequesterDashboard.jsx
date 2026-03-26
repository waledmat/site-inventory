import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/axiosInstance';
import StatCard from '../../components/common/StatCard';
import { useAuth } from '../../context/AuthContext';

export default function RequesterDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);

  useEffect(() => { api.get('/requests').then(r => setRequests(r.data)).catch(() => {}); }, []);

  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    issued: requests.filter(r => r.status === 'issued').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    escalated: requests.filter(r => r.status === 'escalated').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Welcome, {user?.name}</h2>
        <p className="text-gray-500 text-sm mt-1">{user?.position}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Pending" value={counts.pending} icon="⏳" color="yellow" />
        <StatCard title="Issued" value={counts.issued} icon="✅" color="green" />
        <StatCard title="Rejected" value={counts.rejected} icon="❌" color="red" />
        <StatCard title="Escalated" value={counts.escalated} icon="🚨" color="yellow" />
      </div>
      <div className="flex gap-3">
        <Link to="/requester/submit" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700">📝 New Request</Link>
        <Link to="/requester/requests" className="border px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">📋 View All Requests</Link>
      </div>
      {requests.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-700 mb-3">Recent Requests</h3>
          <div className="space-y-2">
            {requests.slice(0,5).map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <span>{r.project_name} — {r.item_count} item(s)</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  r.status === 'issued' ? 'bg-green-100 text-green-700' :
                  r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  r.status === 'escalated' ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
