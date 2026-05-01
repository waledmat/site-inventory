import { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../../utils/axiosInstance';

function UploadHistory() {
  const [history, setHistory] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) api.get('/upload/packing-list/history').then(r => setHistory(r.data)).catch(() => {});
  }, [open]);

  return (
    <div className="mt-6">
      <button onClick={() => setOpen(o => !o)} className="text-sm text-blue-600 hover:underline">
        {open ? '▲ Hide' : '▼ Show'} Upload History
      </button>
      {open && (
        <div className="mt-3 bg-white rounded-xl border overflow-hidden">
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 p-4 text-center">No uploads yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Date', 'Uploaded By', 'Project', 'Rows', 'Errors'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-600">{new Date(h.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2">{h.uploaded_by || '—'}</td>
                    <td className="px-4 py-2">{h.project_name || '—'}</td>
                    <td className="px-4 py-2 font-semibold text-green-700">{h.row_count}</td>
                    <td className="px-4 py-2 font-semibold text-red-600">{h.error_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const downloadTemplate = () => {
  const token = localStorage.getItem('token');
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
  const a = document.createElement('a');
  a.href = `${base}/upload/packing-list/template?token=${token}`;
  a.download = 'packing-list-template.xlsx';
  a.click();
};

export default function UploadPackingList() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState('');
  const [uploadError, setUploadError] = useState('');

  // New-project form
  const [newProj, setNewProj] = useState({ name: '', project_number: '' });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState(null);

  // Edit-project state
  const [editing, setEditing] = useState(null); // { id, name, project_number } | null
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState(null);

  const loadProjects = () => api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  useEffect(() => { loadProjects(); }, []);

  const createProject = async (e) => {
    e.preventDefault();
    setCreateMsg(null);
    if (!newProj.name.trim()) { setCreateMsg({ type: 'error', text: 'Project name is required' }); return; }
    setCreating(true);
    try {
      await api.post('/projects', { name: newProj.name.trim(), project_number: newProj.project_number.trim() || null });
      setCreateMsg({ type: 'success', text: `Project "${newProj.name}" created. Pick it from the list below.` });
      setNewProj({ name: '', project_number: '' });
      await loadProjects();
    } catch (err) {
      setCreateMsg({ type: 'error', text: err.response?.data?.error || 'Failed to create project' });
    } finally { setCreating(false); }
  };

  const openEdit = () => {
    const p = projects.find(x => x.id === selectedProject);
    if (!p) return;
    setEditing({ id: p.id, name: p.name || '', project_number: p.project_number || '' });
    setEditMsg(null);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing?.name.trim()) { setEditMsg({ type: 'error', text: 'Project name is required' }); return; }
    setSavingEdit(true);
    setEditMsg(null);
    try {
      await api.put(`/projects/${editing.id}`, {
        name: editing.name.trim(),
        project_number: editing.project_number.trim() || null,
      });
      await loadProjects();
      setEditing(null);
    } catch (err) {
      setEditMsg({ type: 'error', text: err.response?.data?.error || 'Failed to save changes' });
    } finally { setSavingEdit(false); }
  };

  const requestDeletion = async () => {
    const p = projects.find(x => x.id === selectedProject);
    if (!p) return;
    if (p.pending_deletion_at) {
      setCreateMsg({ type: 'error', text: `A deletion request is already pending for "${p.name}".` });
      return;
    }
    const reason = window.prompt(
      `Request deletion of project "${p.name}"?\n\nAn admin must approve before the project is archived.\n\nReason (optional):`,
      ''
    );
    if (reason === null) return; // user cancelled
    try {
      await api.post(`/projects/${p.id}/request-deletion`, { reason: reason.trim() || null });
      await loadProjects();
      setCreateMsg({ type: 'success', text: `Deletion request submitted for "${p.name}". Awaiting admin approval.` });
    } catch (err) {
      setCreateMsg({ type: 'error', text: err.response?.data?.error || 'Failed to submit deletion request' });
    }
  };

  const onDrop = useCallback(files => { setFile(files[0]); setResult(null); setDone(''); setUploadError(''); }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }, maxFiles: 1 });

  const upload = async () => {
    if (!file) return;
    if (!selectedProject) {
      setUploadError('Please select a project before uploading.');
      return;
    }
    setLoading(true); setResult(null); setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('project_id', selectedProject);
      const { data } = await api.post('/upload/packing-list', fd);
      setResult(data);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed. Check the file and try again.');
    } finally { setLoading(false); }
  };

  const confirm = async () => {
    setConfirming(true);
    try {
      await api.post('/upload/packing-list/confirm', { valid_rows: result.valid, error_count: result.errors.length });
      setDone(`✅ ${result.valid.length} rows imported successfully!`);
      setResult(null); setFile(null);
    } finally { setConfirming(false); }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Upload Packing List</h2>
        <button onClick={downloadTemplate}
          className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          📥 Download Template
        </button>
      </div>

      {/* Create new project (inline) */}
      <div className="bg-white rounded-xl border p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-700">Add New Project</h3>
          <span className="text-xs text-gray-400">First time? Create the project here, then pick it below.</span>
        </div>
        <form onSubmit={createProject} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Project Name <span className="text-red-500">*</span></label>
            <input type="text" value={newProj.name}
              onChange={e => setNewProj(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Al Riyadh Tower"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Project Number</label>
            <input type="text" value={newProj.project_number}
              onChange={e => setNewProj(p => ({ ...p, project_number: e.target.value }))}
              placeholder="e.g. 12345"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={creating}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {creating ? 'Creating…' : '➕ Create Project'}
          </button>
        </form>
        {createMsg && (
          <p className={`mt-3 text-sm px-3 py-2 rounded-lg ${createMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {createMsg.text}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Project <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm">
              <option value="">— Select a project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.project_number ? `[${p.project_number}] ` : ''}{p.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={openEdit} disabled={!selectedProject}
              title="Edit selected project"
              className="px-3 py-2 border rounded-lg text-sm hover:bg-blue-50 hover:border-blue-300 text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
              ✏️ Edit
            </button>
            <button type="button" onClick={requestDeletion}
              disabled={!selectedProject || !!projects.find(p => p.id === selectedProject)?.pending_deletion_at}
              title="Request deletion of the selected project (admin approval required)"
              className="px-3 py-2 border rounded-lg text-sm hover:bg-red-50 hover:border-red-300 text-red-600 disabled:opacity-40 disabled:cursor-not-allowed">
              🗑 Request Deletion
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {projects.length} active project{projects.length === 1 ? '' : 's'} available
          </p>
          {(() => {
            const p = projects.find(x => x.id === selectedProject);
            if (!p?.pending_deletion_at) return null;
            return (
              <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg">
                ⏳ Deletion request pending admin approval
                {p.pending_deletion_by_name && <span> — submitted by <strong>{p.pending_deletion_by_name}</strong></span>}
                {p.pending_deletion_at && <span> on {new Date(p.pending_deletion_at).toLocaleString()}</span>}
              </div>
            );
          })()}
        </div>

        {/* Inline edit form */}
        {editing && (
          <form onSubmit={saveEdit} className="border rounded-lg p-4 bg-blue-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-700">Edit Project</h4>
              <button type="button" onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Project Name <span className="text-red-500">*</span></label>
                <input type="text" value={editing.name}
                  onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Project Number</label>
                <input type="text" value={editing.project_number}
                  onChange={e => setEditing(p => ({ ...p, project_number: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {editMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${editMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {editMsg.text}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={savingEdit}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {savingEdit ? 'Saving…' : '💾 Save Changes'}
              </button>
              <button type="button" onClick={() => setEditing(null)}
                className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
          ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}>
          <input {...getInputProps()} />
          <div className="text-3xl mb-2">📂</div>
          <p className="text-gray-600 text-sm">
            {file ? <strong className="text-blue-600">{file.name}</strong> : 'Drag & drop an Excel file here, or click to browse'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Accepts .xlsx files only</p>
        </div>

        <button onClick={upload} disabled={!file || !selectedProject || loading}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Validating…' : '🔍 Validate File'}
        </button>
        {uploadError && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{uploadError}</p>}
      </div>

      {done && <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">{done}</div>}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="flex gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-green-700">
              <span className="text-2xl font-bold">{result.valid.length}</span> <span className="text-sm">valid rows</span>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-red-700">
              <span className="text-2xl font-bold">{result.errors.length}</span> <span className="text-sm">error rows</span>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div>
              <h3 className="font-semibold text-red-600 mb-2">❌ Rows with errors (will NOT be imported)</h3>
              <div className="overflow-x-auto rounded-xl border border-red-200 max-h-60 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-red-50"><tr>
                    <th className="px-3 py-2 text-left">Row</th>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-left">Errors</th>
                  </tr></thead>
                  <tbody>{result.errors.map((e, i) => (
                    <tr key={i} className="border-t border-red-100 bg-red-50/50">
                      <td className="px-3 py-2">{e.row}</td>
                      <td className="px-3 py-2">{e.data?.description_1 || '—'}</td>
                      <td className="px-3 py-2 text-red-600">{e.errors?.join(', ')}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {result.valid.length > 0 && (() => {
            const grandTotal = result.valid.reduce((s, r) => s + (Number(r.qty_on_hand || 0) * Number(r.unit_cost || 0)), 0);
            return (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-green-600">✅ Valid rows (will be imported)</h3>
                  <div className="text-sm text-gray-700">
                    Grand Total Value: <span className="font-bold text-blue-700">{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-green-200 max-h-72 overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-green-50 sticky top-0"><tr>
                      {['Y3#','ITEM NUMBER','ITEM DESCRIPTION','DESCRIPTION LINE 2','CATEGORY','UOM','Unit Cost','Project Onhand','Total Value','Container No.'].map(h => (
                        <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-semibold border-b">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>{result.valid.map((r, i) => {
                      const total = Number(r.qty_on_hand || 0) * Number(r.unit_cost || 0);
                      return (
                        <tr key={i} className="border-t border-green-100 hover:bg-green-50/50">
                          <td className="px-3 py-2 whitespace-nowrap">{r.y3_number || '—'}</td>
                          <td className="px-3 py-2 font-mono whitespace-nowrap">{r.item_number || '—'}</td>
                          <td className="px-3 py-2">{r.description_1}</td>
                          <td className="px-3 py-2">{r.description_2 || '—'}</td>
                          <td className="px-3 py-2">{r.category || '—'}</td>
                          <td className="px-3 py-2">{r.uom}</td>
                          <td className="px-3 py-2 text-right">{Number(r.unit_cost || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{r.qty_on_hand}</td>
                          <td className="px-3 py-2 text-right font-semibold text-blue-700">{total.toFixed(2)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.container_no || '—'}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
                <button onClick={confirm} disabled={confirming}
                  className="mt-3 bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {confirming ? 'Saving…' : `💾 Save (${result.valid.length} rows)`}
                </button>
              </div>
            );
          })()}
        </div>
      )}

      <UploadHistory />
    </div>
  );
}
