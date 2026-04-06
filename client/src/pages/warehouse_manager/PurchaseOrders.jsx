import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { statusClass, STATUS_COLORS } from '../../utils/statusColors';

export default function PurchaseOrders() {
  const toast = useToast();
  const [pos, setPOs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', expected_date: '', notes: '', items: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = () => {
    setLoading(true);
    const q = filterStatus ? `?status=${filterStatus}` : '';
    api.get(`/wms/receiving/po${q}`).then(r => setPOs(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get('/wms/suppliers?active=true').then(r => setSuppliers(r.data));
    api.get('/wms/items').then(r => setItems(r.data));
  }, []);

  const openCreate = () => {
    setForm({ supplier_id: '', expected_date: '', notes: '', items: [{ item_master_id: '', qty_ordered: '', unit_cost: '' }] });
    setError('');
    setShowCreate(true);
  };

  const addLine = () => setForm(f => ({ ...f, items: [...f.items, { item_master_id: '', qty_ordered: '', unit_cost: '' }] }));
  const removeLine = i => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateLine = (i, key, val) => setForm(f => {
    const its = [...f.items]; its[i] = { ...its[i], [key]: val }; return { ...f, items: its };
  });

  const submit = async e => {
    e.preventDefault(); setError('');
    try {
      await api.post('/wms/receiving/po', {
        ...form,
        items: form.items.filter(it => it.item_master_id && it.qty_ordered).map(it => ({
          ...it, qty_ordered: parseFloat(it.qty_ordered), unit_cost: it.unit_cost ? parseFloat(it.unit_cost) : null
        }))
      });
      setShowCreate(false);
      toast('Purchase order created', 'success');
      load();
    } catch (err) { setError(err.response?.data?.error || 'Error creating PO'); }
  };

  const updateStatus = async (id, status) => {
    await api.patch(`/wms/receiving/po/${id}/status`, { status });
    load();
    if (selectedPO?.id === id) {
      const { data } = await api.get(`/wms/receiving/po/${id}`);
      setSelectedPO(data);
    }
  };

  const viewPO = async (id) => {
    const { data } = await api.get(`/wms/receiving/po/${id}`);
    setSelectedPO(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Purchase Orders</h2>
        <button onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + New PO
        </button>
      </div>

      <div className="bg-white border rounded-xl p-4 mb-4 flex flex-wrap gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search PO number or supplier…"
          className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-gray-400">Loading…</p>
        ) : pos.length === 0 ? (
          <EmptyState icon="list" title="No purchase orders yet" message="Create a PO to start ordering stock from suppliers." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['PO Number','Supplier','Expected','Items','Status',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {pos.filter(po => !search || po.po_number.toLowerCase().includes(search.toLowerCase()) || po.supplier_name.toLowerCase().includes(search.toLowerCase())).map(po => (
                <tr key={po.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold text-blue-700">{po.po_number}</td>
                  <td className="px-4 py-3">{po.supplier_name}</td>
                  <td className="px-4 py-3 text-gray-500">{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{po.item_count}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass(po.status)}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => viewPO(po.id)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3">View</button>
                    {po.status === 'draft' && (
                      <button onClick={() => updateStatus(po.id, 'sent')}
                        className="text-green-600 hover:text-green-800 text-xs font-medium mr-3">Mark Sent</button>
                    )}
                    {po.status === 'draft' && (
                      <button onClick={() => updateStatus(po.id, 'cancelled')}
                        className="text-red-500 hover:text-red-700 text-xs font-medium">Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create PO Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Purchase Order">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
            <select value={form.supplier_id} required onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Date</label>
            <input type="date" value={form.expected_date}
              onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Line Items *</label>
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
                  <input type="number" placeholder="Qty" value={it.qty_ordered}
                    onChange={e => updateLine(i, 'qty_ordered', e.target.value)}
                    className="w-20 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <input type="number" placeholder="Cost" value={it.unit_cost}
                    onChange={e => updateLine(i, 'unit_cost', e.target.value)}
                    className="w-20 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {form.items.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)}
                      className="text-red-400 hover:text-red-600 text-sm font-bold">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} rows={2}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              Create PO
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* PO Detail Modal */}
      <Modal isOpen={!!selectedPO} onClose={() => setSelectedPO(null)}
        title={selectedPO?.po_number || 'PO Details'}>
        {selectedPO && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Supplier:</span> <span className="font-medium">{selectedPO.supplier_name}</span></div>
              <div><span className="text-gray-500">Status:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(selectedPO.status)}`}>{selectedPO.status}</span></div>
              <div><span className="text-gray-500">Expected:</span> <span>{selectedPO.expected_date ? new Date(selectedPO.expected_date).toLocaleDateString() : '—'}</span></div>
            </div>
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-gray-50"><tr>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Item</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">Ordered</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">Received</th>
              </tr></thead>
              <tbody>
                {(selectedPO.items || []).map(it => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-gray-500">{it.item_number}</span>
                      <span className="ml-2">{it.description_1}</span>
                    </td>
                    <td className="px-3 py-2 text-right">{it.qty_ordered} {it.uom}</td>
                    <td className="px-3 py-2 text-right text-green-600">{it.qty_received} {it.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedPO.notes && <p className="text-sm text-gray-500 italic">{selectedPO.notes}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
