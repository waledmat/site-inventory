import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';

const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CostSummaryPanel({ projectId = null, title = 'Material Value' }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const url = projectId ? `/reports/cost-summary?project_id=${projectId}` : '/reports/cost-summary';
    api.get(url).then(r => setData(r.data)).catch(() => setError(true));
  }, [projectId]);

  if (error) return null;
  if (!data) return (
    <div className="bg-white border rounded-xl p-4 animate-pulse">
      <div className="h-4 bg-gray-100 rounded w-32 mb-3" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-50 rounded" />)}
      </div>
    </div>
  );

  const { totals, by_project } = data;
  const cards = [
    { label: 'On-Hand Value',     val: totals.on_hand_value,        color: 'text-blue-700  bg-blue-50  border-blue-200',    hint: 'qty on hand × unit cost' },
    { label: 'Issued Value',      val: totals.issued_value,         color: 'text-indigo-700 bg-indigo-50 border-indigo-200', hint: 'cumulative issued × unit cost' },
    { label: 'Returned Value',    val: totals.returned_value,       color: 'text-green-700 bg-green-50 border-green-200',   hint: 'returned × unit cost' },
    { label: 'Unreturned Value',  val: totals.pending_return_value, color: 'text-red-700   bg-red-50   border-red-200',     hint: 'pending return × unit cost' },
    { label: 'Aging Stock (>90d)', val: totals.aging_value,          color: 'text-amber-700 bg-amber-50 border-amber-200',   hint: 'on hand idle > 90 days' },
  ];

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700">{title}</h3>
        <span className="text-xs text-gray-400">all values in project currency</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`rounded-lg border p-3 ${c.color}`}>
            <div className="text-xs font-medium opacity-80">{c.label}</div>
            <div className="text-xl font-bold mt-1">{fmt(c.val)}</div>
            <div className="text-[10px] opacity-70 mt-0.5">{c.hint}</div>
          </div>
        ))}
      </div>

      {by_project && by_project.length > 1 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="py-2 text-left">Project</th>
                <th className="py-2 text-right">On Hand</th>
                <th className="py-2 text-right">Issued</th>
                <th className="py-2 text-right">Returned</th>
                <th className="py-2 text-right">Unreturned</th>
                <th className="py-2 text-right">Priced</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {by_project.map(p => (
                <tr key={p.project_id} className="hover:bg-gray-50">
                  <td className="py-2 text-gray-700 truncate max-w-[220px]">{p.project_name}</td>
                  <td className="py-2 text-right font-semibold text-blue-700">{fmt(p.on_hand_value)}</td>
                  <td className="py-2 text-right text-indigo-700">{fmt(p.issued_value)}</td>
                  <td className="py-2 text-right text-green-700">{fmt(p.returned_value)}</td>
                  <td className="py-2 text-right font-semibold text-red-600">{fmt(p.pending_return_value)}</td>
                  <td className="py-2 text-right text-xs text-gray-500">{p.priced_items}/{p.total_items}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {by_project.some(p => p.priced_items < p.total_items) && (
            <p className="text-[11px] text-gray-400 mt-2">
              Items without a unit cost are excluded from these totals. Set unit cost in Stock Adjustment or in the Excel upload.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
