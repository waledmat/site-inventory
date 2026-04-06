/**
 * SVG Label Export for EzCad / Laser Engraving Machines
 *
 * Generates a pure-vector SVG file that can be:
 *   - Imported into EzCad2 / EzCad3 (File → Import)
 *   - Opened in LightBurn
 *   - Opened in any laser engraver software that supports SVG
 *
 * The QR code is rendered as vector paths (no raster images) for
 * clean laser marking at any power/speed setting.
 */

import QRCode from 'qrcode';

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

/** Extract the inner content from a QR SVG string (strips outer <svg> tags). */
function extractSvgInner(svgString) {
  return svgString
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<svg[^>]*>/i, '')
    .replace(/<\/svg>/i, '')
    .trim();
}

/** Download a text blob as a file. */
function downloadFile(content, filename, mime = 'image/svg+xml') {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Build a complete SVG document embedding the QR code as vector paths
 * and the label text below it.
 *
 * @param {string} qrValue   - The data to encode (e.g. "BIN:ZA-R01-S01-B001")
 * @param {string[]} lines   - Text lines to render below the QR code
 * @param {object}  opts     - { docW, docH, qrSize, unit } (all in mm)
 */
async function buildSVG(qrValue, lines, { docW = 62, docH = 80, qrSize = 50, unit = 'mm' } = {}) {
  // Generate QR as SVG string (vector paths, no raster)
  const qrSvgRaw = await QRCode.toString(qrValue, {
    type: 'svg',
    width: qrSize,        // treated as viewBox units; we scale via SVG <svg> element
    margin: 0,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });

  const qrInner    = extractSvgInner(qrSvgRaw);
  const margin     = 4;   // mm from edge
  const qrX        = (docW - qrSize) / 2;
  const qrY        = margin;
  const textStartY = qrY + qrSize + 6;
  const lineH      = 5;   // mm between text lines

  const textLines = lines.map((line, i) => {
    const fontSize = i === 0 ? 4.5 : 3;
    const fontW    = i === 0 ? 'bold' : 'normal';
    return `<text x="${docW / 2}" y="${textStartY + i * lineH}"
      text-anchor="middle" dominant-baseline="hanging"
      font-family="Courier New, monospace" font-size="${fontSize}mm"
      font-weight="${fontW}" fill="#000000">${escXml(line)}</text>`;
  }).join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- EzCad / Laser Engraver Label — import via File → Import in EzCad2/3 -->
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${docW}${unit}" height="${docH}${unit}"
     viewBox="0 0 ${docW} ${docH}">

  <!-- White background (optional — remove if engraving on metal) -->
  <rect width="${docW}" height="${docH}" fill="#ffffff" stroke="none"/>

  <!-- QR Code (vector paths) -->
  <svg x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}"
       viewBox="0 0 ${qrSize} ${qrSize}">
    ${qrInner}
  </svg>

  <!-- Label text -->
  ${textLines}

</svg>`;
}

function escXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Download a bin label as SVG for EzCad / laser engraver.
 * @param {object} bin - { full_code, zone_name? }
 * @param {string} size - 'small' (62mm), 'standard' (100×50mm), 'a6'
 */
export async function downloadBinLabelSVG(bin, size = 'standard') {
  const dims = {
    small:    { docW: 62, docH: 75,  qrSize: 48 },
    standard: { docW: 100, docH: 55, qrSize: 42 },
    a6:       { docW: 148, docH: 105, qrSize: 65 },
  }[size] || { docW: 100, docH: 55, qrSize: 42 };

  const lines = [
    bin.full_code,
    bin.zone_name ? `Zone: ${bin.zone_name}` : '',
    `BIN:${bin.full_code}`,
  ].filter(Boolean);

  const svg = await buildSVG(`BIN:${bin.full_code}`, lines, dims);
  downloadFile(svg, `BIN-${bin.full_code}.svg`);
}

/**
 * Download an item label as SVG for EzCad / laser engraver.
 * @param {object} item - { item_number, description_1, description_2?, category, uom }
 * @param {string} size - 'small', 'standard', 'a6'
 */
export async function downloadItemLabelSVG(item, size = 'standard') {
  const dims = {
    small:    { docW: 62,  docH: 75,  qrSize: 48 },
    standard: { docW: 100, docH: 55,  qrSize: 42 },
    a6:       { docW: 148, docH: 105, qrSize: 65 },
  }[size] || { docW: 100, docH: 55, qrSize: 42 };

  const lines = [
    item.item_number,
    item.description_1,
    item.description_2 || '',
    `${item.category} · ${item.uom}`,
    `ITEM:${item.item_number}`,
  ].filter(Boolean);

  const svg = await buildSVG(`ITEM:${item.item_number}`, lines, dims);
  downloadFile(svg, `ITEM-${item.item_number}.svg`);
}
