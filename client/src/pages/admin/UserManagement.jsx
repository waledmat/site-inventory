import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

const ROLES = ['admin', 'storekeeper', 'requester', 'superuser', 'coordinator'];
const emptyForm = { name: '', employee_id: '', role: 'requester', position: '', password: '' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetDone, setResetDone] = useState(false);

  const load = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); setError(''); };
  const openEdit = u => { setEditing(u.id); setForm({ ...u, password: '' }); setModal(true); setError(''); };

  const save = async e => {
    e.preventDefault(); setError('');
    try {
      if (editing) await api.put(`/users/${editing}`, form);
      else await api.post('/users', form);
      setModal(false); load();
    } catch (err) { setError(err.response?.data?.error || 'Error saving user'); }
  };

  const authorize = async id => { await api.post(`/users/${id}/authorize`); load(); };
  const toggleActive = async u => { await api.put(`/users/${u.id}`, { is_active: !u.is_active }); load(); };

  const openReset = u => { setResetTarget(u); setNewPassword(''); setResetError(''); setResetDone(false); };
  const closeReset = () => setResetTarget(null);
  const submitReset = async e => {
    e.preventDefault(); setResetError('');
    if (!newPassword) { setResetError('Password is required'); return; }
    try {
      await api.put(`/users/${resetTarget.id}`, { password: newPassword });
      setResetDone(true);
    } catch (err) { setResetError(err.response?.data?.error || 'Error resetting password'); }
  };

  // Client-side filter
  const displayed = users.filter(u => {
    const matchText = !filterText ||
      u.name?.toLowerCase().includes(filterText.toLowerCase()) ||
      u.employee_id?.toLowerCase().includes(filterText.toLowerCase()) ||
      u.position?.toLowerCase().includes(filterText.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    return matchText && matchRole;
  });

  const cols = [
    { key: 'employee_id', header: 'Employee ID' },
    { key: 'name', header: 'Name' },
    { key: 'role', header: 'Role', render: v => <Badge value={v} /> },
    { key: 'position', header: 'Position' },
    { key: 'is_active', header: 'Status', render: v => <Badge value={v ? 'active' : 'inactive'} label={v ? 'Active' : 'Inactive'} /> },
    {
      key: 'id', header: 'Actions',
      render: (id, row) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(row)} className="text-xs text-blue-600 hover:underline">Edit</button>
          {row.role !== 'requester' && (
            <button onClick={() => authorize(id)} className="text-xs text-green-600 hover:underline">Authorize</button>
          )}
          <button onClick={() => toggleActive(row)} className={`text-xs hover:underline ${row.is_active ? 'text-red-500' : 'text-gray-500'}`}>
            {row.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={() => openReset(row)} className="text-xs text-orange-500 hover:underline">Reset Pwd</button>
        </div>
      )
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Add User</button>
      </div>

      <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3">
        <input value={filterText} onChange={e => setFilterText(e.target.value)}
          placeholder="Search by name, employee ID, or position…"
          className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm" />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(filterText || filterRole) && (
          <button onClick={() => { setFilterText(''); setFilterRole(''); }}
            className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 border rounded-lg">
            ✕ Clear
          </button>
        )}
      </div>

      {filterText || filterRole
        ? <p className="text-xs text-gray-500 mb-2">{displayed.length} of {users.length} users</p>
        : null
      }

      <Table columns={cols} data={displayed} />

      <Modal isOpen={!!resetTarget} onClose={closeReset} title={`Reset Password — ${resetTarget?.name}`}>
        {resetDone ? (
          <div className="text-center space-y-3 py-2">
            <div className="text-3xl">✅</div>
            <p className="text-sm text-gray-700">Password has been reset successfully.</p>
            <button onClick={closeReset} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Done</button>
          </div>
        ) : (
          <form onSubmit={submitReset} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" value={newPassword} autoFocus required
                onChange={e => setNewPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new password…" />
            </div>
            {resetError && <p className="text-red-500 text-sm">{resetError}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600">Reset Password</button>
              <button type="button" onClick={closeReset} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit User' : 'Add User'}>
        <form onSubmit={save} className="space-y-3">
          {[
            { key: 'name', label: 'Name', required: true },
            { key: 'employee_id', label: 'Employee ID', required: true },
            { key: 'position', label: 'Position', required: false },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input type="text" value={form[f.key] || ''} required={f.required}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{editing ? 'New Password (leave blank to keep)' : 'Password'}</label>
            <input type="password" value={form.password} required={!editing}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Save</button>
            <button type="button" onClick={() => setModal(false)} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
