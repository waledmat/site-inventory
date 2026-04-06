import { useState } from 'react';
import { printBinLabel, printItemLabel } from '../../utils/printLabel';
import { buildBinZPL, buildItemZPL, getZebraPrinters, printZPL, downloadZPL } from '../../utils/zebraLabel';
import { downloadBinLabelSVG, downloadItemLabelSVG } from '../../utils/laserLabel';

const SIZES = [['a6', 'A6'], ['4x6', '4×6"'], ['62mm', '62mm']];
// Map UI size keys to printLabel/zebraLabel/laserLabel size keys
const SIZE_MAP = { a6: 'a6', '4x6': 'standard', '62mm': 'small' };

/**
 * Reusable label print actions panel for bin and item labels.
 *
 * Props:
 *   type    : 'bin' | 'item'
 *   data    : bin object { full_code, zone_name?, id } or item object
 *   qrRef   : ref to <QRCodeDisplay> (exposes getDataURL())
 *   pdfUrl  : full URL string for PDF download (including auth token)
 */
export default function LabelPrintActions({ type, data, qrRef, pdfUrl }) {
  const [size, setSize] = useState('a6');
  // zebraState: null | 'detecting' | 'printing' | 'done' | 'error' | 'no-app'
  const [zebraState, setZebraState] = useState(null);
  const [zplCode, setZplCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [laserBusy, setLaserBusy] = useState(false);

  const lSize = SIZE_MAP[size];

  // ── Browser print ──────────────────────────────────────────────
  const handleBrowserPrint = () => {
    const img = qrRef.current?.getDataURL();
    if (type === 'bin') printBinLabel(img, data, size);
    else printItemLabel(img, data, size);
  };

  // ── Zebra printer ──────────────────────────────────────────────
  const handleZebra = async () => {
    const zpl = type === 'bin' ? buildBinZPL(data, lSize) : buildItemZPL(data, lSize);
    setZplCode(zpl);
    setZebraState('detecting');

    const printers = await getZebraPrinters();

    if (!printers || printers.length === 0) {
      setZebraState('no-app');
      return;
    }

    setZebraState('printing');
    try {
      await printZPL(zpl, printers[0]);
      setZebraState('done');
    } catch {
      setZebraState('error');
    }
  };

  const handleCopyZPL = () => {
    navigator.clipboard.writeText(zplCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZPL = () => {
    const name = type === 'bin'
      ? `BIN-${data.full_code}.zpl`
      : `ITEM-${data.item_number}.zpl`;
    downloadZPL(zplCode, name);
  };

  // ── Laser / EzCad SVG ─────────────────────────────────────────
  const handleLaser = async () => {
    setLaserBusy(true);
    try {
      if (type === 'bin') await downloadBinLabelSVG(data, lSize);
      else await downloadItemLabelSVG(data, lSize);
    } finally {
      setLaserBusy(false);
    }
  };

  return (
    <div className="w-full space-y-3">

      {/* Size selector */}
      <div className="flex gap-1">
        {SIZES.map(([val, label]) => (
          <button key={val} onClick={() => setSize(val)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors
              ${size === val
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Row 1: browser print + PDF download */}
      <div className="flex gap-2">
        <button onClick={handleBrowserPrint}
          className="flex-1 bg-gray-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-900">
          Print Label
        </button>
        <a href={pdfUrl} target="_blank" rel="noreferrer"
          className="flex-1 text-center bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700">
          Download PDF
        </a>
      </div>

      {/* Row 2: Zebra + Laser */}
      <div className="flex gap-2">
        <button onClick={handleZebra} disabled={zebraState === 'detecting' || zebraState === 'printing'}
          className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-60">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17H17.01M7 17H7.01M5 9V7a2 2 0 012-2h10a2 2 0 012 2v2M3 9h18v8a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          </svg>
          {zebraState === 'detecting' ? 'Detecting…' : zebraState === 'printing' ? 'Printing…' : 'Zebra Printer'}
        </button>

        <button onClick={handleLaser} disabled={laserBusy}
          className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {laserBusy ? 'Generating…' : 'Laser SVG'}
        </button>
      </div>

      {/* Zebra status banners */}
      {zebraState === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 flex items-center gap-2">
          <span>✓</span> Sent to Zebra printer successfully.
        </div>
      )}

      {zebraState === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          Print failed. Use the ZPL options below to print manually.
        </div>
      )}

      {/* No Browser Print — show ZPL fallback */}
      {(zebraState === 'no-app' || zebraState === 'error') && zplCode && (
        <div className="bg-gray-50 border rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-500 font-medium">
            Zebra Browser Print not detected. Install it from Zebra's official site, or use the ZPL code below:
          </p>
          <pre className="text-xs font-mono bg-white border rounded p-2 max-h-28 overflow-y-auto whitespace-pre-wrap break-all">
            {zplCode}
          </pre>
          <div className="flex gap-2">
            <button onClick={handleCopyZPL}
              className="flex-1 bg-gray-700 text-white py-1.5 rounded text-xs font-medium hover:bg-gray-800">
              {copied ? 'Copied!' : 'Copy ZPL'}
            </button>
            <button onClick={handleDownloadZPL}
              className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded text-xs font-medium hover:bg-gray-300">
              Download .zpl
            </button>
          </div>
        </div>
      )}

      {/* Laser info hint (shows once after download) */}
      {!laserBusy && (
        <p className="text-xs text-gray-400 text-center">
          Laser SVG — open in EzCad2/3 via File → Import, or use LightBurn
        </p>
      )}
    </div>
  );
}
