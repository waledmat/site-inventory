import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import * as XLSX from 'xlsx';

// ─── Friendly labels for raw JSON keys ───────────────────────────────────────
const FIELD_LABELS = {
  dn_id: 'Delivery Note',
  project_id: 'Project',
  item_count: 'Item Count',
  qty_on_hand: 'Qty On Hand',
  qty_issued: 'Qty Issued',
  qty_returned: 'Qty Returned',
  qty_pending_return: 'Pending Return',
  qty_requested: 'Qty Requested',
  unit_cost: 'Unit Cost',
  adjustment: 'Adjustment',
  reason: 'Reason',
  notes: 'Notes',
  status: 'Status',
  reorder_point: 'Reorder Point',
  min_quantity: 'Minimum Qty',
  return_id: 'Return',
  issue_id: 'Issue',
  request_id: 'Request',
  stock_item_id: 'Stock Item',
  user_id: 'User',
  receiver_id: 'Receiver',
  storekeeper_id: 'Storekeeper',
  description_1: 'Description',
  description_2: 'Description (line 2)',
  item_number: 'Item No.',
  uom: 'UOM',
  category: 'Category',
};

const humanizeKey = (k) =>
  FIELD_LABELS[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function formatValue(key, val, lookups) {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';

  // Resolve UUID references via lookups
  if (isUuid(val)) {
    if (key === 'project_id' && lookups.projects[val]) return lookups.projects[val];
    if ((key === 'user_id' || key === 'receiver_id' || key === 'storekeeper_id') && lookups.users[val]) return lookups.users[val];
    return `${val.slice(0, 8)}…`;
  }

  // Money / numeric formatting for cost-related keys
  if (key === 'unit_cost' || key.endsWith('_value') || key.endsWith('_cost')) {
    const n = Number(val);
    if (!Number.isNaN(n)) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // Quantity numbers
  if (typeof val === 'number' || (!isNaN(val) && key.startsWith('qty'))) {
    return Number(val).toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  // Plain strings / numbers / etc.
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function buildChangeEntries(oldRaw, newRaw) {
  let oldObj = {}, newObj = {};
  try { if (oldRaw) oldObj = JSON.parse(oldRaw); } catch { oldObj = {}; }
  try { if (newRaw) newObj = JSON.parse(newRaw); } catch { newObj = {}; }
  const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
  return keys.map(k => ({ key: k, oldVal: oldObj[k], newVal: newObj[k] }));
}

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [filters, setFilters] = useState({ user_id: '', entity_type: '', date_from: '', date_to: '' });
  const [page, setPage] = useState(1);
  const limit = 50;

  // Lookups for resolving UUIDs to names
  const lookups = {
    projects: Object.fromEntries(projects.map(p => [p.id, p.name])),
    users:    Object.fromEntries(users.map(u => [u.id, u.name])),
  };

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {});
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
    api.get('/audit/entity-types').then(r => setEntityTypes(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchLog(); }, [page, filters]);

  async function fetchLog() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit, ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v)) });
      const r = await api.get(`/audit?${params}`);
      setRows(r.data.rows);
      setTotal(r.data.total);
    } catch { setRows([]); }
    setLoading(false);
  }

  function handleFilter(e) {
    setFilters(f => ({ ...f, [e.target.name]: e.target.value }));
    setPage(1);
  }

  const actionColor = (action) => {
    if (action.includes('CREATED')) return 'bg-green-100 text-green-800';
    if (action.includes('ADJUSTED') || action.includes('UPDATED')) return 'bg-yellow-100 text-yellow-800';
    if (action.includes('DELETED') || action.includes('REJECTED')) return 'bg-red-100 text-red-800';
    if (action.includes('LOGGED') || action.includes('RESOLVED')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-700';
  };

  const totalPages = Math.ceil(total / limit);

  async function exportExcel() {
    try {
      const params = new URLSearchParams({ page: 1, limit: 10000, ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v)) });
      const r = await api.get(`/audit?${params}`);
      const data = r.data.rows.map(row => {
        const entries = buildChangeEntries(row.old_value, row.new_value);
        const hasOld = entries.some(e => e.oldVal !== undefined && e.oldVal !== null);
        const changes = entries.map(({ key, oldVal, newVal }) => {
          const oldStr = formatValue(key, oldVal, lookups);
          const newStr = formatValue(key, newVal, lookups);
          if (hasOld && oldStr !== newStr) return `${humanizeKey(key)}: ${oldStr} → ${newStr}`;
          return `${humanizeKey(key)}: ${newStr}`;
        }).join(' · ');
        return {
          'Time': new Date(row.created_at).toLocaleString(),
          'User': row.user_name || '',
          'Role': row.user_role || '',
          'Action': row.action,
          'Entity': row.entity_type,
          'Reference No.': row.ref_number || '',
          'Changes': changes,
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 36 }, { wch: 50 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
      XLSX.writeFile(wb, `Audit_Log_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">Audit Log</h2>

      {/* Filters */}
      <div className="bg-white border rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <select name="user_id" value={filters.user_id} onChange={handleFilter} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Users</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
        </select>
        <select name="entity_type" value={filters.entity_type} onChange={handleFilter} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Entity Types</option>
          {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" name="date_from" value={filters.date_from} onChange={handleFilter} className="border rounded-lg px-3 py-2 text-sm" placeholder="From" />
        <input type="date" name="date_to" value={filters.date_to} onChange={handleFilter} className="border rounded-lg px-3 py-2 text-sm" placeholder="To" />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">{total} total entries</div>
        <button onClick={exportExcel} className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 font-medium">
          Export Excel
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">Reference No.</th>
              <th className="px-4 py-3 text-left">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No audit entries found</td></tr>
            )}
            {rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{row.user_name || '—'}</div>
                  <div className="text-xs text-gray-400 capitalize">{row.user_role}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionColor(row.action)}`}>
                    {row.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{row.entity_type}</td>
                <td className="px-4 py-3 text-xs font-mono font-semibold text-blue-700">{row.ref_number || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-md">
                  {(row.new_value || row.old_value) && (() => {
                    const entries = buildChangeEntries(row.old_value, row.new_value);
                    if (entries.length === 0) return null;
                    const hasOld = entries.some(e => e.oldVal !== undefined && e.oldVal !== null);
                    return (
                      <details className="cursor-pointer">
                        <summary className="text-blue-600 hover:underline select-none">View</summary>
                        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <tbody className="divide-y divide-gray-200">
                              {entries.map(({ key, oldVal, newVal }) => {
                                const oldStr = formatValue(key, oldVal, lookups);
                                const newStr = formatValue(key, newVal, lookups);
                                const changed = hasOld && oldStr !== newStr;
                                return (
                                  <tr key={key}>
                                    <td className="px-3 py-1.5 font-medium text-gray-600 whitespace-nowrap align-top">
                                      {humanizeKey(key)}
                                    </td>
                                    <td className="px-3 py-1.5 text-gray-800 break-words">
                                      {hasOld && (
                                        <>
                                          <span className={changed ? 'line-through text-red-500' : 'text-gray-500'}>{oldStr}</span>
                                          <span className="mx-1.5 text-gray-400">→</span>
                                        </>
                                      )}
                                      <span className={changed ? 'font-semibold text-green-700' : ''}>{newStr}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
            className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
          <span className="text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
            className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      )}
    </div>
  );
}
