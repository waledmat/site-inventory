import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function Reports() {
  const [tab, setTab] = useState('issues'); // 'issues' | 'consumption'
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({ project_id: '', date_from: '', date_to: '' });
  const [summary, setSummary] = useState(null);
  const [consumption, setConsumption] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get('/projects').then(r => setProjects(r.data)).catch(() => {}); }, []);

  const queryString = () =>
    new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).toString();

  const load = async () => {
    setLoading(true);
    try {
      if (tab === 'issues') {
        const { data } = await api.get(`/reports/summary?${queryString()}`);
        setSummary(data);
      } else {
        const { data } = await api.get(`/reports/consumption?${queryString()}`);
        setConsumption(data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const exportExcel = () => {
    const token = localStorage.getItem('token');
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
    const path = tab === 'issues' ? 'export' : 'consumption';
    window.open(`${base}/reports/${path}?${queryString()}&format=excel&token=${token}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Reports</h2>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: 'issues',      label: '📊 Issues Summary' },
          { id: 'consumption', label: '🔧 Consumption (Spares + Consumables)' },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSummary(null); setConsumption(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition
              ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.label}
          </button>
        ))}
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
          <button onClick={exportExcel} className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">⬇️ Export Excel</button>
        </div>

        {tab === 'issues' && summary && (() => {
          const returnedFor = (name) => summary.returned?.find(r => r.project_name === name) || {};
          const totals = summary.issued.reduce((acc, r) => {
            const ret = returnedFor(r.project_name);
            acc.qty       += Number(r.total_qty || 0);
            acc.issuedVal += Number(r.issued_value || 0);
            acc.retQty    += Number(ret.total_returned || 0);
            acc.retVal    += Number(ret.returned_value || 0);
            acc.issues    += Number(r.issue_count || 0);
            return acc;
          }, { qty: 0, issuedVal: 0, retQty: 0, retVal: 0, issues: 0 });

          return (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 mb-2">Issues by Project</h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Project</th>
                      <th className="px-4 py-3 text-left">Issues</th>
                      <th className="px-4 py-3 text-right">Qty Issued</th>
                      <th className="px-4 py-3 text-right">Issued Value</th>
                      <th className="px-4 py-3 text-right">Qty Returned</th>
                      <th className="px-4 py-3 text-right">Returned Value</th>
                      <th className="px-4 py-3 text-right">Outstanding Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {summary.issued.map((row, i) => {
                      const ret      = returnedFor(row.project_name);
                      const issuedVal = Number(row.issued_value || 0);
                      const retVal    = Number(ret.returned_value || 0);
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{row.project_name}</td>
                          <td className="px-4 py-3">{row.issue_count}</td>
                          <td className="px-4 py-3 text-right text-blue-600 font-bold">{fmtQty(row.total_qty)}</td>
                          <td className="px-4 py-3 text-right text-blue-700 font-semibold">{fmtMoney(issuedVal)}</td>
                          <td className="px-4 py-3 text-right text-green-600 font-bold">{fmtQty(ret.total_returned)}</td>
                          <td className="px-4 py-3 text-right text-green-700 font-semibold">{fmtMoney(retVal)}</td>
                          <td className="px-4 py-3 text-right text-red-700 font-bold">{fmtMoney(issuedVal - retVal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 font-bold border-t-2">
                    <tr>
                      <td className="px-4 py-3">GRAND TOTAL</td>
                      <td className="px-4 py-3">{totals.issues}</td>
                      <td className="px-4 py-3 text-right text-blue-700">{fmtQty(totals.qty)}</td>
                      <td className="px-4 py-3 text-right text-blue-800">{fmtMoney(totals.issuedVal)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{fmtQty(totals.retQty)}</td>
                      <td className="px-4 py-3 text-right text-green-800">{fmtMoney(totals.retVal)}</td>
                      <td className="px-4 py-3 text-right text-red-700">{fmtMoney(totals.issuedVal - totals.retVal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })()}

        {tab === 'consumption' && consumption && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Shows materials actually consumed: <strong>Spare parts</strong> and <strong>Consumables (DC)</strong> only.
              Chargeable (CH) items are excluded — they are tracked separately as project assets.
            </p>

            {/* Totals */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="text-xs text-blue-700">Total Consumption Value</div>
                <div className="text-2xl font-bold text-blue-800">{fmt(consumption.totals.total_value)}</div>
              </div>
              <div className="bg-gray-50 border rounded-xl p-3">
                <div className="text-xs text-gray-600">Total Qty Issued</div>
                <div className="text-2xl font-bold text-gray-800">{fmtQty(consumption.totals.qty_issued)}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="text-xs text-amber-700">Spare Parts</div>
                <div className="text-2xl font-bold text-amber-800">{fmt(consumption.totals.by_category.SPARE.value)}</div>
                <div className="text-[11px] text-amber-600">qty: {fmtQty(consumption.totals.by_category.SPARE.qty)}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="text-xs text-green-700">Consumables (DC)</div>
                <div className="text-2xl font-bold text-green-800">{fmt(consumption.totals.by_category.DC.value)}</div>
                <div className="text-[11px] text-green-600">qty: {fmtQty(consumption.totals.by_category.DC.qty)}</div>
              </div>
            </div>

            {/* Items table */}
            {consumption.items.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">No consumption recorded for the selected filters.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Project</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Item No.</th>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-left">UOM</th>
                      <th className="px-4 py-3 text-right">Qty Issued</th>
                      <th className="px-4 py-3 text-right">Unit Cost</th>
                      <th className="px-4 py-3 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {consumption.items.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 max-w-[180px] truncate">{r.project_name}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.category === 'SPARE' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {r.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">{r.item_number || '—'}</td>
                        <td className="px-4 py-2.5">{r.description_1}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{r.uom}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{fmtQty(r.qty_issued)}</td>
                        <td className="px-4 py-2.5 text-right">{fmt(r.unit_cost)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-blue-700">{fmt(r.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-bold">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right">Total</td>
                      <td className="px-4 py-3 text-right">{fmtQty(consumption.totals.qty_issued)}</td>
                      <td></td>
                      <td className="px-4 py-3 text-right text-blue-700">{fmt(consumption.totals.total_value)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'consumption' && !consumption && !loading && (
          <p className="text-center text-gray-400 text-sm py-8">Pick filters and click "Load Report" to view consumption.</p>
        )}
        {tab === 'issues' && !summary && !loading && (
          <p className="text-center text-gray-400 text-sm py-8">Pick filters and click "Load Report" to view issues summary.</p>
        )}
      </div>
    </div>
  );
}
