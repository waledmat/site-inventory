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
    setLoading(true); setSearched(true); setSelected(null);
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
            {results.length === 0 ? (
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

export default function ProjectManagement() {
  const [projects, setProjects] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [skModal, setSkModal] = useState(null);
  const [rqModal, setRqModal] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/projects').then(r => setProjects(r.data));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); setError(''); };
  const openEdit = p => { setEditing(p.id); setForm(p); setModal(true); setError(''); };

  const save = async e => {
    e.preventDefault(); setError('');
    try {
      if (editing) await api.put(`/projects/${editing}`, form);
      else await api.post('/projects', form);
      setModal(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Error saving project'); }
  };

  const archive = async id => {
    await api.put(`/projects/${id}`, { is_active: false }); load();
  };

  const cols = [
    { key: 'project_number', header: 'Project No' },
    { key: 'name', header: 'Project Name' },
    { key: 'location', header: 'Location' },
    { key: 'start_date', header: 'Start', render: v => v?.slice(0, 10) || '—' },
    { key: 'end_date', header: 'End', render: v => v?.slice(0, 10) || '—' },
    { key: 'is_active', header: 'Status', render: v => <Badge value={v ? 'active' : 'inactive'} label={v ? 'Active' : 'Archived'} /> },
    {
      key: 'id', header: 'Actions',
      render: (id, row) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(row)} className="text-xs text-blue-600 hover:underline">Edit</button>
          <button onClick={() => setSkModal(id)} className="text-xs text-green-600 hover:underline">Assign SK</button>
          <button onClick={() => setRqModal(id)} className="text-xs text-purple-600 hover:underline">Assign Requester</button>
          {row.is_active && <button onClick={() => archive(id)} className="text-xs text-red-500 hover:underline">Archive</button>}
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
      <Table columns={cols} data={projects} />

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
              <input type="date" value={form[f] || ''} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
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

      <UserSearchModal
        isOpen={!!skModal}
        onClose={() => setSkModal(null)}
        title="Assign Storekeeper"
        accentColor="blue"
        role="storekeeper"
        onAssign={async userId => {
          await api.post(`/projects/${skModal}/storekeepers`, { user_id: userId });
          load();
        }}
      />

      <UserSearchModal
        isOpen={!!rqModal}
        onClose={() => setRqModal(null)}
        title="Assign Requester"
        accentColor="purple"
        role="requester"
        onAssign={async userId => {
          await api.post(`/projects/${rqModal}/requesters`, { user_id: userId });
          load();
        }}
      />
    </div>
  );
}
