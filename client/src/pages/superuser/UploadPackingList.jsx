import { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../../utils/axiosInstance';

export default function UploadPackingList() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState('');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => { api.get('/projects').then(r => setProjects(r.data)); }, []);

  const onDrop = useCallback(files => { setFile(files[0]); setResult(null); setDone(''); setUploadError(''); }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }, maxFiles: 1 });

  const upload = async () => {
    if (!file) return;
    setLoading(true); setResult(null); setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (selectedProject) fd.append('project_id', selectedProject);
      const { data } = await api.post('/upload/packing-list', fd);
      setResult(data);
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Upload failed. Check the file and try again.');
    } finally { setLoading(false); }
  };

  const confirm = async () => {
    setConfirming(true);
    try {
      await api.post('/upload/packing-list/confirm', { valid_rows: result.valid });
      setDone(`✅ ${result.valid.length} rows imported successfully!`);
      setResult(null); setFile(null);
    } finally { setConfirming(false); }
  };

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Upload Packing List</h2>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project (optional — overrides project column in file)</label>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">— Use project from file —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_number ? `[${p.project_number}] ` : ''}{p.name}</option>)}
          </select>
        </div>

        <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
          ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}>
          <input {...getInputProps()} />
          <div className="text-3xl mb-2">📂</div>
          <p className="text-gray-600 text-sm">
            {file ? <strong className="text-blue-600">{file.name}</strong> : 'Drag & drop an Excel file here, or click to browse'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Accepts .xlsx files only</p>
        </div>

        <button onClick={upload} disabled={!file || loading}
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

          {result.valid.length > 0 && (
            <div>
              <h3 className="font-semibold text-green-600 mb-2">✅ Valid rows (will be imported)</h3>
              <div className="overflow-x-auto rounded-xl border border-green-200 max-h-72 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-green-50 sticky top-0"><tr>
                    {['PROJECT NAME','Y3#','CATEGORY','ITEM NUMBER','ITEM DESCRIPTION','DESCRIPTION LINE 2','UOM','Project Onhand','Container No.','Issued Quantity','ID issued by','Received By','Returned Quantity','Pending Return QTY'].map(h => (
                      <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-semibold border-b">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{result.valid.map((r, i) => (
                    <tr key={i} className="border-t border-green-100 hover:bg-green-50/50">
                      <td className="px-3 py-2 whitespace-nowrap">{r.project_name || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.y3_number || '—'}</td>
                      <td className="px-3 py-2">{r.category || '—'}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{r.item_number || '—'}</td>
                      <td className="px-3 py-2">{r.description_1}</td>
                      <td className="px-3 py-2">{r.description_2 || '—'}</td>
                      <td className="px-3 py-2">{r.uom}</td>
                      <td className="px-3 py-2 text-right">{r.qty_on_hand}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.container_no || '—'}</td>
                      <td className="px-3 py-2 text-right">{r.qty_issued || 0}</td>
                      <td className="px-3 py-2">{r.issued_by_id || '—'}</td>
                      <td className="px-3 py-2">{r.received_by_id || '—'}</td>
                      <td className="px-3 py-2 text-right">{r.qty_returned || 0}</td>
                      <td className="px-3 py-2 text-right">{r.qty_pending_return || 0}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <button onClick={confirm} disabled={confirming}
                className="mt-3 bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {confirming ? 'Saving…' : `💾 Save (${result.valid.length} rows)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
