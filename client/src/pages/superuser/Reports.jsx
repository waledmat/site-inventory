import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';

const fmt    = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

const CAT_BADGE = {
  SPARE: 'bg-amber-100 text-amber-700',
  DC:    'bg-green-100 text-green-700',
  CH:    'bg-purple-100 text-purple-700',
};
const CAT_ORDER = ['CH', 'SPARE', 'DC'];

export default function Reports() {
  const [projects, setProjects] = useState([]);
  const [filters, setFilters]   = useState({ project_id: '', date_from: '', date_to: '' });
  const [report, setReport]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { api.get('/projects').then(r => setProjects(r.data)).catch(() => {}); }, []);

  const queryString = () =>
    new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).toString();

  const load = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get(`/reports/project-cost?${queryString()}`);
      setReport(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load report.');
    } finally { setLoading(false); }
  };

  const exportItemDetail = () => {
    const token = localStorage.getItem('token');
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
    const qs = queryString();
    window.open(`${base}/reports/project-cost?${qs ? qs + '&' : ''}format=excel&view=detail&token=${token}`, '_blank');
  };

  const grand = report?.grand_total;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Project Cost Report</h2>
        <p className="text-sm text-gray-500 mt-1">
          Issued · Returned — qty &amp; value per project, broken down by category.
          <strong>Pending Return</strong> is tracked only for <strong>Chargeable (CH)</strong> assets — those are items still owed back to the warehouse.
          Spares and Consumables (DC) are shown for issued/returned visibility but their unreturned balance is treated as consumed in the project, not pending.
        </p>
      </div>

      <div className="bg-white rounded-xl border p-5">
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={filters.project_id} onChange={e => setFilters(f => ({ ...f, project_id: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {[['date_from', 'From'], ['date_to', 'To']].map(([k, l]) => (
            <div key={k} className="flex items-center gap-1">
              <span className="text-sm text-gray-500">{l}:</span>
              <input type="date" value={filters[k]} onChange={e => setFilters(f => ({ ...f, [k]: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
          <button onClick={load} disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Loading…' : '📊 Load Report'}
          </button>
          <button onClick={exportItemDetail} disabled={!report}
            className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download per-item detail (one row per item with issued / returned / pending / cost)">
            🧾 Export Item Detail (Excel)
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>}

        {!report && !loading && (
          <p className="text-center text-gray-400 text-sm py-8">Pick filters and click “Load Report” to view the project cost report.</p>
        )}

        {report && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card label="Total Issued"   qty={grand.qty_issued}   value={grand.value_issued}   tone="blue" />
              <Card label="Total Returned" qty={grand.qty_returned} value={grand.value_returned} tone="green" />
              <Card label="Pending Return" qty={grand.qty_pending}  value={grand.value_pending}  tone="red" highlight />
              <Card label="Projects with Activity" qty={report.by_project.length} hideCurrency tone="gray" />
            </div>

            {report.by_project.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">No activity for the selected filters.</p>
            ) : (
              <SummaryTable report={report} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTable({ report }) {
  const grand = report.grand_total;
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
          <tr>
            <th className="px-4 py-3 text-left">Project</th>
            <th className="px-4 py-3 text-left">Category</th>
            <th className="px-4 py-3 text-right">Qty Issued</th>
            <th className="px-4 py-3 text-right">Issued Value</th>
            <th className="px-4 py-3 text-right">Qty Returned</th>
            <th className="px-4 py-3 text-right">Returned Value</th>
            <th className="px-4 py-3 text-right">Qty Pending</th>
            <th className="px-4 py-3 text-right">Pending Value</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {report.by_project.flatMap((proj) => {
            const rows = [];
            for (const cat of CAT_ORDER) {
              const c = proj.categories[cat];
              if (!c || (c.qty_issued === 0 && c.qty_returned === 0)) continue;
              const showPen = cat === 'CH';
              rows.push(
                <tr key={`${proj.project_id}-${cat}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">{proj.project_name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[cat]}`}>{cat}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-blue-600 font-semibold">{fmtQty(c.qty_issued)}</td>
                  <td className="px-4 py-2.5 text-right text-blue-700">{fmt(c.value_issued)}</td>
                  <td className="px-4 py-2.5 text-right text-green-600 font-semibold">{fmtQty(c.qty_returned)}</td>
                  <td className="px-4 py-2.5 text-right text-green-700">{fmt(c.value_returned)}</td>
                  <td className="px-4 py-2.5 text-right text-red-700 font-semibold">{showPen ? fmtQty(c.qty_pending) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-right text-red-700 font-bold">{showPen ? fmt(c.value_pending) : <span className="text-gray-300">—</span>}</td>
                </tr>
              );
            }
            rows.push(
              <tr key={`${proj.project_id}-total`} className="bg-gray-50 font-semibold">
                <td className="px-4 py-2 text-right text-gray-600 italic" colSpan={2}>Project Total</td>
                <td className="px-4 py-2 text-right text-blue-700">{fmtQty(proj.totals.qty_issued)}</td>
                <td className="px-4 py-2 text-right text-blue-800">{fmt(proj.totals.value_issued)}</td>
                <td className="px-4 py-2 text-right text-green-700">{fmtQty(proj.totals.qty_returned)}</td>
                <td className="px-4 py-2 text-right text-green-800">{fmt(proj.totals.value_returned)}</td>
                <td className="px-4 py-2 text-right text-red-700">{fmtQty(proj.totals.qty_pending)}</td>
                <td className="px-4 py-2 text-right text-red-800">{fmt(proj.totals.value_pending)}</td>
              </tr>
            );
            return rows;
          })}
        </tbody>
        <tfoot className="bg-gray-100 font-bold border-t-2">
          <tr>
            <td className="px-4 py-3" colSpan={2}>GRAND TOTAL</td>
            <td className="px-4 py-3 text-right text-blue-700">{fmtQty(grand.qty_issued)}</td>
            <td className="px-4 py-3 text-right text-blue-800">{fmt(grand.value_issued)}</td>
            <td className="px-4 py-3 text-right text-green-700">{fmtQty(grand.qty_returned)}</td>
            <td className="px-4 py-3 text-right text-green-800">{fmt(grand.value_returned)}</td>
            <td className="px-4 py-3 text-right text-red-700">{fmtQty(grand.qty_pending)}</td>
            <td className="px-4 py-3 text-right text-red-800">{fmt(grand.value_pending)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Card({ label, qty, value, tone = 'gray', highlight = false, hideCurrency = false }) {
  const tones = {
    blue:  'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    red:   'bg-red-50 border-red-200 text-red-800',
    gray:  'bg-gray-50 border-gray-200 text-gray-800',
  };
  return (
    <div className={`border rounded-xl p-3 ${tones[tone]} ${highlight ? 'ring-2 ring-red-300' : ''}`}>
      <div className="text-xs opacity-80">{label}</div>
      {hideCurrency ? (
        <div className="text-2xl font-bold">{fmtQty(qty)}</div>
      ) : (
        <>
          <div className="text-2xl font-bold">{fmt(value)}</div>
          <div className="text-[11px] opacity-70">qty: {fmtQty(qty)}</div>
        </>
      )}
    </div>
  );
}
