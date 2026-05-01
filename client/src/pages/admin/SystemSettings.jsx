import { useEffect, useState } from 'react';
import api from '../../utils/axiosInstance';

const BUILT_IN_COLUMNS = [
  ['y3_number',     'Y3 / WBS #'],
  ['item_number',   'Item Number'],
  ['description_1', 'Item Description'],
  ['description_2', 'Description Line 2'],
  ['category',      'Category'],
  ['uom',           'UOM'],
  ['unit_cost',     'Unit Cost'],
  ['qty_on_hand',   'Project Onhand'],
  ['container_no',  'Container No.'],
];

const DEFAULT_HEADERS = {
  y3_number:     'Y3#',
  item_number:   'ITEM NUMBER',
  description_1: 'ITEM DESCRIPTION',
  description_2: 'DESCRIPTION LINE 2',
  category:      'CATEGORY',
  uom:           'UOM',
  unit_cost:     'unit cost',
  qty_on_hand:   'Project Onhand',
  container_no:  'Container No.',
};

function buildDefaultCols() {
  const result = {};
  BUILT_IN_COLUMNS.forEach(([field]) => {
    result[field] = { header: DEFAULT_HEADERS[field] || field, enabled: true, builtin: true };
  });
  return result;
}

// Fields removed from the simplified template — drop them from any legacy saved config
const LEGACY_FIELDS = new Set([
  'project_number', 'project_name', 'qty_requested', 'qty_pending_warehouse',
  'qty_issued', 'issued_by_id', 'received_by_id', 'qty_returned', 'qty_pending_return',
]);

function parseSaved(raw) {
  try {
    const parsed = JSON.parse(raw);
    // Support old string format {"field":"header"} and new object format {"field":{header,enabled}}
    const result = buildDefaultCols();
    Object.entries(parsed).forEach(([field, val]) => {
      if (LEGACY_FIELDS.has(field)) return;
      if (typeof val === 'string') {
        result[field] = { ...(result[field] || {}), header: val, enabled: true };
      } else if (val && typeof val === 'object') {
        result[field] = { header: val.header || '', enabled: val.enabled !== false, label: val.label, builtin: !!result[field] };
      }
    });
    return result;
  } catch (_) {
    return buildDefaultCols();
  }
}

