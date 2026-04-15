import { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

// Flexible column matching for various Excel formats
const COL_KEYS = {
  itemNumber:   ['ITEM NUMBER', 'ITEM_NUMBER', 'ITEMNUMBER', 'ITEM NO', 'ITEM#'],
  description1: ['ITEM DESCRIPTION', 'DESCRIPTION', 'DESCRIPTION 1', 'DESC'],
  description2: ['DESCRIPTION LINE 2', 'DESCRIPTION2', 'DESC 2', 'DESCRIPTION 2'],
  category:     ['CATEGORY', 'CAT'],
  uom:          ['UOM', 'UNIT', 'UNIT OF MEASURE'],
  projectName:  ['PROJECT NAME', 'PROJECT', 'PROJ'],
};

function findCol(headers, keys) {
  for (const key of keys) {
    const found = headers.find(h => h.trim().toUpperCase() === key.toUpperCase());
    if (found) return found;
  }
  return null;
}

export default function ItemLabels() {
  const [items, setItems]       = useState([]);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState(null);
  const [labelMode, setLabelMode] = useState('both'); // 'qr' | 'barcode' | 'both'
  const [fileName, setFileName] = useState('');
  const [barcodeError, setBarcodeError] = useState(false);

  const fileRef    = useRef(null);
  const qrCanvasRef = useRef(null);
  const barcodeRef  = useRef(null);

  // ── Parse uploaded Excel ────────────────────────────────────────
  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb   = XLSX.read(ev.target.result, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) return;

      const headers = Object.keys(rows[0]);
      const cols = Object.fromEntries(
        Object.entries(COL_KEYS).map(([k, keys]) => [k, findCol(headers, keys)])
      );

      const parsed = rows
        .map(row => ({
          item_number:   String(row[cols.itemNumber]   || '').trim(),
          description_1: String(row[cols.description1] || '').trim(),
          description_2: String(row[cols.description2] || '').trim(),
          category:      String(row[cols.category]     || '').trim(),
          uom:           String(row[cols.uom]          || '').trim(),
          project_name:  String(row[cols.projectName]  || '').trim(),
        }))
        .filter(r => r.item_number);

      setItems(parsed);
      setSelected(null);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ── Render QR + barcode when selected item changes ─────────────
  useEffect(() => {
    if (!selected) return;
    const timer = setTimeout(() => {
      // QR
      if (qrCanvasRef.current) {
        QRCode.toCanvas(
          qrCanvasRef.current,
          `ITEM:${selected.item_number}`,
          { width: 180, margin: 1 },
          () => {}
        );
      }
      // Barcode
      if (barcodeRef.current) {
        try {
          JsBarcode(barcodeRef.current, selected.item_number, {
            format: 'CODE128',
            width: 2,
            height: 65,
            displayValue: true,
            fontSize: 12,
            margin: 6,
          });
          setBarcodeError(false);
        } catch {
          setBarcodeError(true);
        }
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [selected]);

  // ── Print label ─────────────────────────────────────────────────
  const handlePrint = () => {
    if (!selected) return;

    const qrImg = qrCanvasRef.current?.toDataURL('image/png') || '';
    const barcodeEl = barcodeRef.current;
    const barcodeImg = (!barcodeError && barcodeEl)
      ? 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(barcodeEl))))
      : '';

    const showQR      = labelMode !== 'barcode';
    const showBarcode = labelMode !== 'qr' && barcodeImg;
    const meta        = [selected.category, selected.uom, selected.project_name].filter(Boolean).join(' · ');

    const w = window.open('', '_blank', 'width=720,height=540');
    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Item — ${selected.item_number}</title>
  <style>
    @page { size: A6 landscape; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', monospace;
      display: flex; align-items: center;
      gap: 16px; height: 100vh; padding: 10px;
    }
    .codes { display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0; }
    img.qr { width: 130px; height: 130px; }
    img.bc { max-width: 180px; }
    .info { flex: 1; }
    .code { font-size: 20px; font-weight: 900; letter-spacing: 0.5px; }
    .desc { font-size: 12px; margin-top: 5px; color: #222; font-family: sans-serif; }
    .desc2 { font-size: 11px; color: #555; margin-top: 2px; font-family: sans-serif; }
    .meta { font-size: 10px; color: #888; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="codes">
    ${showQR      ? `<img class="qr" src="${qrImg}" />` : ''}
    ${showBarcode ? `<img class="bc" src="${barcodeImg}" />` : ''}
  </div>
  <div class="info">
    <div class="code">${selected.item_number}</div>
    <div class="desc">${selected.description_1}</div>
    ${selected.description_2 ? `<div class="desc2">${selected.description_2}</div>` : ''}
    ${meta ? `<div class="meta">${meta}</div>` : ''}
  </div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 800); }<\/script>
</body>
</html>`);
    w.document.close();
  };

  // ── Download laser SVG ─────────────────────────────────────────
  const handleLaserSVG = async () => {
    if (!selected) return;
    const { downloadItemLabelSVG } = await import('../../utils/laserLabel');
    await downloadItemLabelSVG({
      item_number:   selected.item_number,
      description_1: selected.description_1,
      description_2: selected.description_2,
      category:      selected.category,
      uom:           selected.uom,
    }, 'standard');
  };

  // ── Filtered list ──────────────────────────────────────────────
  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    return !q
      || item.item_number.toLowerCase().includes(q)
      || item.description_1.toLowerCase().includes(q)
      || item.category.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Item Labels</h1>
        <p className="text-sm text-gray-500 mt-1">Upload an item master sheet, search items, then print QR or barcode labels.</p>
      </div>

      {/* Upload */}
      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
        <div className="text-4xl mb-3">📂</div>
        <p className="font-medium text-gray-700">
          {fileName || 'Click to upload item master Excel sheet'}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Expects columns: ITEM NUMBER, ITEM DESCRIPTION, CATEGORY, UOM …
        </p>
        {items.length > 0 && (
          <p className="text-sm text-green-600 font-medium mt-2">
            ✓ {items.length} items loaded
          </p>
        )}
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left — search + list */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search by item number, description or category…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="border rounded-xl overflow-hidden">
              <div className="max-h-[520px] overflow-y-auto divide-y">
                {filtered.length === 0 && (
                  <p className="text-center text-gray-400 py-8 text-sm">No items found.</p>
                )}
                {filtered.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => setSelected(item)}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                      selected?.item_number === item.item_number ? 'bg-blue-100 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono font-semibold text-sm text-gray-900">{item.item_number}</span>
                      {item.category && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">{item.category}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 truncate mt-0.5">{item.description_1}</div>
                    {item.description_2 && (
                      <div className="text-xs text-gray-400 truncate">{item.description_2}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right — label preview */}
          <div className="space-y-4">
            {!selected ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl h-64 flex items-center justify-center text-gray-400 text-sm">
                Select an item to preview label
              </div>
            ) : (
              <>
                {/* Item info */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                  <p className="font-mono font-bold text-lg text-gray-900">{selected.item_number}</p>
                  <p className="text-gray-700 text-sm">{selected.description_1}</p>
                  {selected.description_2 && <p className="text-gray-500 text-xs">{selected.description_2}</p>}
                  <p className="text-gray-400 text-xs">
                    {[selected.category, selected.uom, selected.project_name].filter(Boolean).join(' · ')}
                  </p>
                </div>

                {/* Code previews */}
                <div className="flex gap-6 items-start flex-wrap">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">QR Code</span>
                    <canvas ref={qrCanvasRef} className="rounded border" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Barcode</span>
                    {barcodeError
                      ? <p className="text-xs text-red-400 mt-2">Item number contains characters not supported by Code128</p>
                      : <svg ref={barcodeRef} className="rounded border" />
                    }
                  </div>
                </div>

                {/* Label mode */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Include in label</p>
                  <div className="flex gap-2">
                    {[['both', 'QR + Barcode'], ['qr', 'QR only'], ['barcode', 'Barcode only']].map(([val, label]) => (
                      <button key={val} onClick={() => setLabelMode(val)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          labelMode === val
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
                  >
                    🖨 Print Label
                  </button>
                  <button
                    onClick={handleLaserSVG}
                    className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    ⚡ Laser SVG
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
