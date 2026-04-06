import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/axiosInstance';
import QRScanner from '../../components/common/QRScanner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

// ─── Palette matching the reference dashboard ───────────────────────────────
const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];
const BLUE   = '#2563eb';
const GREEN  = '#16a34a';
const AMBER  = '#d97706';
const RED    = '#dc2626';
const PURPLE = '#7c3aed';

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = 'blue', icon, to }) {
  const colorMap = {
    blue:   { bg: 'bg-blue-600',   text: 'text-white' },
    green:  { bg: 'bg-green-600',  text: 'text-white' },
    amber:  { bg: 'bg-amber-500',  text: 'text-white' },
    red:    { bg: 'bg-red-600',    text: 'text-white' },
    purple: { bg: 'bg-purple-600', text: 'text-white' },
    teal:   { bg: 'bg-teal-600',   text: 'text-white' },
  };
  const { bg, text } = colorMap[color] || colorMap.blue;
  const inner = (
    <div className={`rounded-xl p-4 flex flex-col gap-1 shadow-sm ${bg} ${text} h-full`}>
      <p className="text-xs font-medium opacity-80 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold leading-tight">{value ?? '—'}</p>
      {sub && <p className="text-xs opacity-70">{sub}</p>}
      {icon && <div className="mt-auto pt-2 opacity-60 text-xl">{icon}</div>}
    </div>
  );
  return to ? <Link to={to} className="block h-full">{inner}</Link> : inner;
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm ${className}`}>
      {title && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</p>}
      {children}
    </div>
  );
}

// ─── Custom tooltip ──────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
}

// ─── Donut with center label ─────────────────────────────────────────────────
function DonutChart({ data, cx = '50%', cy = '50%', label, sublabel }) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={data} cx={cx} cy={cy} innerRadius={45} outerRadius={68}
            dataKey="value" paddingAngle={3}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => v} />
        </PieChart>
      </ResponsiveContainer>
      {label && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-lg font-bold text-gray-800">{label}</p>
          {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function WMDashboard() {
  const navigate   = useNavigate();
  const [data, setData]     = useState(null);
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanOpen, setScanOpen] = useState(false);

  const handleScan = (text) => {
    if (text.startsWith('BIN:'))       navigate('/wm/locations');
    else if (text.startsWith('ITEM:')) navigate('/wm/items');
    else if (text.startsWith('GRN:'))  navigate('/wm/grn');
    else if (text.startsWith('DO:'))   navigate('/wm/dispatch');
    else if (text.startsWith('CC:'))   navigate('/wm/cyclecount');
    setScanOpen(false);
  };

  useEffect(() => {
    Promise.allSettled([
      api.get('/wms/inventory/analytics'),
      api.get('/wms/inventory/stats'),
    ]).then(([analytics, basicStats]) => {
      if (analytics.status === 'fulfilled') setData(analytics.value.data);
      if (basicStats.status === 'fulfilled') setStats(basicStats.value.data);
    }).finally(() => setLoading(false));
  }, []);

  // ── Derived chart data ────────────────────────────────────────────────────
  const categoryData = (data?.by_category || []).map(r => ({
    name: r.category || 'N/A', qty: parseInt(r.qty) || 0,
  }));

  const supplierData = (data?.by_supplier || []).map(r => ({
    name: r.supplier?.length > 18 ? r.supplier.slice(0, 18) + '…' : r.supplier,
    items: parseInt(r.item_count) || 0,
  }));

  // Merge GRN + Dispatch into one timeline
  const monthMap = {};
  (data?.grn_by_month || []).forEach(r => { monthMap[r.month] = { month: r.month, received: parseFloat(r.qty) || 0, dispatched: 0 }; });
  (data?.dispatch_by_month || []).forEach(r => {
    if (!monthMap[r.month]) monthMap[r.month] = { month: r.month, received: 0, dispatched: 0 };
    monthMap[r.month].dispatched = parseFloat(r.qty) || 0;
  });
  const flowData = Object.values(monthMap).sort((a, b) => a.month > b.month ? 1 : -1);

  const lowStockData = (data?.low_stock_by_cat || []).map(r => ({
    name: r.category, low: parseInt(r.low_stock_count) || 0, ok: parseInt(r.total_count) - (parseInt(r.low_stock_count) || 0),
  }));

  const txnData = (data?.txn_types || []).map((r, i) => ({
    name: r.transaction_type, value: parseInt(r.cnt) || 0, color: COLORS[i % COLORS.length],
  }));

  const dailyData = (data?.daily_movements || []).map(r => ({
    day: r.day, received: parseFloat(r.received) || 0, dispatched: parseFloat(r.dispatched) || 0,
  }));

  const dispatchStatusData = (data?.dispatch_status || []).map((r, i) => ({
    name: r.status, value: parseInt(r.cnt) || 0, color: COLORS[i % COLORS.length],
  }));

  const totalDispatch = dispatchStatusData.reduce((a, c) => a + c.value, 0);
  const fulfilledCount = dispatchStatusData.find(d => d.name === 'dispatched')?.value || 0;
  const fulfillRate = totalDispatch > 0 ? Math.round((fulfilledCount / totalDispatch) * 100) : 0;

  const totalTxn = txnData.reduce((a, c) => a + c.value, 0);

  const kpis = data?.kpis;

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory & Supply Chain Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">Real-time warehouse analytics</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setScanOpen(true)}
            className="flex items-center gap-2 bg-gray-800 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-900">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5A2.5 2.5 0 0116.5 18h-9A2.5 2.5 0 015 15.5v-9A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5" />
            </svg>
            Scan
          </button>
          <Link to="/" className="text-xs text-gray-400 hover:text-blue-600 border rounded-lg px-3 py-2 hover:border-blue-300">
            ← Modules
          </Link>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Total Items in Stock"
          value={loading ? '…' : (kpis?.total_qty?.toLocaleString() ?? stats?.items ?? 0)}
          sub="units across all bins"
          color="blue" icon="📦" to="/wm/inventory"
        />
        <KpiCard
          label="Active Item Master"
          value={loading ? '…' : (kpis?.total_items ?? stats?.items ?? 0)}
          sub="unique SKUs"
          color="teal" icon="🗂️" to="/wm/items"
        />
        <KpiCard
          label="GRN Confirm Rate"
          value={loading ? '…' : `${kpis?.grn_confirm_rate ?? 0}%`}
          sub="confirmed / total GRNs"
          color="green" icon="📥" to="/wm/grn"
        />
        <KpiCard
          label="Putaway Rate"
          value={loading ? '…' : `${kpis?.putaway_rate ?? 0}%`}
          sub="tasks completed"
          color="purple" icon="🔀" to="/wm/putaway"
        />
        <KpiCard
          label="Low Stock Alerts"
          value={loading ? '…' : (kpis?.low_stock_items ?? stats?.low_stock ?? 0)}
          sub="items below reorder pt."
          color="amber" icon="⚠️" to="/wm/inventory"
        />
        <KpiCard
          label="Stockout Rate"
          value={loading ? '…' : `${kpis?.stockout_rate ?? 0}%`}
          sub="items at/below reorder"
          color="red" icon="🚨" to="/wm/inventory"
        />
      </div>

      {/* ── Row 2: Stock by Category + In/Out Flow ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Total Stock Qty by Category" className="lg:col-span-1">
          {loading ? <Skeleton /> : categoryData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="qty" name="Qty" radius={[0, 4, 4, 0]}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Stock In vs Out — Last 6 Months" className="lg:col-span-2">
          {loading ? <Skeleton /> : flowData.length === 0 ? <Empty text="No GRN or dispatch data yet" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={flowData} margin={{ left: 0, right: 8 }}>
                <defs>
                  <linearGradient id="recvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dispGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GREEN} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="received" name="Received (GRN)" stroke={BLUE} fill="url(#recvGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="dispatched" name="Dispatched" stroke={GREEN} fill="url(#dispGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Row 3: Supplier Items + Low Stock by Category + Dispatch Donut ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Item Count by Supplier">
          {loading ? <Skeleton /> : supplierData.length === 0 ? <Empty text="No PO data yet" /> : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={supplierData} layout="vertical" margin={{ left: 4, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="items" name="Items" fill={BLUE} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Low Stock by Category">
          {loading ? <Skeleton /> : lowStockData.length === 0 ? <Empty text="No items configured yet" /> : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={lowStockData} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ok"  name="OK"        fill={GREEN} stackId="a" radius={[0,0,0,0]} />
                <Bar dataKey="low" name="Low Stock"  fill={RED}   stackId="a" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Dispatch Order Status">
          {loading ? <Skeleton /> : dispatchStatusData.length === 0 ? <Empty text="No dispatch orders yet" /> : (
            <div>
              <DonutChart data={dispatchStatusData} label={`${fulfillRate}%`} sublabel="Fulfilled" />
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
                {dispatchStatusData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                    <span className="text-xs text-gray-600 capitalize">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 4: Daily Movements + Transaction Types Donut + Top Items ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Daily Stock Movements — Last 14 Days" className="lg:col-span-2">
          {loading ? <Skeleton /> : dailyData.length === 0 ? <Empty text="No transactions in last 14 days" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyData} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="received"   name="Received"   stroke={BLUE}   strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="dispatched" name="Dispatched"  stroke={AMBER}  strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Transaction Types (30 days)">
          {loading ? <Skeleton /> : txnData.length === 0 ? <Empty text="No transactions yet" /> : (
            <div>
              <DonutChart data={txnData} label={totalTxn} sublabel="total" />
              <div className="flex flex-col gap-1 mt-2">
                {txnData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                      <span className="text-xs text-gray-600 capitalize">{d.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 5: Top Items Table + Quick Actions ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Top 5 Items by Stock Quantity" className="lg:col-span-2">
          {loading ? <Skeleton /> : !data?.top_items?.length ? <Empty text="No stock data yet" /> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b">
                  <th className="text-left pb-2">Item</th>
                  <th className="text-left pb-2">Description</th>
                  <th className="text-left pb-2">Category</th>
                  <th className="text-right pb-2">Qty</th>
                  <th className="text-right pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.top_items.map((item, i) => {
                  const max = parseFloat(data.top_items[0]?.qty) || 1;
                  const pct = Math.round((parseFloat(item.qty) / max) * 100);
                  return (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs text-blue-700">{item.item_number}</td>
                      <td className="py-2 text-xs text-gray-700 max-w-[140px] truncate">{item.description_1}</td>
                      <td className="py-2"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{item.category}</span></td>
                      <td className="py-2 text-right font-bold text-gray-800 text-sm">{parseFloat(item.qty).toLocaleString()}</td>
                      <td className="py-2 pl-3 w-24">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Quick Actions">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'New PO',        to: '/wm/po',         bg: 'bg-blue-50   hover:bg-blue-100   text-blue-700',   icon: '📋' },
              { label: 'Receive GRN',   to: '/wm/grn',        bg: 'bg-green-50  hover:bg-green-100  text-green-700',  icon: '📥' },
              { label: 'Putaway',       to: '/wm/putaway',    bg: 'bg-purple-50 hover:bg-purple-100 text-purple-700', icon: '🔀' },
              { label: 'Inventory',     to: '/wm/inventory',  bg: 'bg-teal-50   hover:bg-teal-100   text-teal-700',   icon: '📦' },
              { label: 'Dispatch',      to: '/wm/dispatch',   bg: 'bg-amber-50  hover:bg-amber-100  text-amber-700',  icon: '🚚' },
              { label: 'Cycle Count',   to: '/wm/cyclecount', bg: 'bg-rose-50   hover:bg-rose-100   text-rose-700',   icon: '🔄' },
              { label: 'Reports',       to: '/wm/reports',    bg: 'bg-gray-50   hover:bg-gray-100   text-gray-700',   icon: '📈' },
              { label: 'Locations',     to: '/wm/locations',  bg: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700', icon: '🗺️' },
            ].map(a => (
              <Link key={a.label} to={a.to}
                className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border text-xs font-medium transition-colors ${a.bg}`}>
                <span className="text-xl">{a.icon}</span>
                {a.label}
              </Link>
            ))}
          </div>
          <button onClick={() => setScanOpen(true)}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-gray-800 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5A2.5 2.5 0 0116.5 18h-9A2.5 2.5 0 015 15.5v-9A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5" />
            </svg>
            Scan QR Code
          </button>
        </Card>
      </div>

      <QRScanner isOpen={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2 py-4">
      <div className="h-3 bg-gray-100 rounded w-3/4" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
      <div className="h-3 bg-gray-100 rounded w-5/6" />
      <div className="h-3 bg-gray-100 rounded w-2/3" />
    </div>
  );
}

function Empty({ text = 'No data available' }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-gray-300">
      <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-xs">{text}</p>
    </div>
  );
}