export default function SystemSettings() {
  const [settings, setSettings] = useState({});
  const [columns, setColumns] = useState(buildDefaultCols());
  const [saved, setSaved] = useState(false);
  const [colSaved, setColSaved] = useState(false);
  const [newField, setNewField] = useState({ key: '', label: '', header: '' });
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    api.get('/settings').then(r => {
      const s = r.data;
      if (s.packing_list_columns) {
        setColumns(parseSaved(s.packing_list_columns));
        delete s.packing_list_columns;
      }
      setSettings(s);
    });
  }, []);

  const saveGeneral = async e => {
    e.preventDefault();
    await api.put('/settings', settings);
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const saveColumns = async e => {
    e.preventDefault();
    await api.put('/settings', { packing_list_columns: JSON.stringify(columns) });
    setColSaved(true); setTimeout(() => setColSaved(false), 3000);
  };

  const setCol = (field, patch) =>
    setColumns(c => ({ ...c, [field]: { ...c[field], ...patch } }));

  const removeCol = field =>
    setColumns(c => { const n = { ...c }; delete n[field]; return n; });

  const addCustom = () => {
    const key = newField.key.trim().replace(/\s+/g, '_').toLowerCase();
    if (!key || columns[key]) return;
    setColumns(c => ({
      ...c,
      [key]: { header: newField.header.trim(), label: newField.label.trim(), enabled: true, builtin: false },
    }));
    setNewField({ key: '', label: '', header: '' });
    setShowAdd(false);
  };

  const generalFields = [
    ['daily_report_time', 'Daily Report Time', 'time'],
    ['report_from_email', 'Report From Email', 'email'],
    ['smtp_host',         'SMTP Host',         'text'],
    ['smtp_port',         'SMTP Port',         'number'],
    ['smtp_user',         'SMTP Username',     'text'],
    ['smtp_pass',         'SMTP Password',     'password'],
  ];

  const colEntries = Object.entries(columns);
  const builtinEntries = colEntries.filter(([, v]) => v.builtin);
  const customEntries  = colEntries.filter(([, v]) => !v.builtin);

  return (
    <div className="max-w-2xl space-y-8">
      {/* General Settings */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">System Settings</h2>
        <form onSubmit={saveGeneral} className="bg-white rounded-xl border p-6 space-y-4">
          {generalFields.map(([key, label, type]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type={type}
                value={settings[key] || ''}
                onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          ))}
          {saved && <p className="text-green-600 text-sm">✅ Settings saved!</p>}
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Save Settings
          </button>
        </form>
      </div>

      {/* Packing List Column Mapping */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Packing List Column Mapping</h2>
        <p className="text-sm text-gray-500 mb-4">
          Toggle columns on/off. Edit the Excel header to match your spreadsheet. Hidden columns are skipped during import.
        </p>
        <form onSubmit={saveColumns} className="bg-white rounded-xl border p-6 space-y-3">

          {/* Header row */}
          <div className="grid grid-cols-[32px_1fr_1fr_32px] gap-3 pb-1 border-b text-xs font-semibold text-gray-400 uppercase">
            <div></div>
            <div>Field</div>
            <div>Excel Header</div>
            <div></div>
          </div>

          {/* Built-in columns */}
          {builtinEntries.map(([field, cfg]) => {
            const label = BUILT_IN_COLUMNS.find(([f]) => f === field)?.[1] || field;
            return (
              <div key={field} className={`grid grid-cols-[32px_1fr_1fr_32px] gap-3 items-center ${!cfg.enabled ? 'opacity-40' : ''}`}>
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => setCol(field, { enabled: !cfg.enabled })}
                  className={`w-8 h-5 rounded-full transition-colors flex items-center ${cfg.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${cfg.enabled ? 'translate-x-3' : 'translate-x-0'}`} />
                </button>
                {/* Label */}
                <span className="text-sm text-gray-700 truncate">{label}</span>
                {/* Excel header input */}
                <input
                  type="text"
                  value={cfg.header || ''}
                  disabled={!cfg.enabled}
                  onChange={e => setCol(field, { header: e.target.value })}
                  className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50"
                />
                <div />
              </div>
            );
          })}

          {/* Custom columns */}
          {customEntries.length > 0 && (
            <>
              <div className="pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase">Custom Columns</div>
              {customEntries.map(([field, cfg]) => (
                <div key={field} className={`grid grid-cols-[32px_1fr_1fr_32px] gap-3 items-center ${!cfg.enabled ? 'opacity-40' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setCol(field, { enabled: !cfg.enabled })}
                    className={`w-8 h-5 rounded-full transition-colors flex items-center ${cfg.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${cfg.enabled ? 'translate-x-3' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm text-gray-700 truncate">{cfg.label || field}</span>
                  <input
                    type="text"
                    value={cfg.header || ''}
                    disabled={!cfg.enabled}
                    onChange={e => setCol(field, { header: e.target.value })}
                    className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50"
                  />
                  <button type="button" onClick={() => removeCol(field)}
                    className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                </div>
              ))}
            </>
          )}

          {/* Add custom column */}
          {showAdd ? (
            <div className="border rounded-lg p-4 bg-gray-50 space-y-3 mt-2">
              <p className="text-sm font-medium text-gray-700">Add Custom Column</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Field Key</label>
                  <input type="text" placeholder="e.g. custom_field"
                    value={newField.key}
                    onChange={e => setNewField(f => ({ ...f, key: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Display Label</label>
                  <input type="text" placeholder="e.g. My Field"
                    value={newField.label}
                    onChange={e => setNewField(f => ({ ...f, label: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Excel Header</label>
                  <input type="text" placeholder="e.g. MY COLUMN"
                    value={newField.header}
                    onChange={e => setNewField(f => ({ ...f, header: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={addCustom}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700">
                  Add
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="text-gray-500 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-100">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowAdd(true)}
              className="text-blue-600 text-sm hover:underline mt-1">
              + Add custom column
            </button>
          )}

          <div className="pt-2 flex items-center gap-4">
            {colSaved && <p className="text-green-600 text-sm">✅ Column mapping saved!</p>}
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              Save Column Mapping
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
