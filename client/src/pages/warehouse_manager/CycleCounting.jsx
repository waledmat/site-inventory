import { useEffect, useState, useCallback } from 'react';
import api from '../../utils/axiosInstance';
import Modal from '../../components/common/Modal';
import QRScanner from '../../components/common/QRScanner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { statusClass } from '../../utils/statusColors';

export default function CycleCounting() {
  const toast = useToast();
  const [counts, setCounts]       = useState([]);
  const [zones, setZones]         = useState([]);
  const [detail, setDetail]       = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]           = useState({ zone_id: '', notes: '' });
  const [filterStatus, setFilterStatus] = useState('');
  const [countingItem, setCountingItem] = useState(null);
  const [countedQty, setCountedQty]   = useState('');
  const [countNotes, setCountNotes]   = useState('');
  const [applyAdj, setApplyAdj]       = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [scanOpen, setScanOpen]   = useState(false);
  const [scanMsg, setScanMsg]     = useState('');
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmCancel, setConfirmCancel]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const q = filterStatus ? `?status=${filterStatus}` : '';
    api.get(`/wms/cyclecount${q}`).then(r => setCounts(r.data)).finally(() => setLoading(false));
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/wms/locations/zones').then(r => setZones(r.data)); }, []);

  const openCreate = () => { setForm({ zone_id: '', notes: '' }); setError(''); setShowCreate(true); };

  const submit = async e => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await api.post('/wms/cyclecount', {
        zone_id: form.zone_id || null,
        notes:   form.notes   || null,
      });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating cycle count');
    } finally { setSaving(false); }
  };

  const openDetail = id => {
    api.get(`/wms/cyclecount/${id}`).then(r => setDetail(r.data));
  };

  const refreshDetail = () => {
    if (detail) api.get(`/wms/cyclecount/${detail.id}`).then(r => setDetail(r.data));
  };

  const openCountItem = item => {
    setCountingItem(item);
    setCountedQty(item.counted_qty != null ? String(item.counted_qty) : '');
    setCountNotes(item.notes || '');
  };

  const submitCount = async () => {
    if (countedQty === '') return;
    try {
      await api.put(`/wms/cyclecount/${detail.id}/items/${countingItem.id}/count`, {
        counted_qty: parseFloat(countedQty),
        notes: countNotes || null,
      });
      setCountingItem(null);
      refreshDetail();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to record count', 'error');
    }
  };

  const complete = () => setConfirmComplete(true);

  const doComplete = async () => {
    setConfirmComplete(false);
    try {
      await api.post(`/wms/cyclecount/${detail.id}/complete`, { apply_adjustments: applyAdj });
      toast(applyAdj ? 'Cycle count completed with adjustments applied' : 'Cycle count completed', 'success');
      setDetail(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete count');
    }
  };

  const cancel = id => setConfirmCancel(id);

  const doCancel = async () => {
    const id = confirmCancel;
    setConfirmCancel(null);
    try {
      await api.post(`/wms/cyclecount/${id}/cancel`);
      toast('Cycle count cancelled', 'warning');
      setDetail(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel');
    }
  };

  const handleScanBin = (text) => {
    if (!text.startsWith('BIN:') || !detail) return;
    const binCode = text.replace('BIN:', '');
    const binItems = (detail.items || []).filter(i => i.bin_code === binCode);
    if (binItems.length === 0) {
      setScanMsg(`No items found in bin ${binCode} for this count.`);
      return;
    }
    const uncounted = binItems.find(i => i.counted_qty == null);
    if (uncounted) {
      openCountItem(uncounted);
      setScanMsg('');
    } else {
      setScanMsg(`All ${binItems.length} item(s) in ${binCode} already counted.`);
    }
  };

  const downloadPDF = id => {
    const token = localStorage.getItem('token');
    window.open(`/api/wms/cyclecount/${id}/pdf?token=${token}`, '_blank');
  };

  const uncountedCount = detail ? detail.items?.filter(i => i.counted_qty == null).length : 0;
  const varianceCount  = detail ? detail.items?.filter(i => i.counted_qty != null && i.variance !== 0 && i.variance != null).length : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Cycle Counting</h2>
        <button onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Count
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white border rounded-xl p-4 flex gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          {['open', 'counting', 'completed', 'cancelled'].map(s =>
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
        ) : counts.length === 0 ? (
          <EmptyState icon="check" title="No cycle counts found" message="Start a cycle count to verify stock levels in a zone." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Count No.', 'Zone', 'Progress', 'Status', 'Created', 'Completed', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {counts.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-blue-700">{c.count_number}</td>
                  <td className="px-4 py-3 text-gray-700">{c.zone_name || 'All Zones'}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <span className="text-xs">{c.counted_items} / {c.total_items} counted</span>
                    {c.total_items > 0 && (
                      <div className="mt-1 h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.round(c.counted_items / c.total_items * 100)}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusClass(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{String(c.created_at).slice(0, 10)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.completed_at ? String(c.completed_at).slice(0, 10) : '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openDetail(c.id)}
                      className="text-xs text-blue-600 hover:underline mr-2">View</button>
                    <button onClick={() => downloadPDF(c.id)}
                      className="text-xs text-purple-600 hover:underline">PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Cycle Count">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zone (optional)</label>
            <select value={form.zone_id} onChange={e => setForm(f => ({ ...f, zone_id: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Count all zones</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name} ({z.code})</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Leave blank to count all bin stock.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
              placeholder="Optional notes…" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Count'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)}
        title={detail ? `${detail.count_number} — ${detail.status.toUpperCase()}` : ''}>
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Zone:</span> <span className="font-medium">{detail.zone_name || 'All Zones'}</span></div>
              <div><span className="text-gray-500">Created by:</span> <span className="font-medium">{detail.created_by_name}</span></div>
              {detail.completed_by_name && (
                <div><span className="text-gray-500">Completed by:</span> <span className="font-medium">{detail.completed_by_name}</span></div>
              )}
            </div>

            {/* Summary badges */}
            <div className="flex gap-3">
              <span className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-1 rounded-full">
                {uncountedCount} uncounted
              </span>
              {varianceCount > 0 && (
                <span className="text-xs bg-red-50 border border-red-200 text-red-700 px-2 py-1 rounded-full">
                  {varianceCount} variances
                </span>
              )}
            </div>

            {/* Items table */}
            <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['Bin', 'Item No.', 'Description', 'System', 'Counted', 'Variance', ''].map(h => (
                      <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(detail.items || []).map(item => (
                    <tr key={item.id} className={item.variance && item.variance !== 0 ? 'bg-red-50' : ''}>
                      <td className="px-2 py-1.5 font-mono text-purple-700">{item.bin_code}</td>
                      <td className="px-2 py-1.5 font-mono">{item.item_number}</td>
                      <td className="px-2 py-1.5 max-w-24 truncate">{item.description_1}</td>
                      <td className="px-2 py-1.5">{item.expected_qty}</td>
                      <td className="px-2 py-1.5 font-medium">
                        {item.counted_qty != null ? item.counted_qty : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5 font-medium">
                        {item.variance != null && item.variance !== 0 ? (
                          <span className={item.variance > 0 ? 'text-green-600' : 'text-red-600'}>
                            {item.variance > 0 ? '+' : ''}{item.variance}
                          </span>
                        ) : item.counted_qty != null ? '—' : ''}
                      </td>
                      <td className="px-2 py-1.5">
                        {['open', 'counting'].includes(detail.status) && (
                          <button onClick={() => openCountItem(item)}
                            className="text-blue-600 hover:underline">
                            {item.counted_qty != null ? 'Edit' : 'Count'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            {['open', 'counting'].includes(detail.status) && (
              <div className="bg-gray-50 border rounded-lg p-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={applyAdj} onChange={e => setApplyAdj(e.target.checked)}
                    className="rounded" />
                  Apply stock adjustments on completion
                </label>
                <p className="text-xs text-gray-400 mt-1">
                  If checked, bin stock will be updated to match counted quantities where variances exist.
                </p>
              </div>
            )}
            {scanMsg && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-700">
                {scanMsg}
                <button onClick={() => setScanMsg('')} className="ml-2 text-yellow-500 hover:text-yellow-700 font-bold">×</button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {['open', 'counting'].includes(detail.status) && (
                <button onClick={complete}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                  Complete Count
                </button>
              )}
              {['open', 'counting'].includes(detail.status) && (
                <button onClick={() => { setScanMsg(''); setScanOpen(true); }}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5A2.5 2.5 0 0116.5 18h-9A2.5 2.5 0 015 15.5v-9A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5" />
                  </svg>
                  Scan Bin
                </button>
              )}
              <button onClick={() => downloadPDF(detail.id)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                Download PDF
              </button>
              {['open', 'counting'].includes(detail.status) && (
                <button onClick={() => cancel(detail.id)}
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

      {/* QR Scanner for bin-to-count */}
      <QRScanner isOpen={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScanBin} />

      {/* Record Count Modal */}
      <Modal isOpen={!!countingItem} onClose={() => setCountingItem(null)}
        title={countingItem ? `Record Count — ${countingItem.item_number}` : ''}>
        {countingItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p><span className="text-gray-500">Bin:</span> <span className="font-mono font-medium">{countingItem.bin_code}</span></p>
              <p><span className="text-gray-500">Description:</span> {countingItem.description_1}</p>
              <p><span className="text-gray-500">System Qty:</span> <span className="font-medium">{countingItem.expected_qty} {countingItem.uom}</span></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actual Counted Quantity</label>
              <input type="number" min="0" step="any" value={countedQty} autoFocus
                onChange={e => setCountedQty(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter counted quantity…" />
              {countedQty !== '' && countingItem.expected_qty != null && (
                <p className={`text-xs mt-1 font-medium ${parseFloat(countedQty) - countingItem.expected_qty !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                  Variance: {parseFloat(countedQty) - countingItem.expected_qty > 0 ? '+' : ''}{(parseFloat(countedQty) - countingItem.expected_qty).toFixed(3)}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea value={countNotes} onChange={e => setCountNotes(e.target.value)}
                rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="Reason for variance, condition notes…" />
            </div>
            <div className="flex gap-3">
              <button onClick={submitCount} disabled={countedQty === ''}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                Save Count
              </button>
              <button onClick={() => setCountingItem(null)}
                className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmComplete}
        title="Complete Cycle Count"
        message={applyAdj ? 'Complete and apply stock adjustments for all variances?' : 'Complete without applying adjustments?'}
        confirmLabel="Complete"
        onConfirm={doComplete}
        onCancel={() => setConfirmComplete(false)}
      />

      <ConfirmDialog
        isOpen={!!confirmCancel}
        title="Cancel Cycle Count"
        message="Cancel this cycle count? This cannot be undone."
        confirmLabel="Cancel Count"
        danger
        onConfirm={doCancel}
        onCancel={() => setConfirmCancel(null)}
      />
    </div>
  );
}
