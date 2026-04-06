import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/axiosInstance';
import QRScanner from '../../components/common/QRScanner';

export default function WMDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanOpen, setScanOpen] = useState(false);
  const navigate = useNavigate();

  const handleScan = (text) => {
    if (text.startsWith('BIN:'))      navigate('/wm/locations');
    else if (text.startsWith('ITEM:')) navigate('/wm/items');
    else if (text.startsWith('GRN:'))  navigate('/wm/grn');
    else if (text.startsWith('DO:'))   navigate('/wm/dispatch');
    else if (text.startsWith('CC:'))   navigate('/wm/cyclecount');
  };

  useEffect(() => {
    api.get('/wms/inventory/stats')
      .then(r => setStats(r.data))
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { title: 'Active Suppliers',  value: stats?.suppliers,       icon: '🏭', color: 'blue',   to: '/wm/suppliers' },
    { title: 'Item Master',       value: stats?.items,           icon: '📦', color: 'green',  to: '/wm/items' },
    { title: 'Warehouse Zones',   value: stats?.zones,           icon: '🗂️', color: 'purple', to: '/wm/locations' },
    { title: 'Pending GRNs',      value: stats?.pending_grn,     icon: '📥', color: 'yellow', to: '/wm/grn' },
    { title: 'Putaway Tasks',     value: stats?.pending_putaway, icon: '🔀', color: 'orange', to: '/wm/putaway' },
    { title: 'Low Stock Alerts',  value: stats?.low_stock,       icon: '⚠️', color: 'red',    to: '/wm/inventory' },
  ];

  const colorMap = {
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    green:  'bg-green-50 border-green-100 text-green-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
    yellow: 'bg-yellow-50 border-yellow-100 text-yellow-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
    red:    'bg-red-50 border-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Warehouse Dashboard</h2>
        <Link to="/"
          className="text-xs text-gray-400 hover:text-blue-600 border rounded-lg px-3 py-1.5 hover:border-blue-300 transition-colors">
          ← Module Selector
        </Link>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <Link key={c.title} to={c.to}
            className={`border rounded-xl p-5 hover:shadow-md transition-shadow ${colorMap[c.color]}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{c.icon}</span>
              {c.color === 'red' && stats?.low_stock > 0 && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
              {c.color === 'orange' && stats?.pending_putaway > 0 && (
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
              )}
            </div>
            <p className="text-xs font-medium opacity-70">{c.title}</p>
            <p className="text-3xl font-bold mt-1">
              {loading ? '…' : (c.value ?? 0)}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '+ New Purchase Order', to: '/wm/po', icon: '📋' },
              { label: '+ Receive GRN', to: '/wm/grn', icon: '📥' },
              { label: '▶ Putaway Tasks', to: '/wm/putaway', icon: '🔀' },
              { label: '🔍 View Inventory', to: '/wm/inventory', icon: '' },
              { label: '🚚 Dispatch Orders', to: '/wm/dispatch', icon: '' },
              { label: '🔄 Cycle Count', to: '/wm/cyclecount', icon: '' },
              { label: '📈 Reports', to: '/wm/reports', icon: '' },
              { label: '⚙️ Manage Locations', to: '/wm/locations', icon: '' },
            ].map(a => (
              <Link key={a.label} to={a.to}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-sm text-gray-700 hover:text-blue-700 transition-colors border hover:border-blue-200">
                {a.icon && <span>{a.icon}</span>}
                <span className="truncate">{a.label}</span>
              </Link>
            ))}
            <button onClick={() => setScanOpen(true)}
              className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-900 text-sm text-white transition-colors border border-gray-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5A2.5 2.5 0 0116.5 18h-9A2.5 2.5 0 015 15.5v-9A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5" />
              </svg>
              Scan QR Code
            </button>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Phase Progress</h3>
          <div className="space-y-3">
            {[
              { label: 'Phase 1 — Suppliers, Items, Locations', done: true },
              { label: 'Phase 2 — Receiving & Putaway', done: true },
              { label: 'Phase 3 — Dispatch to Sites', done: true },
              { label: 'Phase 4 — Cycle Counting', done: true },
              { label: 'Phase 5 — Reports & Analytics', done: true },
            ].map(p => (
              <div key={p.label} className="flex items-center gap-3">
                <span className={`text-sm font-bold ${p.done ? 'text-green-500' : 'text-gray-300'}`}>
                  {p.done ? '✓' : '○'}
                </span>
                <span className={`text-sm ${p.done ? 'text-gray-700' : 'text-gray-400'}`}>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <QRScanner isOpen={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />
    </div>
  );
}
