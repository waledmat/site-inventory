import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Badge from '../../components/common/Badge';

const emptyForm = { project_number: '', name: '', location: '', start_date: '', end_date: '' };

export default function ProjectManagement() {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [skModal, setSkModal] = useState(null);
  const [selectedSk, setSelectedSk] = useState('');
  const [rqModal, setRqModal] = useState(null);
  const [selectedRq, setSelectedRq] = useState('');
  const [requesters, setRequesters] = useState([]);
  const [error, setError] = useState('');

  const load = () => api.get('/projects').then(r => setProjects(r.data));
  useEffect(() => {
    load();
    api.get('/users?role=storekeeper').then(r => setUsers(r.data));
    api.get('/users?role=requester').then(r => setRequesters(r.data));
  }, []);

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

  const assignSk = async () => {
    if (!selectedSk) return;
    await api.post(`/projects/${skModal}/storekeepers`, { user_id: selectedSk });
    setSkModal(null); load();
  };

  const assignRq = async () => {
    if (!selectedRq) return;
    await api.post(`/projects/${rqModal}/requesters`, { user_id: selectedRq });
    setRqModal(null); load();
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
          <button onClick={() => { setRqModal(id); setSelectedRq(''); }} className="text-xs text-purple-600 hover:underline">Assign Requester</button>
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

      <Modal isOpen={!!skModal} onClose={() => setSkModal(null)} title="Assign Storekeeper">
        <div className="space-y-3">
          <select value={selectedSk} onChange={e => setSelectedSk(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Select storekeeper…</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
          </select>
          <div className="flex gap-3">
            <button onClick={assignSk} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm">Assign</button>
            <button onClick={() => setSkModal(null)} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!rqModal} onClose={() => setRqModal(null)} title="Assign Requester">
        <div className="space-y-3">
          <select value={selectedRq} onChange={e => setSelectedRq(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Select requester…</option>
            {requesters.map(u => <option key={u.id} value={u.id}>{u.name} ({u.employee_id})</option>)}
          </select>
          <div className="flex gap-3">
            <button onClick={assignRq} className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm">Assign</button>
            <button onClick={() => setRqModal(null)} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
