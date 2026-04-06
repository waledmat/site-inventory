import { useEffect, useRef, useState } from 'react';
import api from '../../utils/axiosInstance';
import Modal from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import QRCodeDisplay from '../../components/common/QRCodeDisplay';
import QRScanner from '../../components/common/QRScanner';
import LabelPrintActions from '../../components/common/LabelPrintActions';
import { useAuth } from '../../context/AuthContext';

export default function LocationManagement() {
  const toast = useToast();
  const { token } = useAuth();
  const [zones, setZones] = useState([]);
  const [racks, setRacks] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [bins, setBins] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedRack, setSelectedRack] = useState(null);
  const [selectedShelf, setSelectedShelf] = useState(null);
  const [labelBin, setLabelBin] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  const qrRef = useRef(null);

  const loadZones = () => api.get('/wms/locations/zones').then(r => setZones(r.data));
  const loadRacks = zoneId => api.get(`/wms/locations/racks?zone_id=${zoneId}`).then(r => setRacks(r.data));
  const loadShelves = rackId => api.get(`/wms/locations/shelves?rack_id=${rackId}`).then(r => setShelves(r.data));
  const loadBins = shelfId => api.get(`/wms/locations/bins?shelf_id=${shelfId}`).then(r => setBins(r.data));

  useEffect(() => { loadZones(); }, []);

  const selectZone = z => {
    setSelectedZone(z); setSelectedRack(null); setSelectedShelf(null);
    setRacks([]); setShelves([]); setBins([]);
    loadRacks(z.id);
  };

  const selectRack = r => {
    setSelectedRack(r); setSelectedShelf(null);
    setShelves([]); setBins([]);
    loadShelves(r.id);
  };

  const selectShelf = s => {
    setSelectedShelf(s); setBins([]);
    loadBins(s.id);
  };

  const openModal = type => { setModal(type); setForm({}); setError(''); };
  const closeModal = () => { setModal(null); setForm({}); setError(''); };

  const save = async e => {
    e.preventDefault(); setError('');
    try {
      if (modal === 'zone') {
        await api.post('/wms/locations/zones', form);
        loadZones();
        toast('Zone created', 'success');
      } else if (modal === 'rack') {
        await api.post('/wms/locations/racks', { ...form, zone_id: selectedZone.id });
        loadRacks(selectedZone.id);
        toast('Rack created', 'success');
      } else if (modal === 'shelf') {
        await api.post('/wms/locations/shelves', { ...form, rack_id: selectedRack.id });
        loadShelves(selectedRack.id);
        toast('Shelf created', 'success');
      } else if (modal === 'bin') {
        await api.post('/wms/locations/bins', { ...form, shelf_id: selectedShelf.id });
        loadBins(selectedShelf.id);
        toast('Bin created', 'success');
      }
      closeModal();
    } catch (err) { setError(err.response?.data?.error || 'Error saving'); }
  };

  const handleScan = (text) => {
    if (text.startsWith('BIN:')) {
      const code = text.replace('BIN:', '');
      setScanResult({ type: 'bin', code });
    } else {
      setScanResult({ type: 'unknown', code: text });
    }
  };

  const ItemList = ({ title, items, selected, onSelect, onAdd, addLabel, nameKey = 'code' }) => (
    <div className="bg-white border rounded-xl flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-gray-700">{title}</h3>
        <button onClick={onAdd}
          className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700">
          + Add
        </button>
      </div>
      <div className="flex-1 overflow-y-auto max-h-64">
        {items.length === 0
          ? <p className="text-sm text-gray-400 p-4">No items yet</p>
          : items.map(item => (
            <button key={item.id} onClick={() => onSelect?.(item)}
              className={`w-full text-left px-4 py-2 text-sm border-b last:border-0 hover:bg-blue-50 transition-colors ${selected?.id === item.id ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700'}`}>
              <span className="font-mono">{item[nameKey]}</span>
              {item.name && item.name !== item[nameKey] && <span className="text-gray-400 ml-2">{item.name}</span>}
            </button>
          ))
        }
      </div>
    </div>
  );

  const modalFields = {
    zone:  [{ key: 'code', label: 'Zone Code (e.g. ZA)', required: true }, { key: 'name', label: 'Zone Name', required: true }, { key: 'description', label: 'Description' }],
    rack:  [{ key: 'code', label: 'Rack Code (e.g. R01)', required: true }, { key: 'name', label: 'Rack Name' }],
    shelf: [{ key: 'code', label: 'Shelf Code (e.g. S01)', required: true }, { key: 'name', label: 'Shelf Name' }],
    bin:   [{ key: 'code', label: 'Bin Code (e.g. B001)', required: true }, { key: 'max_qty', label: 'Max Qty', type: 'number' }],
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Warehouse Locations</h2>
        <button onClick={() => setScanOpen(true)}
          className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5A2.5 2.5 0 0116.5 18h-9A2.5 2.5 0 015 15.5v-9A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5" />
          </svg>
          Scan Bin
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ItemList title="Zones" items={zones} selected={selectedZone}
          onSelect={selectZone} onAdd={() => openModal('zone')} nameKey="code" />

        <ItemList title={`Racks${selectedZone ? ` — ${selectedZone.code}` : ''}`}
          items={racks} selected={selectedRack}
          onSelect={selectRack}
          onAdd={() => selectedZone ? openModal('rack') : toast('Select a zone first', 'warning')}
          nameKey="code" />

        <ItemList title={`Shelves${selectedRack ? ` — ${selectedRack.code}` : ''}`}
          items={shelves} selected={selectedShelf}
          onSelect={selectShelf}
          onAdd={() => selectedRack ? openModal('shelf') : toast('Select a rack first', 'warning')}
          nameKey="code" />

        <div className="bg-white border rounded-xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-gray-700">Bins{selectedShelf ? ` — ${selectedShelf.code}` : ''}</h3>
            <button onClick={() => selectedShelf ? openModal('bin') : toast('Select a shelf first', 'warning')}
              className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700">+ Add</button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-64">
            {bins.length === 0
              ? <p className="text-sm text-gray-400 p-4">No bins yet</p>
              : bins.map(bin => (
                <div key={bin.id} className="flex items-center justify-between px-4 py-2 border-b last:border-0 hover:bg-gray-50">
                  <span className="font-mono text-sm text-gray-700">{bin.full_code}</span>
                  <button onClick={() => setLabelBin(bin)}
                    className="text-xs text-purple-600 hover:text-purple-800 border border-purple-200 rounded px-2 py-0.5 hover:bg-purple-50">
                    QR Label
                  </button>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Add modals */}
      <Modal isOpen={!!modal} onClose={closeModal} title={`Add ${modal?.charAt(0).toUpperCase()}${modal?.slice(1)}`}>
        <form onSubmit={save} className="space-y-3">
          {(modalFields[modal] || []).map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input type={f.type || 'text'} value={form[f.key] || ''} required={f.required}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Save</button>
            <button type="button" onClick={closeModal} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Bin QR Label Modal */}
      <Modal isOpen={!!labelBin} onClose={() => setLabelBin(null)} title={`Bin Label — ${labelBin?.full_code}`}>
        {labelBin && (
          <div className="flex flex-col items-center gap-4">
            <QRCodeDisplay ref={qrRef} value={`BIN:${labelBin.full_code}`} size={200} />
            <p className="text-2xl font-mono font-bold text-gray-800">{labelBin.full_code}</p>
            <p className="text-sm text-gray-500">Scan to identify bin location</p>
            <LabelPrintActions
              type="bin"
              data={labelBin}
              qrRef={qrRef}
              pdfUrl={`/api/wms/locations/bins/${labelBin.id}/label?token=${token}`}
            />
          </div>
        )}
      </Modal>

      {/* QR Scanner */}
      <QRScanner isOpen={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />

      {/* Scan Result */}
      <Modal isOpen={!!scanResult} onClose={() => setScanResult(null)} title="Scan Result">
        {scanResult && (
          <div className="space-y-4">
            {scanResult.type === 'bin' ? (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                <p className="text-xs text-purple-500 mb-1 font-medium uppercase tracking-wide">Bin Location</p>
                <p className="text-2xl font-mono font-bold text-purple-800">{scanResult.code}</p>
              </div>
            ) : (
              <div className="bg-gray-50 border rounded-lg p-4">
                <p className="text-sm text-gray-500">Scanned:</p>
                <p className="font-mono text-gray-800 mt-1 break-all">{scanResult.code}</p>
              </div>
            )}
            <button onClick={() => setScanResult(null)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              Done
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
