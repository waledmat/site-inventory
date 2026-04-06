import { useState } from 'react';
import api from '../../utils/axiosInstance';
import { useToast } from '../../context/ToastContext';

const REPORT_TYPES = [
  { id: 'stock-movement',   label: 'Stock Movement',    icon: '📈', desc: 'All warehouse stock transactions filtered by date and item' },
  { id: 'grn-history',      label: 'GRN History',       icon: '📥', desc: 'Goods receipt notes with supplier and quantity totals' },
  { id: 'dispatch-history', label: 'Dispatch History',  icon: '🚚', desc: 'Dispatch orders and quantities sent to sites' },
  { id: 'stock-snapshot',   label: 'Stock Snapshot',    icon: '📦', desc: 'Current inventory levels across all bins' },
];

const CATEGORIES = ['CH', 'DC', 'SPARE', 'GENERAL'];

export default function WMReports() {
  const toast = useToast();
  const [activeReport, setActiveReport] = useState('stock-movement');
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [ran, setRan]           = useState(false);
  const [filters, setFilters]   = useState({
    from: '', to: '', category: '', status: '', low_stock: false,
  });

  const token = localStorage.getItem('token');

  const runReport = async () => {
    setLoading(true); setRan(false);
    try {
      const q = buildQuery();
      const r = await api.get(`/wms/reports/${activeReport}${q}`);
      setRows(r.data);
      setRan(true);
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to run report', 'error');
    } finally { setLoading(false); }
  };

  const buildQuery = () => {
    const p = new URLSearchParams();
    if (filters.from)      p.set('from',      filters.from);
    if (filters.to)        p.set('to',        filters.to);
    if (filters.category)  p.set('category',  filters.category);
    if (filters.status)    p.set('status',    filters.status);
    if (filters.low_stock) p.set('low_stock', 'true');
    const s = p.toString();
    return s ? '?' + s : '';
  };

  const downloadPDF = () => {
    const q = buildQuery();
    const sep = q ? '&' : '?';
    window.open(`/api/wms/reports/${activeReport}/pdf${q}${sep}token=${token}`, '_blank');
  };

  const fld = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  const FilterPanel = () => (
    <div className="bg-white border rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
      <div className="flex flex-wrap gap-3">
        {['stock-movement', 'grn-history', 'dispatch-history'].includes(activeReport) && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input type="date" value={filters.from} onChange={e => fld('from', e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input type="date" value={filters.to} onChange={e => fld('to', e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm" />
            </div>
          </>
        )}
        {['stock-movement', 'stock-snapshot'].includes(activeReport) && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select value={filters.category} onChange={e => fld('category', e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="">All</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        {activeReport === 'dispatch-history' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select value={filters.status} onChange={e => fld('status', e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="">All</option>
              {['draft','confirmed','dispatched','cancelled'].map(s =>
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              )}
            </select>
          </div>
        )}
        {activeReport === 'stock-snapshot' && (
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={filters.low_stock}
                onChange={e => fld('low_stock', e.target.checked)} className="rounded" />
              Low stock only
            </label>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={runReport} disabled={loading}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Running…' : 'Run Report'}
        </button>
        {ran && ['stock-movement', 'stock-snapshot'].includes(activeReport) && (
          <button onClick={downloadPDF}
            className="border border-purple-300 text-purple-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-50">
            Download PDF
          </button>
        )}
        {ran && (
          <span className="text-xs text-gray-400 self-center">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );

  // ── Result tables ──────────────────────────────────────────────────────────

  const StockMovementTable = () => (
    <div className="bg-white border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['Date', 'Type', 'Item No.', 'Description', 'Category', 'Bin', 'Qty', 'User'].map(h => (
              <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-xs text-gray-500">{String(r.created_at).slice(0, 10)}</td>
              <td className="px-3 py-2 text-xs">
                <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono text-xs">
                  {r.transaction_type}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{r.item_number}</td>
              <td className="px-3 py-2 text-xs">{r.description_1}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{r.category}</td>
              <td className="px-3 py-2 font-mono text-xs text-purple-700">{r.bin_code || '—'}</td>
              <td className={`px-3 py-2 text-xs font-medium ${r.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {r.quantity > 0 ? '+' : ''}{r.quantity}
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">{r.user_name || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const GRNHistoryTable = () => (
    <div className="bg-white border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['GRN No.', 'PO No.', 'Supplier', 'Received Date', 'Lines', 'Total Qty', 'Status', 'By'].map(h => (
              <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-blue-700 text-xs">{r.grn_number}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.po_number || '—'}</td>
              <td className="px-3 py-2 text-xs">{r.supplier_name || '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{r.received_date ? String(r.received_date).slice(0, 10) : '—'}</td>
              <td className="px-3 py-2 text-xs">{r.line_items}</td>
              <td className="px-3 py-2 text-xs font-medium">{r.total_qty || 0}</td>
              <td className="px-3 py-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {r.status}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">{r.created_by_name || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const DispatchHistoryTable = () => (
    <div className="bg-white border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['Order No.', 'Project', 'Destination', 'Lines', 'Total Dispatched', 'Status', 'Dispatched', 'By'].map(h => (
              <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-blue-700 text-xs">{r.order_number}</td>
              <td className="px-3 py-2 text-xs">{r.project_name || '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{r.destination || '—'}</td>
              <td className="px-3 py-2 text-xs">{r.line_items}</td>
              <td className="px-3 py-2 text-xs font-medium">{r.total_dispatched || 0}</td>
              <td className="px-3 py-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  r.status === 'dispatched' ? 'bg-green-100 text-green-700' :
                  r.status === 'confirmed'  ? 'bg-blue-100 text-blue-700' :
                  r.status === 'cancelled'  ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'}`}>
                  {r.status}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">{r.dispatched_at ? String(r.dispatched_at).slice(0, 10) : '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{r.dispatched_by_name || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const StockSnapshotTable = () => (
    <div className="bg-white border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['Item No.', 'Description', 'Category', 'UOM', 'On Hand', 'Reorder Pt', 'Status'].map(h => (
              <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => (
            <tr key={r.id} className={r.low_stock ? 'bg-red-50' : 'hover:bg-gray-50'}>
              <td className="px-3 py-2 font-mono text-xs">{r.item_number}</td>
              <td className="px-3 py-2 text-xs">{r.description_1}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{r.category}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{r.uom}</td>
              <td className="px-3 py-2 text-xs font-medium">{r.total_qty}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{r.reorder_point || 0}</td>
              <td className="px-3 py-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.low_stock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {r.low_stock ? 'LOW' : 'OK'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const ResultTable = () => {
    if (!ran) return null;
    if (rows.length === 0) return (
      <p className="text-center text-gray-400 py-8 text-sm">No data found for the selected filters.</p>
    );
    switch (activeReport) {
      case 'stock-movement':   return <StockMovementTable />;
      case 'grn-history':      return <GRNHistoryTable />;
      case 'dispatch-history': return <DispatchHistoryTable />;
      case 'stock-snapshot':   return <StockSnapshotTable />;
      default: return null;
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-gray-800">WMS Reports</h2>

      {/* Report type selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {REPORT_TYPES.map(rt => (
          <button key={rt.id} onClick={() => { setActiveReport(rt.id); setRows([]); setRan(false); }}
            className={`text-left p-4 border rounded-xl transition-all ${
              activeReport === rt.id
                ? 'border-blue-500 bg-blue-50'
                : 'bg-white hover:border-gray-300'}`}>
            <div className="text-2xl mb-1">{rt.icon}</div>
            <div className="text-sm font-semibold text-gray-800">{rt.label}</div>
            <div className="text-xs text-gray-400 mt-0.5 leading-tight">{rt.desc}</div>
          </button>
        ))}
      </div>

      <FilterPanel />
      <ResultTable />
    </div>
  );
}
