export default function ListModal({ title, columns, rows, loading, onClose, emptyText = 'No items found' }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">
            {title}
            <span className="ml-2 text-sm font-normal text-gray-500">({rows?.length ?? 0})</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-bold leading-none">×</button>
        </div>
        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
          ) : !rows || rows.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">{emptyText}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {columns.map(c => (
                    <th key={c.key} className={`px-4 py-3 text-xs font-medium text-gray-500 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id || i} className="border-t hover:bg-gray-50">
                    {columns.map(c => (
                      <td key={c.key} className={`px-4 py-2.5 text-gray-700 ${c.align === 'right' ? 'text-right font-semibold' : ''}`}>
                        {c.render ? c.render(r[c.key], r) : (r[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
