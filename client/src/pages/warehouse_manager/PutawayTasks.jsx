import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';
import Modal from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';

export default function PutawayTasks() {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [zones, setZones] = useState([]);
  const [racks, setRacks] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [bins, setBins] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedRack, setSelectedRack] = useState('');
  const [selectedShelf, setSelectedShelf] = useState('');
  const [selectedBin, setSelectedBin] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/wms/putaway').then(r => setTasks(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get('/wms/locations/zones').then(r => setZones(r.data));
  }, []);

  const onZoneChange = async z => {
    setSelectedZone(z); setSelectedRack(''); setSelectedShelf(''); setSelectedBin('');
    setRacks([]); setShelves([]); setBins([]);
    if (z) { const r = await api.get(`/wms/locations/racks?zone_id=${z}`); setRacks(r.data); }
  };
  const onRackChange = async r => {
    setSelectedRack(r); setSelectedShelf(''); setSelectedBin('');
    setShelves([]); setBins([]);
    if (r) { const s = await api.get(`/wms/locations/shelves?rack_id=${r}`); setShelves(s.data); }
  };
  const onShelfChange = async s => {
    setSelectedShelf(s); setSelectedBin('');
    setBins([]);
    if (s) { const b = await api.get(`/wms/locations/bins?shelf_id=${s}`); setBins(b.data); }
  };

  const openTask = task => {
    setSelectedTask(task);
    setSelectedZone(''); setSelectedRack(''); setSelectedShelf(''); setSelectedBin('');
    setRacks([]); setShelves([]); setBins([]);
    setError('');
  };

  const complete = async () => {
    if (!selectedBin) { setError('Please select a bin'); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/wms/putaway/${selectedTask.id}/complete`, { bin_id: selectedBin });
      toast('Putaway completed', 'success');
      setSelectedTask(null);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Error completing putaway'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Putaway Tasks</h2>
        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
          {tasks.length} pending
        </span>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-12">Loading…</p>
      ) : tasks.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-500">No pending putaway tasks</p>
          <p className="text-gray-400 text-sm mt-1">Confirm a GRN to generate putaway tasks</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {tasks.map(t => (
            <div key={t.id} className="bg-white border rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-sm font-semibold text-blue-700">{t.item_number}</span>
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                    {t.grn_number}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{t.description_1}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Qty to putaway: <strong>{t.qty_to_putaway} {t.uom}</strong>
                  {t.bin_full_code && <span className="ml-2">→ Suggested: <strong>{t.bin_full_code}</strong></span>}
                </p>
              </div>
              <button onClick={() => openTask(t)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap">
                Putaway →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Putaway Modal */}
      <Modal isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} title="Complete Putaway">
        {selectedTask && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p className="font-semibold text-blue-800">{selectedTask.item_number} — {selectedTask.description_1}</p>
              <p className="text-blue-600">Quantity: <strong>{selectedTask.qty_to_putaway} {selectedTask.uom}</strong></p>
            </div>

            <p className="text-sm font-medium text-gray-700">Select destination bin:</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Zone</label>
                <select value={selectedZone} onChange={e => onZoneChange(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select zone…</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.code} — {z.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rack</label>
                <select value={selectedRack} onChange={e => onRackChange(e.target.value)}
                  disabled={!selectedZone}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
                  <option value="">Select rack…</option>
                  {racks.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Shelf</label>
                <select value={selectedShelf} onChange={e => onShelfChange(e.target.value)}
                  disabled={!selectedRack}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
                  <option value="">Select shelf…</option>
                  {shelves.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bin *</label>
                <select value={selectedBin} onChange={e => setSelectedBin(e.target.value)}
                  disabled={!selectedShelf}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
                  <option value="">Select bin…</option>
                  {bins.map(b => <option key={b.id} value={b.id}>{b.full_code}</option>)}
                </select>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button onClick={complete} disabled={saving || !selectedBin}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Complete Putaway'}
              </button>
              <button onClick={() => setSelectedTask(null)}
                className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
