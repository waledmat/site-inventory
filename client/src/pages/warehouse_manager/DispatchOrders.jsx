import { useEffect, useState, useCallback } from 'react';
import api from '../../utils/axiosInstance';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { statusClass } from '../../utils/statusColors';

const emptyLine = () => ({ item_master_id: '', bin_id: '', qty_requested: '', bins: [] });
const emptyForm = () => ({ project_id: '', destination: '', notes: '', items: [emptyLine()] });

export default function DispatchOrders() {
  const toast = useToast();
  const [orders, setOrders]     = useState([]);
  const [projects, setProjects] = useState([]);
  const [items, setItems]       = useState([]);
  const [detail, setDetail]     = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]         = useState(emptyForm());
  const [filterStatus, setFilterStatus] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [confirm, setConfirm]   = useState(null); // { id, endpoint, label }

  const load = useCallback(() => {
    setLoading(true);
    const q = filterStatus ? `?status=${filterStatus}` : '';
    api.get(`/wms/dispatch${q}`).then(r => setOrders(r.data)).finally(() => setLoading(false));
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/wms/items').then(r => setItems(r.data)).catch(() => {});
    api.get('/projects').then(r => setProjects(r.data)).catch(() => {});
  }, []);

  const openCreate = () => { setForm(emptyForm()); setError(''); setShowCreate(true); };

  const addLine = () => setForm(f => ({ ...f, items: [...f.items, emptyLine()] }));
  const removeLine = i => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const updateLine = async (i, key, val) => {
    setForm(f => {
      const its = [...f.items];
      its[i] = { ...its[i], [key]: val };
      return { ...f, items: its };
    });

    // When item changes, load its available bins
    if (key === 'item_master_id' && val) {
      try {
        const r = await api.get(`/wms/inventory/bin-stock?item_master_id=${val}`);
        setForm(f => {
          const its = [...f.items];
          its[i] = { ...its[i], bins: r.data || [], bin_id: '' };
          return { ...f, items: its };
        });
      } catch { /* ignore */ }
    }
  };

  const submit = async e => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post('/wms/dispatch', {
        project_id:  form.project_id  || null,
        destination: form.destination || null,
        notes:       form.notes       || null,
        items: form.items
          .filter(it => it.item_master_id && it.qty_requested)
          .map(it => ({
            item_master_id: it.item_master_id,
            bin_id:         it.bin_id || null,
            qty_requested:  parseFloat(it.qty_requested),
          })),
      });
      setShowCreate(false);
      toast('Dispatch order created', 'success');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating dispatch order');
    } finally { setSaving(false); }
  };

  const action = (id, endpoint, label) => setConfirm({ id, endpoint, label });

  const doAction = async () => {
    const { id, endpoint, label } = confirm;
    setConfirm(null);
    try {
      await api.post(`/wms/dispatch/${id}/${endpoint}`);
      toast(`Order ${label.toLowerCase()}ed`, 'success');
      setDetail(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${label.toLowerCase()}`);
    }
  };

  const openDetail = id => {
    api.get(`/wms/dispatch/${id}`).then(r => setDetail(r.data));
  };

  const downloadPDF = (id, num) => {
    const token = localStorage.getItem('token');
    window.open(`/api/wms/dispatch/${id}/pdf?token=${token}`, '_blank');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Dispatch Orders</h2>
        <button onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Dispatch Order
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white border rounded-xl p-4 flex gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          {['draft', 'confirmed', 'dispatched', 'cancelled'].map(s =>
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          )}
        </select>
        {filterStatus && (
          <button onClick={() => setFilterStatus('')} className="text-sm text-gray-500 hover:text-gray-700">✕ Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-400 py-10 text-sm">Loading…</p>
        ) : orders.length === 0 ? (
          <EmptyState icon="box" title="No dispatch orders found" message="Create a dispatch order to send stock to a site." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Order No.', 'Project', 'Destination', 'Items', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-blue-700">{o.order_number}</td>
                  <td className="px-4 py-3 text-gray-700">{o.project_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{o.destination || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{o.item_count}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusClass(o.status)}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{String(o.created_at).slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openDetail(o.id)}
                      className="text-xs text-blue-600 hover:underline mr-2">View</button>
                    {(o.status === 'dispatched') && (
                      <button onClick={() => downloadPDF(o.id, o.order_number)}
                        className="text-xs text-purple-600 hover:underline">PDF</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Dispatch Order">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">— No specific project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination / Site</label>
              <input value={form.destination}
                onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Site name or address" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Items</label>
              <button type="button" onClick={addLine}
                className="text-xs text-blue-600 hover:underline">+ Add Line</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {form.items.map((line, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <select value={line.item_master_id} onChange={e => updateLine(i, 'item_master_id', e.target.value)}
                    required className="flex-1 border rounded-lg px-2 py-1.5 text-xs">
                    <option value="">Select item…</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>{it.item_number} — {it.description_1}</option>
                    ))}
                  </select>
                  <select value={line.bin_id} onChange={e => updateLine(i, 'bin_id', e.target.value)}
                    className="w-32 border rounded-lg px-2 py-1.5 text-xs">
                    <option value="">Any bin</option>
                    {(line.bins || []).map(b => (
                      <option key={b.bin_id || b.id} value={b.bin_id || b.id}>
                        {b.bin_code || b.full_code} ({b.qty_on_hand})
                      </option>
                    ))}
                  </select>
                  <input type="number" min="0.001" step="any" value={line.qty_requested}
                    onChange={e => updateLine(i, 'qty_requested', e.target.value)}
                    required placeholder="Qty" className="w-20 border rounded-lg px-2 py-1.5 text-xs" />
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)}
                      className="text-red-400 hover:text-red-600 text-sm mt-0.5">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Draft'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)}
        title={detail ? `${detail.order_number} — ${detail.status.toUpperCase()}` : ''}>
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Project:</span> <span className="font-medium">{detail.project_name || '—'}</span></div>
              <div><span className="text-gray-500">Destination:</span> <span className="font-medium">{detail.destination || '—'}</span></div>
              <div><span className="text-gray-500">Created by:</span> <span className="font-medium">{detail.created_by_name}</span></div>
              <div><span className="text-gray-500">Confirmed by:</span> <span className="font-medium">{detail.confirmed_by_name || '—'}</span></div>
              {detail.dispatched_at && (
                <div><span className="text-gray-500">Dispatched:</span> <span className="font-medium">{String(detail.dispatched_at).slice(0, 10)}</span></div>
              )}
            </div>
            {detail.notes && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{detail.notes}</p>}

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Items</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Item No.', 'Description', 'Bin', 'Qty', 'UOM', 'Bin Stock'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(detail.items || []).map(item => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-mono">{item.item_number}</td>
                        <td className="px-3 py-2">{item.description_1}</td>
                        <td className="px-3 py-2 font-mono text-purple-700">{item.bin_code || '—'}</td>
                        <td className="px-3 py-2 font-medium">{item.qty_requested}</td>
                        <td className="px-3 py-2 text-gray-500">{item.uom}</td>
                        <td className="px-3 py-2 text-gray-500">
                          {item.bin_stock != null ? item.bin_stock : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {detail.status === 'draft' && (
                <button onClick={() => action(detail.id, 'confirm', 'Confirm')}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                  Confirm Order
                </button>
              )}
              {detail.status === 'confirmed' && (
                <button onClick={() => action(detail.id, 'dispatch', 'Dispatch')}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                  Dispatch & Deduct Stock
                </button>
              )}
              {detail.status === 'dispatched' && (
                <button onClick={() => downloadPDF(detail.id, detail.order_number)}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700">
                  Download PDF
                </button>
              )}
              {['draft', 'confirmed'].includes(detail.status) && (
                <button onClick={() => action(detail.id, 'cancel', 'Cancel')}
                  className="px-4 py-2 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50">
                  Cancel
                </button>
              )}
              <button onClick={() => setDetail(null)}
                className="px-4 py-2 border rounded-lg text-sm">Close</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirm}
        title={confirm ? `${confirm.label} Dispatch Order` : ''}
        message={confirm ? `${confirm.label} this dispatch order?` : ''}
        confirmLabel={confirm?.label}
        danger={confirm?.label === 'Cancel'}
        onConfirm={doAction}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
