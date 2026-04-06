import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';

const empty = { code: '', name: '', contact_name: '', contact_email: '', contact_phone: '', address: '', lead_time_days: 0, notes: '' };

export default function SupplierManagement() {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  const load = () => api.get('/wms/suppliers').then(r => setSuppliers(r.data));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setModal(true); setError(''); };
  const openEdit = s => { setEditing(s.id); setForm(s); setModal(true); setError(''); };

  const save = async e => {
    e.preventDefault(); setError('');
    try {
      if (editing) await api.put(`/wms/suppliers/${editing}`, form);
      else await api.post('/wms/suppliers', form);
      setModal(false);
      toast(editing ? 'Supplier updated' : 'Supplier created', 'success');
      load();
    } catch (err) { setError(err.response?.data?.error || 'Error saving supplier'); }
  };

  const deactivate = async () => {
    try {
      await api.delete(`/wms/suppliers/${confirmId}`);
      toast('Supplier deactivated', 'warning');
      load();
    } catch (err) { toast(err.response?.data?.error || 'Failed to deactivate', 'error'); }
    finally { setConfirmId(null); }
  };

  const displayed = suppliers.filter(s =>
    !filter ||
    s.name?.toLowerCase().includes(filter.toLowerCase()) ||
    s.code?.toLowerCase().includes(filter.toLowerCase())
  );

  const cols = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Supplier Name' },
    { key: 'contact_name', header: 'Contact' },
    { key: 'contact_email', header: 'Email' },
    { key: 'contact_phone', header: 'Phone' },
    { key: 'lead_time_days', header: 'Lead Time (days)' },
    { key: 'is_active', header: 'Status', render: v => <Badge value={v ? 'active' : 'inactive'} label={v ? 'Active' : 'Inactive'} /> },
    {
      key: 'id', header: 'Actions',
      render: (id, row) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(row)} className="text-xs text-blue-600 hover:underline">Edit</button>
          {row.is_active && <button onClick={() => setConfirmId(id)} className="text-xs text-red-500 hover:underline">Deactivate</button>}
        </div>
      )
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Suppliers</h2>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Add Supplier</button>
      </div>

      <div className="bg-white border rounded-xl p-4 mb-5">
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search by name or code…"
          className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      <Table columns={cols} data={displayed} />

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={save} className="space-y-3">
          {[
            { key: 'code', label: 'Supplier Code', required: true },
            { key: 'name', label: 'Supplier Name', required: true },
            { key: 'contact_name', label: 'Contact Name' },
            { key: 'contact_email', label: 'Contact Email' },
            { key: 'contact_phone', label: 'Contact Phone' },
            { key: 'lead_time_days', label: 'Lead Time (days)', type: 'number' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input
                type={f.type || 'text'}
                value={form[f.key] ?? ''}
                required={f.required}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Save</button>
            <button type="button" onClick={() => setModal(false)} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmId}
        title="Deactivate Supplier"
        message="This supplier will be marked inactive and hidden from new orders."
        confirmLabel="Deactivate"
        danger
        onConfirm={deactivate}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
