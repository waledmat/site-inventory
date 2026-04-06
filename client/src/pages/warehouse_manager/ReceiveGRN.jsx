import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { statusClass } from '../../utils/statusColors';

export default function ReceiveGRN() {
  const toast = useToast();
  const { token } = useAuth();
  const [grns, setGRNs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [pos, setPOs] = useState([]);
  const [selectedGRN, setSelectedGRN] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', po_id: '', received_date: '', notes: '', items: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = () => {
    setLoading(true);
    const q = filterStatus ? `?status=${filterStatus}` : '';
    api.get(`/wms/receiving/grn${q}`).then(r => setGRNs(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get('/wms/suppliers?active=true').then(r => setSuppliers(r.data));
    api.get('/wms/items').then(r => setItems(r.data));
    api.get('/wms/receiving/po?status=sent').then(r => setPOs(r.data));
  }, []);

  const openCreate = () => {
    const today = new Date().toISOString().slice(0, 10);
    setForm({ supplier_id: '', po_id: '', received_date: today, notes: '',
      items: [{ item_master_id: '', qty_received: '', condition: 'good' }] });
    setError('');
    setShowCreate(true);
  };

  const addLine = () => setForm(f => ({ ...f, items: [...f.items, { item_master_id: '', qty_received: '', condition: 'good' }] }));
  const removeLine = i => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateLine = (i, key, val) => setForm(f => {
    const its = [...f.items]; its[i] = { ...its[i], [key]: val }; return { ...f, items: its };
  });

  // When PO is selected, pre-fill items
  const selectPO = async (poId) => {
    setForm(f => ({ ...f, po_id: poId }));
    if (!poId) return;
    const po = pos.find(p => p.id === poId);
    if (!po) return;
    setForm(f => ({ ...f, supplier_id: po.supplier_id }));
    const { data } = await api.get(`/wms/receiving/po/${poId}`);
    const outstanding = data.items.filter(it => it.qty_received < it.qty_ordered);
    if (outstanding.length > 0) {
      setForm(f => ({
        ...f,
        items: outstanding.map(it => ({
          item_master_id: it.item_master_id,
          po_item_id: it.id,
          qty_received: String(it.qty_ordered - it.qty_received),
          condition: 'good'
        }))
      }));
    }
  };

  const submit = async e => {
    e.preventDefault(); setError('');
    try {
      await api.post('/wms/receiving/grn', {
        ...form,
        po_id: form.po_id || null,
        items: form.items.filter(it => it.item_master_id && it.qty_received).map(it => ({
          ...it, qty_received: parseFloat(it.qty_received)
        }))
      });
      setShowCreate(false);
      toast('GRN created successfully', 'success');
      load();
    } catch (err) { setError(err.response?.data?.error || 'Error creating GRN'); }
  };

  const confirmGRN = async (id) => {
    setConfirming(id);
    try {
      const { data } = await api.post(`/wms/receiving/grn/${id}/confirm`);
      toast(`GRN confirmed — ${data.putaway_tasks_created} putaway task(s) created`, 'success');
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'Error confirming GRN', 'error');
    } finally { setConfirming(null); }
  };

  const viewGRN = async id => {
    const { data } = await api.get(`/wms/receiving/grn/${id}`);
    setSelectedGRN(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Goods Receipt Notes</h2>
        <button onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + New GRN
        </button>
      </div>

      <div className="bg-white border rounded-xl p-4 mb-4 flex flex-wrap gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search GRN number or supplier…"
          className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
        </select>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-gray-400">Loading…</p>
        ) : grns.length === 0 ? (
          <EmptyState icon="box" title="No goods receipts yet" message="Create a GRN to record incoming stock from suppliers." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['GRN Number','Supplier','Date','Items','Status',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {grns.filter(g => !search || g.grn_number.toLowerCase().includes(search.toLowerCase()) || g.supplier_name.toLowerCase().includes(search.toLowerCase())).map(g => (
                <tr key={g.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold text-blue-700">{g.grn_number}</td>
                  <td className="px-4 py-3">{g.supplier_name}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(g.received_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-500">{g.item_count}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass(g.status)}`}>
                      {g.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex items-center gap-3">
                    <button onClick={() => viewGRN(g.id)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium">View</button>
                    <a href={`/api/wms/receiving/grn/${g.id}/pdf?token=${token}`} target="_blank" rel="noreferrer"
                      className="text-purple-600 hover:text-purple-800 text-xs font-medium">PDF</a>
                    {g.status === 'draft' && (
                      <button onClick={() => confirmGRN(g.id)}
                        disabled={confirming === g.id}
                        className="text-green-600 hover:text-green-800 text-xs font-medium disabled:opacity-50">
                        {confirming === g.id ? 'Confirming…' : 'Confirm & Putaway'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create GRN Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Goods Receipt Note">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link to PO (optional)</label>
            <select value={form.po_id} onChange={e => selectPO(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">No PO (direct receipt)</option>
              {pos.map(p => <option key={p.id} value={p.id}>{p.po_number} — {p.supplier_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
            <select value={form.supplier_id} required onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Received Date *</label>
            <input type="date" value={form.received_date} required
              onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Items Received *</label>
              <button type="button" onClick={addLine}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Line</button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select value={it.item_master_id} onChange={e => updateLine(i, 'item_master_id', e.target.value)}
                    className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">Select item…</option>
                    {items.map(m => <option key={m.id} value={m.id}>{m.item_number} — {m.description_1}</option>)}
                  </select>
                  <input type="number" placeholder="Qty" value={it.qty_received} required
                    onChange={e => updateLine(i, 'qty_received', e.target.value)}
                    className="w-20 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <select value={it.condition} onChange={e => updateLine(i, 'condition', e.target.value)}
                    className="w-24 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="good">Good</option>
                    <option value="damaged">Damaged</option>
                    <option value="quarantine">Quarantine</option>
                  </select>
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)}
                      className="text-red-400 hover:text-red-600 font-bold">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} rows={2} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              Save GRN
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* GRN Detail */}
      <Modal isOpen={!!selectedGRN} onClose={() => setSelectedGRN(null)} title={selectedGRN?.grn_number || ''}>
        {selectedGRN && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Supplier:</span> <strong>{selectedGRN.supplier_name}</strong></div>
              <div><span className="text-gray-500">Date:</span> {new Date(selectedGRN.received_date).toLocaleDateString()}</div>
              <div><span className="text-gray-500">Status:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(selectedGRN.status)}`}>{selectedGRN.status}</span></div>
            </div>
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-gray-50"><tr>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Item</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">Qty</th>
                <th className="px-3 py-2 text-xs text-gray-500">Condition</th>
              </tr></thead>
              <tbody>
                {(selectedGRN.items || []).map(it => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-gray-500">{it.item_number}</span>
                      <span className="ml-2">{it.description_1}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{it.qty_received} {it.uom}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${it.condition === 'good' ? 'bg-green-100 text-green-700' : it.condition === 'damaged' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {it.condition}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
