/**
 * Zebra ZPL Label Generator + Browser Print Integration
 *
 * Zebra Browser Print must be installed on the user's machine:
 * https://www.zebra.com/us/en/support-downloads/software/printer-software/browser-print.html
 *
 * Browser Print runs a local HTTP service on port 9100.
 */

const BROWSER_PRINT_URL = 'http://localhost:9100';

// ------------------------------------------------------------------
// ZPL generators
// ------------------------------------------------------------------

/**
 * Generate ZPL for a bin label.
 * size: 'small' (62mm), 'standard' (4x6 in), 'a6' (A6 landscape)
 */
export function buildBinZPL(bin, size = 'standard') {
  const code  = bin.full_code || '';
  const zone  = bin.zone_name ? `Zone: ${bin.zone_name}` : '';
  const qrVal = `BIN:${code}`;

  if (size === 'small') {
    // 62mm × 62mm  @ 203 DPI ≈ 496 × 496 dots
    return [
      '^XA',
      '^PW496',          // label width
      '^LL496',          // label length
      '^FO20,20^BQN,2,4',
      `^FDQA,${qrVal}^FS`,
      `^FO20,300^A0N,40,40^FD${code}^FS`,
      zone ? `^FO20,350^A0N,28,28^FD${zone}^FS` : '',
      '^XZ',
    ].filter(Boolean).join('\n');
  }

  if (size === 'a6') {
    // A6 landscape: 148mm × 105mm  @ 203 DPI ≈ 1183 × 839 dots
    return [
      '^XA',
      '^PW1183',
      '^LL839',
      '^FO40,80^BQN,2,7',
      `^FDQA,${qrVal}^FS`,
      `^FO450,80^A0N,70,70^FD${code}^FS`,
      zone ? `^FO450,170^A0N,38,38^FD${zone}^FS` : '',
      `^FO450,230^A0N,28,28^FDBIN:${code}^FS`,
      '^XZ',
    ].filter(Boolean).join('\n');
  }

  // standard: 4 × 6 inch  @ 203 DPI = 812 × 1218 dots
  return [
    '^XA',
    '^PW812',
    '^LL1218',
    '^FO50,60^BQN,2,8',
    `^FDQA,${qrVal}^FS`,
    `^FO420,60^A0N,65,65^FD${code}^FS`,
    zone ? `^FO420,145^A0N,38,38^FD${zone}^FS` : '',
    `^FO420,200^A0N,30,30^FDBIN:${code}^FS`,
    '^XZ',
  ].filter(Boolean).join('\n');
}

/**
 * Generate ZPL for an item label.
 */
export function buildItemZPL(item, size = 'standard') {
  const num  = item.item_number   || '';
  const desc = item.description_1 || '';
  const cat  = `${item.category || ''} · ${item.uom || ''}`;
  const qrVal = `ITEM:${num}`;

  if (size === 'small') {
    return [
      '^XA',
      '^PW496',
      '^LL496',
      '^FO20,20^BQN,2,4',
      `^FDQA,${qrVal}^FS`,
      `^FO20,300^A0N,36,36^FD${num}^FS`,
      `^FO20,345^A0N,24,24^FD${desc.slice(0, 18)}^FS`,
      '^XZ',
    ].filter(Boolean).join('\n');
  }

  if (size === 'a6') {
    return [
      '^XA',
      '^PW1183',
      '^LL839',
      '^FO40,80^BQN,2,7',
      `^FDQA,${qrVal}^FS`,
      `^FO450,80^A0N,60,60^FD${num}^FS`,
      `^FO450,155^A0N,34,34^FD${desc.slice(0, 26)}^FS`,
      `^FO450,205^A0N,28,28^FD${cat}^FS`,
      '^XZ',
    ].filter(Boolean).join('\n');
  }

  // standard 4×6
  return [
    '^XA',
    '^PW812',
    '^LL1218',
    '^FO50,60^BQN,2,8',
    `^FDQA,${qrVal}^FS`,
    `^FO420,60^A0N,60,60^FD${num}^FS`,
    `^FO420,140^A0N,36,36^FD${desc.slice(0, 22)}^FS`,
    item.description_2 ? `^FO420,185^A0N,30,30^FD${item.description_2.slice(0,22)}^FS` : '',
    `^FO420,230^A0N,28,28^FD${cat}^FS`,
    '^XZ',
  ].filter(Boolean).join('\n');
}

// ------------------------------------------------------------------
// Browser Print integration
// ------------------------------------------------------------------

/** Returns list of available Zebra printers, or null if Browser Print is not running. */
export async function getZebraPrinters() {
  try {
    const resp = await fetch(`${BROWSER_PRINT_URL}/available`, { signal: AbortSignal.timeout(2000) });
    const data = await resp.json();
    // Browser Print returns { printer: [...] } or { printer: {...} }
    const list = data.printer;
    return Array.isArray(list) ? list : (list ? [list] : []);
  } catch {
    return null; // Browser Print not running
  }
}

/** Send raw ZPL to a printer via Browser Print. */
export async function printZPL(zpl, printer) {
  const resp = await fetch(`${BROWSER_PRINT_URL}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device: printer, data: zpl }),
  });
  if (!resp.ok) throw new Error(`Browser Print error: ${resp.status}`);
}

/** Download ZPL as a .zpl file (fallback when Browser Print unavailable). */
export function downloadZPL(zpl, filename) {
  const blob = new Blob([zpl], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
