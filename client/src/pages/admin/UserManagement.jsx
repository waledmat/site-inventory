import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

const ROLES = ['admin', 'storekeeper', 'requester', 'superuser', 'coordinator', 'warehouse_manager', 'receiver', 'picker'];
const emptyForm = { name: '', employee_id: '', role: 'requester', position: '', password: '' };

const PERMISSION_GROUPS = [
  {
    group: 'Requests',
    items: [
      { key: 'can_submit_requests',  label: 'Submit material requests' },
      { key: 'can_approve_requests', label: 'Approve / reject requests' },
    ],
  },
  {
    group: 'Stock & Inventory',
    items: [
      { key: 'can_view_stock',          label: 'View stock levels' },
      { key: 'can_issue_material',      label: 'Issue material' },
      { key: 'can_manage_returns',      label: 'Process material returns' },
      { key: 'can_upload_packing_list', label: 'Upload packing list (Excel)' },
      { key: 'can_view_all_projects',   label: 'View all projects (not just assigned)' },
    ],
  },
  {
    group: 'Reports & Export',
    items: [
      { key: 'can_view_reports', label: 'View analytics & reports' },
      { key: 'can_export_data',  label: 'Export data (PDF / Excel)' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { key: 'can_manage_users',    label: 'Manage users' },
      { key: 'can_manage_projects', label: 'Manage projects' },
      { key: 'can_view_audit_log',  label: 'View audit log' },
    ],
  },
];

// Permissions each role gets by default (locked — cannot be removed)
const ROLE_DEFAULTS = {
  admin: {
    can_submit_requests: true, can_approve_requests: true,
    can_view_stock: true, can_issue_material: true, can_manage_returns: true,
    can_upload_packing_list: true, can_view_all_projects: true,
    can_view_reports: true, can_export_data: true,
    can_manage_users: true, can_manage_projects: true, can_view_audit_log: true,
  },
  superuser: {
    can_submit_requests: true,
    can_view_stock: true, can_upload_packing_list: true, can_view_all_projects: true,
    can_view_reports: true, can_export_data: true, can_manage_projects: true,
  },
  storekeeper: {
    can_view_stock: true, can_issue_material: true,
    can_manage_returns: true, can_export_data: true,
  },
  requester: {
    can_submit_requests: true,
  },
  coordinator: {
    can_submit_requests: true, can_approve_requests: true, can_view_reports: true,
  },
  warehouse_manager: {
    can_view_stock: true, can_view_all_projects: true,
    can_view_reports: true, can_export_data: true, can_manage_projects: true,
  },
  receiver: {
    can_view_stock: true,
  },
  picker: {
    can_view_stock: true, can_issue_material: true,
  },
};

const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));

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
  const [authTarget, setAuthTarget] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [authSaved, setAuthSaved] = useState(false);

  // Import state
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importDone, setImportDone] = useState('');
  const [confirming, setConfirming] = useState(false);

  const load = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const genEmployeeId = () => {
    const nums = users.map(u => parseInt(u.employee_id)).filter(n => !isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1001;
    return String(next);
  };

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, employee_id: genEmployeeId() }); setModal(true); setError(''); };
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

  const openAuthority = async u => {
    setAuthSaved(false);
    const { data } = await api.get(`/users/${u.id}/permissions`);
    setPermissions(data || {});
    setAuthTarget(u);
  };
  const closeAuthority = () => setAuthTarget(null);
  const saveAuthority = async () => {
    await api.put(`/users/${authTarget.id}/permissions`, permissions);
    setAuthSaved(true);
  };
  const togglePerm = key => setPermissions(p => ({ ...p, [key]: !p[key] }));

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

  // Import handlers
  const openImport = () => {
    setImportModal(true);
    setImportFile(null);
    setImportResult(null);
    setImportError('');
    setImportDone('');
  };

  const downloadTemplate = () => {
    const token = localStorage.getItem('token');
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
    const a = document.createElement('a');
    a.href = `${base}/users/bulk-import/template?token=${token}`;
    a.download = 'user-import-template.xlsx';
    a.click();
  };

  const validateImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setImportResult(null);
    setImportError('');
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const { data } = await api.post('/users/bulk-import/validate', fd);
      setImportResult(data);
    } catch (err) {
      setImportError(err.response?.data?.error || 'Validation failed');
    } finally {
      setImportLoading(false);
    }
  };

  const confirmImport = async () => {
    setConfirming(true);
    setImportError('');
    try {
      await api.post('/users/bulk-import/confirm', { valid_rows: importResult.valid });
      setImportDone(`${importResult.valid.length} users created successfully.`);
      setImportResult(null);
      setImportFile(null);
      load();
    } catch (err) {
      setImportError(err.response?.data?.error || 'Import failed');
    } finally {
      setConfirming(false);
    }
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
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => openEdit(row)} className="text-xs text-blue-600 hover:underline">Edit</button>
          {row.role !== 'requester' && (
            <button onClick={() => authorize(id)} className="text-xs text-green-600 hover:underline">Authorize</button>
          )}
          <button onClick={() => openAuthority(row)} className="text-xs text-purple-600 hover:underline">Authority</button>
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
        <div className="flex gap-2">
          <button onClick={downloadTemplate}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            Download Template
          </button>
          <button onClick={openImport}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
            Import Users
          </button>
          <button onClick={openCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            + Add User
          </button>
        </div>
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
            Clear
          </button>
        )}
      </div>

      {filterText || filterRole
        ? <p className="text-xs text-gray-500 mb-2">{displayed.length} of {users.length} users</p>
        : null
      }

      <Table columns={cols} data={displayed} />

      {/* Reset Password Modal */}
      <Modal isOpen={!!resetTarget} onClose={closeReset} title={`Reset Password — ${resetTarget?.name}`}>
        {resetDone ? (
          <div className="text-center space-y-3 py-2">
            <div className="text-3xl">Done</div>
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

      {/* Customize Authority Modal */}
      <Modal isOpen={!!authTarget} onClose={closeAuthority} title={`Customize Authority — ${authTarget?.name}`}>
        {authTarget && (() => {
          const roleDefaults = ROLE_DEFAULTS[authTarget.role] || {};
          const defaultKeys = ALL_PERMISSION_KEYS.filter(k => roleDefaults[k]);
          const extraKeys   = ALL_PERMISSION_KEYS.filter(k => !roleDefaults[k]);

          return (
            <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">

              {/* Default permissions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Default</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Based on role: {authTarget.role}</span>
                </div>
                {defaultKeys.length === 0
                  ? <p className="text-xs text-gray-400 italic">No default permissions for this role.</p>
                  : (
                    <div className="grid grid-cols-1 gap-1.5">
                      {defaultKeys.map(key => {
                        const label = PERMISSION_GROUPS.flatMap(g => g.items).find(i => i.key === key)?.label || key;
                        return (
                          <div key={key} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                            </svg>
                            <span className="text-sm text-gray-600">{label}</span>
                            <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                              </svg>
                              Default
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )
                }
              </div>

              {/* Additional / extra permissions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Additional</span>
                  <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Extra privileges</span>
                </div>
                {extraKeys.length === 0
                  ? <p className="text-xs text-gray-400 italic">This role already has all permissions.</p>
                  : (
                    <div className="grid grid-cols-1 gap-1.5">
                      {extraKeys.map(key => {
                        const label = PERMISSION_GROUPS.flatMap(g => g.items).find(i => i.key === key)?.label || key;
                        return (
                          <label key={key} className="flex items-center gap-3 cursor-pointer hover:bg-purple-50 rounded-lg px-3 py-2 transition-colors">
                            <input
                              type="checkbox"
                              checked={!!permissions[key]}
                              onChange={() => togglePerm(key)}
                              className="w-4 h-4 rounded accent-purple-600"
                            />
                            <span className="text-sm text-gray-700">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )
                }
              </div>
            </div>
          );
        })()}
        {authSaved && <p className="text-green-600 text-sm mt-3">✅ Authority saved!</p>}
        <div className="flex gap-3 pt-4 border-t mt-4">
          <button onClick={saveAuthority} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Save Authority
          </button>
          <button onClick={closeAuthority} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
        </div>
      </Modal>

      {/* Add / Edit User Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit User' : 'Add User'}>
        <form onSubmit={save} className="space-y-3">
          {[
            { key: 'name', label: 'Name', required: true },
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employee ID {!editing && <span className="text-xs text-gray-400 font-normal ml-1">(auto-generated)</span>}
            </label>
            <input type="text" value={form.employee_id || ''} required
              readOnly={!editing}
              onChange={e => editing && setForm(p => ({ ...p, employee_id: e.target.value }))}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${!editing ? 'bg-gray-100 text-gray-500 cursor-default' : 'focus:outline-none focus:ring-2 focus:ring-blue-500'}`} />
          </div>
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

      {/* Import Users Modal */}
      <Modal isOpen={importModal} onClose={() => setImportModal(false)} title="Import Users from Excel" wide>
        {importDone ? (
          <div className="text-center space-y-3 py-4">
            <p className="text-green-700 font-medium">{importDone}</p>
            <button onClick={() => setImportModal(false)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1: File upload */}
            <div className="flex items-center gap-3">
              <input type="file" accept=".xlsx,.xls"
                onChange={e => { setImportFile(e.target.files[0] || null); setImportResult(null); setImportError(''); setImportDone(''); }}
                className="flex-1 text-sm border rounded-lg px-3 py-2" />
              <button onClick={validateImport} disabled={!importFile || importLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {importLoading ? 'Validating…' : 'Validate'}
              </button>
            </div>

            {importError && <p className="text-red-500 text-sm">{importError}</p>}

            {/* Step 2: Validation results */}
            {importResult && (
              <div className="space-y-3">
                <div className="flex gap-4 text-sm font-medium">
                  <span className="text-green-700">{importResult.valid.length} valid</span>
                  {importResult.errors.length > 0 && (
                    <span className="text-red-600">{importResult.errors.length} errors</span>
                  )}
                </div>

                {/* Error rows */}
                {importResult.errors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-red-600 mb-1">Rows with errors (will be skipped):</p>
                    <div className="max-h-40 overflow-y-auto border rounded-lg divide-y text-xs">
                      {importResult.errors.map((e, i) => (
                        <div key={i} className="px-3 py-2 bg-red-50">
                          <span className="font-medium">Row {e.row}</span>
                          {e.data.name && <span className="text-gray-600 ml-2">{e.data.name}</span>}
                          <span className="text-red-600 ml-2">{e.errors.join('; ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Valid rows preview */}
                {importResult.valid.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Preview (users to be created):</p>
                    <div className="max-h-52 overflow-auto border rounded-lg text-xs">
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            {['Name', 'Employee ID', 'Role', 'Position', 'Password'].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {importResult.valid.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2">{row.name}</td>
                              <td className="px-3 py-2">
                                {row.employee_id}
                                {row.generated_id && <span className="ml-1 text-gray-400">(auto)</span>}
                              </td>
                              <td className="px-3 py-2">{row.role}</td>
                              <td className="px-3 py-2">{row.position || '—'}</td>
                              <td className="px-3 py-2 font-mono">
                                {row.password}
                                {row.generated_password && <span className="ml-1 text-orange-500">(auto)</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {importResult.valid.some(r => r.generated_password) && (
                      <p className="text-xs text-orange-600 mt-1 font-medium">
                        Auto-generated passwords are shown only once. Copy them before confirming.
                      </p>
                    )}
                    <div className="flex gap-3 pt-2">
                      <button onClick={confirmImport} disabled={confirming}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                        {confirming ? 'Creating…' : `Create ${importResult.valid.length} Users`}
                      </button>
                      <button onClick={() => setImportModal(false)}
                        className="flex-1 border py-2 rounded-lg text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {importResult.valid.length === 0 && importResult.errors.length > 0 && (
                  <p className="text-sm text-gray-500">No valid rows to import. Please fix the errors in your file and try again.</p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
