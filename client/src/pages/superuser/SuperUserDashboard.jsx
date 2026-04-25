import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/axiosInstance';
import StatCard from '../../components/common/StatCard';
import CostSummaryPanel from '../../components/common/CostSummaryPanel';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import * as XLSX from 'xlsx';

export default function SuperUserDashboard() {
  const [summary, setSummary] = useState(null);
  const [pending, setPending] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingModal, setPendingModal] = useState(null); // 'pending' | 'overdue' | null

  const exportToExcel = (rows, title) => {
    const data = rows.map(r => ({
      'Project': r.project_name,
      'Item No.': r.item_number || '',
      'Description': r.description_1,
      'UOM': r.uom,
      'Issued': parseFloat(r.quantity_issued),
      'Returned': parseFloat(r.qty_returned),
      'Remaining': parseFloat(r.qty_remaining),
      'Issue Date': r.issue_date?.slice(0, 10),
      'Receiver': r.receiver_name || '',
      'Storekeeper': r.storekeeper_name || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
    XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  useEffect(() => {
    api.get('/reports/summary').then(r => setSummary(r.data)).catch(() => {});
    api.get('/returns/pending').then(r => setPending(r.data)).catch(() => {});
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = pending.filter(p => p.issue_date < today);

  const chartData = summary?.issued?.map(row => ({
    name: row.project_name?.slice(0, 14),
    fullName: row.project_name,
    project_id: row.project_id,
    Issued: parseFloat(row.total_qty) || 0,
    Returned: parseFloat(summary.returned?.find(r => r.project_name === row.project_name)?.total_returned) || 0,
  })) || [];

  const loadDetail = async (projectId, projectName) => {
    if (selectedProject?.id === projectId) {
      // toggle off
      setSelectedProject(null);
      setDetail(null);
      return;
    }
    setSelectedProject({ id: projectId, name: projectName });
    setDetail(null);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/reports/project-detail?project_id=${projectId}`);
      setDetail(data);
    } catch { setDetail([]); }
    finally { setDetailLoading(false); }
  };

  const handleBarClick = (data) => {
    if (!data?.activePayload?.[0]) return;
    const row = data.activePayload[0].payload;
    // find matching project id from projects list
    const proj = projects.find(p => p.name === row.fullName);
    if (proj) loadDetail(proj.id, proj.name);
  };

  const handleProjectSelect = (e) => {
    const id = e.target.value;
    if (!id) { setSelectedProject(null); setDetail(null); return; }
    const proj = projects.find(p => p.id === id);
    if (proj) loadDetail(proj.id, proj.name);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Super User Dashboard</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Projects" value={projects.filter(p => p.is_active).length} icon="🏗️" color="blue"   to="/superuser/projects" />
        <StatCard title="Pending Returns" value={pending.length}                            icon="⏳"  color="yellow" onClick={() => setPendingModal('pending')} />
        <StatCard title="Overdue"         value={overdue.length}                            icon="⚠️" color="red"    onClick={() => setPendingModal('overdue')} />
        <StatCard title="Total Projects"  value={projects.length}                           icon="📋" color="gray"   to="/superuser/projects" />
      </div>

      {/* Material value (cost-based) */}
      <CostSummaryPanel
        title={selectedProject ? `Material Value — ${selectedProject.name}` : 'Material Value by Project'}
        projectId={selectedProject?.id || null}
      />

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <Link to="/superuser/upload" className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700">📂 Upload Packing List</Link>
        <Link to="/superuser/reports" className="border px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50">📊 Reports</Link>
        <Link to="/superuser/daily-log" className="border px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50">📅 Daily Log</Link>
      </div>

      {/* Chart + project selector */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="font-semibold text-gray-700">Issued vs Returned by Project</h3>
            <select
              value={selectedProject?.id || ''}
              onChange={handleProjectSelect}
              className="border rounded-lg px-3 py-1.5 text-sm w-full sm:w-56"
            >
              <option value="">Select project for detail…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-400 mb-2">Click a bar or select a project above to see the breakdown</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val, name) => [val.toFixed(2), name]} />
              <Legend />
              <Bar dataKey="Issued" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={selectedProject?.name === entry.fullName ? '#1d4ed8' : '#3b82f6'} />
                ))}
              </Bar>
              <Bar dataKey="Returned" fill="#22c55e" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={selectedProject?.name === entry.fullName ? '#15803d' : '#22c55e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Project detail breakdown */}
      {selectedProject && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
            <div>
              <h3 className="font-semibold text-gray-800">{selectedProject.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">Item-level breakdown — Issued · Returned · Pending Return</p>
            </div>
            <button onClick={() => { setSelectedProject(null); setDetail(null); }}
              className="text-gray-400 hover:text-gray-600 text-lg font-bold">✕</button>
          </div>

          {detailLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : !detail || detail.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No issued items found for this project</div>
          ) : (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-3 divide-x border-b">
                <div className="px-5 py-3 text-center">
                  <div className="text-xs text-gray-500 mb-0.5">Total Issued</div>
                  <div className="text-xl font-bold text-blue-600">
                    {detail.reduce((s, r) => s + r.qty_issued, 0).toFixed(2)}
                  </div>
                </div>
                <div className="px-5 py-3 text-center">
                  <div className="text-xs text-gray-500 mb-0.5">Total Returned</div>
                  <div className="text-xl font-bold text-green-600">
                    {detail.reduce((s, r) => s + r.qty_returned, 0).toFixed(2)}
                  </div>
                </div>
                <div className="px-5 py-3 text-center">
                  <div className="text-xs text-gray-500 mb-0.5">Pending Return</div>
                  <div className="text-xl font-bold text-red-600">
                    {detail.reduce((s, r) => s + r.qty_pending, 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Items table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">Item No.</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">Description</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">UOM</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-blue-600">Issued</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-green-600">Returned</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-red-600">Pending Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map((row, i) => (
                      <tr key={i} className={`border-t ${row.qty_pending > 0 ? 'bg-red-50/40' : ''}`}>
                        <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{row.item_number || '—'}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">
                          {row.description_1}
                          {row.description_2 && <span className="text-gray-400 font-normal"> / {row.description_2}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{row.uom}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-blue-700">{row.qty_issued.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-green-700">{row.qty_returned.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {row.qty_pending > 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-red-600">
                              {row.qty_pending.toFixed(2)}
                              <span className="text-xs">⚠</span>
                            </span>
                          ) : (
                            <span className="text-green-600 font-semibold">✓ 0.00</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Pending Returns / Overdue Modal */}
      {pendingModal && (() => {
        const rows = pendingModal === 'overdue' ? overdue : pending;
        const title = pendingModal === 'overdue' ? 'Overdue Returns' : 'Pending Returns';
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPendingModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-lg font-bold text-gray-800">{title} <span className="ml-2 text-sm font-normal text-gray-500">({rows.length} items)</span></h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => exportToExcel(rows, title)}
                    className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium"
                  >
                    Export Excel
                  </button>
                  <button onClick={() => setPendingModal(null)} className="text-gray-400 hover:text-gray-700 text-2xl font-bold leading-none">✕</button>
                </div>
              </div>
              <div className="overflow-auto flex-1">
                {rows.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 text-sm">No items found</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Project</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Item No.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">UOM</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-blue-600">Issued</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-green-600">Returned</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-red-600">Remaining</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Issue Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Receiver</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className={`border-t ${r.issue_date < today ? 'bg-red-50/50' : ''}`}>
                          <td className="px-4 py-2.5 text-xs text-gray-700 font-medium max-w-[140px] truncate">{r.project_name}</td>
                          <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{r.item_number || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-800">{r.description_1}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{r.uom}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-blue-700">{parseFloat(r.quantity_issued).toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-green-700">{parseFloat(r.qty_returned).toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-600">{parseFloat(r.qty_remaining).toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{r.issue_date?.slice(0, 10)}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{r.receiver_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Project Timelines */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-700 mb-3">Project Timelines</h3>
        <div className="space-y-2">
          {projects.filter(p => p.is_active).map(p => {
            const end = p.end_date ? new Date(p.end_date) : null;
            const now = new Date();
            const remaining = end ? Math.ceil((end - now) / 86400000) : null;
            return (
              <div key={p.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <button
                  onClick={() => loadDetail(p.id, p.name)}
                  className="font-medium text-blue-700 hover:underline text-left"
                >
                  {p.name}
                </button>
                <div className="flex gap-4 text-xs text-gray-500">
                  {p.start_date && <span>Start: {p.start_date.slice(0, 10)}</span>}
                  {p.end_date && <span>End: {p.end_date.slice(0, 10)}</span>}
                  {remaining !== null && (
                    <span className={remaining < 0 ? 'text-red-600 font-bold' : remaining < 7 ? 'text-orange-500 font-bold' : 'text-green-600'}>
                      {remaining < 0 ? `${Math.abs(remaining)}d overdue` : `${remaining}d left`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
