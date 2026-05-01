import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

const emptyForm = { project_number: '', name: '', location: '', start_date: '', end_date: '' };
const emptySearch = { name: '', id: '' };

function UserSearchModal({ isOpen, onClose, title, accentColor, role, onAssign }) {
  const [search, setSearch] = useState(emptySearch);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => { setSearch(emptySearch); setResults([]); setSelected(null); setSearched(false); };

  const handleClose = () => { reset(); onClose(); };

  const doSearch = async () => {
    setLoading(true); setSearched(true); setSelected(null); setResults([]);
    try {
      const { data } = await api.get(`/users?role=${role}`);
      const nameQ = search.name.toLowerCase().trim();
      const idQ = search.id.toLowerCase().trim();
      setResults(data.filter(u => {
        const nameMatch = !nameQ || u.name.toLowerCase().includes(nameQ);
        const idMatch = !idQ || (u.employee_id || '').toLowerCase().includes(idQ);
        return nameMatch && idMatch;
      }));
    } finally { setLoading(false); }
  };

  const handleAssign = async () => {
    if (!selected) return;
    await onAssign(selected.id);
    handleClose();
  };

  const accent = accentColor === 'purple'
    ? { btn: 'bg-purple-600 hover:bg-purple-700', row: 'bg-purple-100', hover: 'hover:bg-purple-50' }
    : { btn: 'bg-blue-600 hover:bg-blue-700', row: 'bg-blue-100', hover: 'hover:bg-blue-50' };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              autoFocus
              placeholder="Search by name…"
              value={search.name}
              onChange={e => setSearch(p => ({ ...p, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee ID</label>
            <input
              placeholder="Search by ID…"
              value={search.id}
              onChange={e => setSearch(p => ({ ...p, id: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={doSearch}
              className={`${accent.btn} text-white px-4 py-2 rounded-lg text-sm font-medium`}
            >
              {loading ? '…' : 'Search'}
            </button>
          </div>
        </div>

        {searched && (
          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-3 text-sm text-gray-400 text-center">Searching…</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-400 text-center">No users found</p>
            ) : results.map(u => (
              <div
                key={u.id}
                onClick={() => setSelected(u)}
                className={`px-3 py-2 text-sm cursor-pointer ${accent.hover} ${selected?.id === u.id ? accent.row + ' font-medium' : ''}`}
              >
                <span className="font-medium">{u.name}</span>
                <span className="text-gray-400 ml-2 text-xs">ID: {u.employee_id}</span>
              </div>
            ))}
          </div>
        )}

        {selected && (
          <div className="bg-gray-50 border rounded-lg px-3 py-2 text-sm">
            Selected: <span className="font-semibold">{selected.name}</span>
            <span className="text-gray-500 ml-2">({selected.employee_id})</span>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={handleAssign}
            disabled={!selected}
            className={`flex-1 ${accent.btn} text-white py-2 rounded-lg text-sm disabled:opacity-40`}
          >
            Assign
          </button>
          <button onClick={handleClose} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

const fmt = v => v?.slice(0, 10) || '—';
const num = v => Number(v || 0).toLocaleString();

function DetailDrawer({ project, onClose, onEdit, onAssignSk, onAssignRq, onRemoveSk }) {
  const [tab, setTab] = useState('overview');
  if (!project) return null;

  const tabs = [
    { key: 'overview',    label: 'Overview' },
    { key: 'people',      label: 'People' },
    { key: 'packing',     label: 'Packing List' },
    { key: 'requests',    label: 'Requests' },
  ];

  const statusColor = project.is_active
    ? 'bg-green-100 text-green-700'
    : 'bg-gray-100 text-gray-500';

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-gray-50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {project.project_number && (
                  <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {project.project_number}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor}`}>
                  {project.is_active ? 'Active' : 'Archived'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-800">{project.name}</h2>
              {project.location && <p className="text-sm text-gray-500 mt-0.5">{project.location}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => onEdit(project)}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                Edit
              </button>
              <button onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1">×</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Overview Tab */}
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Project No', project.project_number || '—'],
                  ['Location',   project.location || '—'],
                  ['Start Date', fmt(project.start_date)],
                  ['End Date',   fmt(project.end_date)],
                ].map(([l, v]) => (
                  <div key={l} className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">{l}</p>
                    <p className="font-semibold text-gray-800">{v}</p>
                  </div>
                ))}
              </div>

              {/* Stock summary cards */}
              {project.stock_summary && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Stock Summary</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Total Items',    num(project.stock_summary.total_items),    'bg-blue-50   text-blue-700'],
                      ['Qty On Hand',    num(project.stock_summary.total_on_hand),  'bg-green-50  text-green-700'],
                      ['Qty Issued',     num(project.stock_summary.total_issued),   'bg-orange-50 text-orange-700'],
                      ['Qty Returned',   num(project.stock_summary.total_returned), 'bg-purple-50 text-purple-700'],
                    ].map(([l, v, cls]) => (
                      <div key={l} className={`rounded-xl p-4 ${cls.split(' ')[0]}`}>
                        <p className={`text-xs font-medium mb-1 ${cls.split(' ')[1]}`}>{l}</p>
                        <p className={`text-2xl font-bold ${cls.split(' ')[1]}`}>{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* People Tab */}
          {tab === 'people' && (
            <div className="space-y-6">
              {/* Storekeepers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700">Storekeepers</p>
                  <button onClick={() => onAssignSk(project.id)}
                    className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700">
                    + Assign
                  </button>
                </div>
                {project.storekeepers?.length === 0
                  ? <p className="text-sm text-gray-400 italic">No storekeeper assigned.</p>
                  : (
                    <div className="space-y-2">
                      {project.storekeepers.map(u => (
                        <div key={u.id} className="flex items-center justify-between bg-green-50 rounded-lg px-4 py-2.5">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{u.name}</p>
                            <p className="text-xs text-gray-500">{u.employee_id}{u.position ? ` — ${u.position}` : ''}</p>
                          </div>
                          <button onClick={() => onRemoveSk(project.id, u.id)}
                            className="text-xs text-red-400 hover:text-red-600">Remove</button>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>

              {/* Requesters */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700">Requesters</p>
                  <button onClick={() => onAssignRq(project.id)}
                    className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700">
                    + Assign
                  </button>
                </div>
                {project.requesters?.length === 0
                  ? <p className="text-sm text-gray-400 italic">No requester assigned.</p>
                  : (
                    <div className="space-y-2">
                      {project.requesters.map(u => (
                        <div key={u.id} className="flex items-center bg-purple-50 rounded-lg px-4 py-2.5">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{u.name}</p>
                            <p className="text-xs text-gray-500">{u.employee_id}{u.position ? ` — ${u.position}` : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            </div>
          )}

          {/* Packing List Tab */}
          {tab === 'packing' && (
            <div>
              {(!project.stock_items || project.stock_items.length === 0)
                ? <p className="text-sm text-gray-400 italic">No stock items uploaded for this project.</p>
                : (() => {
                    const grandTotal = project.stock_items.reduce(
                      (s, it) => s + Number(it.total_value ?? (Number(it.qty_on_hand || 0) * Number(it.unit_cost || 0))),
                      0
                    );
                    const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b">
                              {['Item No', 'Description', 'Cat', 'UOM', 'On Hand', 'Unit Cost', 'Total Value', 'Issued', 'Returned', 'Container'].map(h => (
                                <th key={h} className="text-left px-3 py-2 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {project.stock_items.map((item, i) => {
                              const lineTotal = Number(item.total_value ?? (Number(item.qty_on_hand || 0) * Number(item.unit_cost || 0)));
                              return (
                                <tr key={i} className="border-b hover:bg-gray-50">
                                  <td className="px-3 py-2 font-mono text-gray-700">{item.item_number || '—'}</td>
                                  <td className="px-3 py-2 text-gray-800 max-w-[180px] truncate" title={item.description_1}>{item.description_1}</td>
                                  <td className="px-3 py-2">
                                    {item.category ? <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">{item.category}</span> : '—'}
                                  </td>
                                  <td className="px-3 py-2 text-gray-600">{item.uom}</td>
                                  <td className="px-3 py-2 font-semibold text-green-700">{num(item.qty_on_hand)}</td>
                                  <td className="px-3 py-2 text-gray-700">{fmtMoney(item.unit_cost)}</td>
                                  <td className="px-3 py-2 font-semibold text-blue-700">{fmtMoney(lineTotal)}</td>
                                  <td className="px-3 py-2 text-orange-600">{num(item.qty_issued)}</td>
                                  <td className="px-3 py-2 text-purple-600">{num(item.qty_returned)}</td>
                                  <td className="px-3 py-2 text-gray-500">{item.container_no || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-blue-50 border-t-2 border-blue-300 font-bold">
                              <td className="px-3 py-2.5 text-gray-700" colSpan={6}>GRAND TOTAL VALUE</td>
                              <td className="px-3 py-2.5 text-blue-800 text-base">{fmtMoney(grandTotal)}</td>
                              <td colSpan={3}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })()
              }
            </div>
          )}

          {/* Requests Tab */}
          {tab === 'requests' && (
            <div>
              {(!project.recent_requests || project.recent_requests.length === 0)
                ? <p className="text-sm text-gray-400 italic">No material requests for this project.</p>
                : (
                  <div className="space-y-2">
                    {project.recent_requests.map(r => (
                      <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.requester_name}
                            <span className="text-xs text-gray-400 ml-1">({r.employee_id})</span>
                          </p>
                          <p className="text-xs text-gray-500">{r.item_count} item(s) · {fmt(r.created_at)}</p>
                        </div>
                        <Badge value={r.status} />
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectManagement() {
  const [projects, setProjects] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [skModal, setSkModal] = useState(null);
  const [rqModal, setRqModal] = useState(null);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);

  const load = () => api.get('/projects').then(r => setProjects(r.data));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); setError(''); };
  const openEdit = p => { setEditing(p.id); setForm(p); setModal(true); setError(''); };

  const openDetail = async p => {
    const { data } = await api.get(`/projects/${p.id}`);
    setDetail(data);
  };
  const closeDetail = () => setDetail(null);
  const refreshDetail = async () => {
    if (detail) { const { data } = await api.get(`/projects/${detail.id}`); setDetail(data); }
  };

  const save = async e => {
    e.preventDefault(); setError('');
    try {
      if (editing) await api.put(`/projects/${editing}`, form);
      else await api.post('/projects', form);
      setModal(false); load(); refreshDetail();
    } catch (err) { setError(err.response?.data?.error || 'Error saving project'); }
  };


  const assignSk = async (userId) => {
    await api.post(`/projects/${skModal}/storekeepers`, { user_id: userId });
    setSkModal(null); load(); refreshDetail();
  };

  const assignRq = async (userId) => {
    await api.post(`/projects/${rqModal}/requesters`, { user_id: userId });
    setRqModal(null); load(); refreshDetail();
  };

  const removeSk = async (projectId, userId) => {
    await api.delete(`/projects/${projectId}/storekeepers/${userId}`);
    load(); refreshDetail();
  };


  const archive = async id => {
    await api.put(`/projects/${id}`, { is_active: false }); load();
  };

  const cols = [
    { key: 'project_number', header: 'Project No' },
    { key: 'name', header: 'Project Name' },
    { key: 'location', header: 'Location' },
    { key: 'start_date', header: 'Start', render: v => fmt(v) },
    { key: 'end_date',   header: 'End',   render: v => fmt(v) },
    { key: 'is_active',  header: 'Status', render: v => <Badge value={v ? 'active' : 'inactive'} label={v ? 'Active' : 'Archived'} /> },
    {
      key: 'id', header: 'Actions',
      render: (id, row) => (
        <div className="flex gap-2">
          <button onClick={e => { e.stopPropagation(); openEdit(row); }} className="text-xs text-blue-600 hover:underline">Edit</button>
          <button onClick={e => { e.stopPropagation(); setSkModal(id); }} className="text-xs text-green-600 hover:underline">Assign SK</button>
          <button onClick={e => { e.stopPropagation(); setRqModal(id); }} className="text-xs text-purple-600 hover:underline">Assign Requester</button>
          {row.is_active && <button onClick={e => { e.stopPropagation(); archive(id); }} className="text-xs text-red-500 hover:underline">Archive</button>}
        </div>
      )
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Project Management</h2>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Add Project</button>
      </div>
      <p className="text-xs text-gray-400 mb-3">Click any row to view full project details.</p>

      <div className="[&_tr]:cursor-pointer">
        <Table columns={cols} data={projects} onRowClick={openDetail} />
      </div>

      {/* Project Detail Drawer */}
      {detail && (
        <DetailDrawer
          project={detail}
          onClose={closeDetail}
          onEdit={p => { closeDetail(); openEdit(p); }}
          onAssignSk={id => setSkModal(id)}
          onAssignRq={id => setRqModal(id)}
          onRemoveSk={removeSk}
        />
      )}

      {/* Edit / Create Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Project' : 'New Project'}>
        <form onSubmit={save} className="space-y-3">
          {[['project_number','Project No',false],['name','Project Name',true],['location','Location',false]].map(([f,l,req]) => (
            <div key={f}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
              <input value={form[f] || ''} required={req} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
          {[['start_date','Start Date'],['end_date','End Date']].map(([f,l]) => (
            <div key={f}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
              <input type="date" value={form[f]?.slice(0,10) || ''} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm">Save</button>
            <button type="button" onClick={() => setModal(false)} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Assign Storekeeper Modal */}
      <UserSearchModal
        isOpen={!!skModal}
        onClose={() => setSkModal(null)}
        title="Assign Storekeeper"
        accentColor="blue"
        role="storekeeper"
        onAssign={assignSk}
      />

      {/* Assign Requester Modal */}
      <UserSearchModal
        isOpen={!!rqModal}
        onClose={() => setRqModal(null)}
        title="Assign Requester"
        accentColor="purple"
        role="requester"
        onAssign={assignRq}
      />
    </div>
  );
}
