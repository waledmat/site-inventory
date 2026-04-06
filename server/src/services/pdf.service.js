const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

// ─── QR helper ───────────────────────────────────────────────────────────────
async function qrBuffer(text) {
  return QRCode.toBuffer(text, { type: 'png', width: 220, margin: 1 });
}

// ─── Shared helpers ──────────────────────────────────────────────────────────
function sysHeader(doc, title, subtitle) {
  doc.fontSize(16).font('Helvetica-Bold').text('SITE INVENTORY MANAGEMENT SYSTEM', { align: 'center' });
  doc.fontSize(13).text(title, { align: 'center' });
  if (subtitle) doc.fontSize(10).font('Helvetica').text(subtitle, { align: 'center' });
  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);
}

function tableHeader(doc, cols) {
  const y = doc.y;
  doc.fontSize(9).font('Helvetica-Bold');
  cols.forEach(c => doc.text(c.label, c.x, y, { width: c.w || 80 }));
  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.2);
}

function signatureBlock(doc, leftLabel, leftName, rightLabel, rightName) {
  doc.moveDown(1.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.8);
  doc.fontSize(10).font('Helvetica');
  const fy = doc.y;
  doc.font('Helvetica').text(`${leftLabel}:`, 40, fy);
  doc.font('Helvetica-Bold').text(leftName || 'N/A', 40, fy + 14);
  doc.font('Helvetica').text('Signature: ______________________', 40, fy + 40);
  doc.text('Date: ___________________________', 40, fy + 56);
  if (rightLabel) {
    doc.font('Helvetica').text(`${rightLabel}:`, 300, fy);
    doc.font('Helvetica-Bold').text(rightName || 'N/A', 300, fy + 14);
    doc.font('Helvetica').text('Signature: ______________________', 300, fy + 40);
    doc.text('Date: ___________________________', 300, fy + 56);
  }
}

// ─── Dispatch Note ───────────────────────────────────────────────────────────
exports.generateDispatchNote = async (data) => {
  const qr = await qrBuffer(`DO:${data.order_number}`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // QR top-right
    doc.image(qr, 455, 40, { width: 100 });

    sysHeader(doc, 'DISPATCH NOTE');

    // Meta row
    doc.fontSize(10).font('Helvetica');
    const y1 = doc.y;
    doc.text('DO Number: ', 40, y1, { continued: true }).font('Helvetica-Bold').text(data.order_number);
    doc.font('Helvetica').text('Date: ', 350, y1, { continued: true }).font('Helvetica-Bold')
       .text(String(data.dispatched_at || data.created_at).slice(0, 10));
    doc.font('Helvetica').moveDown(0.4);
    if (data.project_name) {
      doc.text('Project: ', { continued: true }).font('Helvetica-Bold').text(data.project_name);
      doc.font('Helvetica').moveDown(0.3);
    }
    if (data.destination) {
      doc.text('Destination: ', { continued: true }).font('Helvetica-Bold').text(data.destination);
      doc.font('Helvetica').moveDown(0.3);
    }
    doc.moveDown(0.3);

    // Items table
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold').text('ITEMS DISPATCHED');
    doc.moveDown(0.3);

    const cols = [
      { label: '#',           x: 40,  w: 20 },
      { label: 'Item No.',    x: 65,  w: 80 },
      { label: 'Description', x: 155, w: 185 },
      { label: 'Bin',         x: 345, w: 80 },
      { label: 'Qty',         x: 430, w: 50 },
      { label: 'UOM',         x: 485, w: 70 },
    ];
    tableHeader(doc, cols);

    doc.font('Helvetica').fontSize(9);
    (data.items || []).forEach((item, i) => {
      const ry = doc.y;
      doc.text(String(i + 1),                    cols[0].x, ry, { width: cols[0].w });
      doc.text(item.item_number || '-',           cols[1].x, ry, { width: cols[1].w });
      doc.text(item.description_1 || '-',         cols[2].x, ry, { width: cols[2].w });
      doc.text(item.bin_code || '-',              cols[3].x, ry, { width: cols[3].w });
      doc.text(String(item.qty_requested),        cols[4].x, ry, { width: cols[4].w });
      doc.text(item.uom || '-',                   cols[5].x, ry, { width: cols[5].w });
      doc.moveDown(0.7);
    });

    signatureBlock(doc, 'Dispatched By', data.dispatched_by_name, 'Received By', null);

    doc.end();
  });
};

// ─── Cycle Count Sheet ───────────────────────────────────────────────────────
exports.generateCycleCountSheet = async (data) => {
  const qr = await qrBuffer(`CC:${data.count_number}`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.image(qr, 455, 40, { width: 100 });

    const subtitle = data.zone_name ? `Zone: ${data.zone_name}` : 'All Zones';
    sysHeader(doc, 'CYCLE COUNT SHEET', subtitle);

    doc.fontSize(10).font('Helvetica');
    const y1 = doc.y;
    doc.text('Count No.: ', 40, y1, { continued: true }).font('Helvetica-Bold').text(data.count_number);
    doc.font('Helvetica').text('Date: ', 350, y1, { continued: true }).font('Helvetica-Bold')
       .text(String(data.created_at).slice(0, 10));
    doc.font('Helvetica').moveDown(0.4);
    doc.text('Status: ', { continued: true }).font('Helvetica-Bold').text(data.status.toUpperCase());
    doc.font('Helvetica').moveDown(0.5);

    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold').text('COUNT ITEMS');
    doc.moveDown(0.3);

    const cols = [
      { label: '#',           x: 40,  w: 20 },
      { label: 'Bin',         x: 65,  w: 70 },
      { label: 'Item No.',    x: 140, w: 80 },
      { label: 'Description', x: 225, w: 140 },
      { label: 'UOM',         x: 370, w: 35 },
      { label: 'System Qty',  x: 410, w: 55 },
      { label: 'Counted Qty', x: 470, w: 55 },
      { label: 'Variance',    x: 485 + 25, w: 50 },
    ];
    tableHeader(doc, cols);

    doc.font('Helvetica').fontSize(8.5);
    (data.items || []).forEach((item, i) => {
      const ry = doc.y;
      doc.text(String(i + 1),                              cols[0].x, ry, { width: cols[0].w });
      doc.text(item.bin_code || '-',                       cols[1].x, ry, { width: cols[1].w });
      doc.text(item.item_number || '-',                    cols[2].x, ry, { width: cols[2].w });
      doc.text(item.description_1 || '-',                  cols[3].x, ry, { width: cols[3].w });
      doc.text(item.uom || '-',                            cols[4].x, ry, { width: cols[4].w });
      doc.text(String(item.expected_qty),                  cols[5].x, ry, { width: cols[5].w });
      doc.text(item.counted_qty != null ? String(item.counted_qty) : '___', cols[6].x, ry, { width: cols[6].w });
      if (item.variance != null) {
        const varStr = item.variance > 0 ? `+${item.variance}` : String(item.variance);
        doc.text(item.variance !== 0 ? varStr : '-', cols[7].x, ry, { width: cols[7].w });
      } else {
        doc.text('-', cols[7].x, ry, { width: cols[7].w });
      }
      doc.moveDown(0.65);
      if (doc.y > 750) { doc.addPage(); }
    });

    signatureBlock(doc, 'Counted By', data.completed_by_name, 'Verified By', null);

    doc.end();
  });
};

// ─── Stock Movement Report PDF ───────────────────────────────────────────────
exports.generateStockMovementReport = (rows, filters = {}) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const subtitle = [
      filters.from && `From: ${filters.from}`,
      filters.to   && `To: ${filters.to}`,
      filters.category && `Category: ${filters.category}`,
    ].filter(Boolean).join('  |  ');

    sysHeader(doc, 'STOCK MOVEMENT REPORT', subtitle || null);

    const cols = [
      { label: 'Date',         x: 40,  w: 70 },
      { label: 'Type',         x: 115, w: 85 },
      { label: 'Item No.',     x: 205, w: 75 },
      { label: 'Description',  x: 285, w: 140 },
      { label: 'Bin',          x: 430, w: 65 },
      { label: 'Qty',          x: 500, w: 45 },
      { label: 'User',         x: 550, w: 90 },
    ];
    tableHeader(doc, cols);

    doc.font('Helvetica').fontSize(8);
    rows.forEach(row => {
      if (doc.y > 530) { doc.addPage(); tableHeader(doc, cols); }
      const ry = doc.y;
      doc.text(String(row.created_at).slice(0, 10), cols[0].x, ry, { width: cols[0].w });
      doc.text(row.transaction_type || '-',          cols[1].x, ry, { width: cols[1].w });
      doc.text(row.item_number || '-',               cols[2].x, ry, { width: cols[2].w });
      doc.text(row.description_1 || '-',             cols[3].x, ry, { width: cols[3].w });
      doc.text(row.bin_code || '-',                  cols[4].x, ry, { width: cols[4].w });
      const qtyStr = row.quantity > 0 ? `+${row.quantity}` : String(row.quantity);
      doc.text(qtyStr,                               cols[5].x, ry, { width: cols[5].w });
      doc.text(row.user_name || '-',                 cols[6].x, ry, { width: cols[6].w });
      doc.moveDown(0.6);
    });

    if (rows.length === 0) {
      doc.font('Helvetica').fontSize(10).text('No transactions found for the selected filters.', { align: 'center' });
    }

    doc.end();
  });
};

// ─── Stock Snapshot Report PDF ───────────────────────────────────────────────
exports.generateStockSnapshotReport = (rows, filters = {}) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const subtitle = [
      filters.category && `Category: ${filters.category}`,
      new Date().toISOString().slice(0, 10),
    ].filter(Boolean).join('  |  ');

    sysHeader(doc, 'STOCK SNAPSHOT REPORT', subtitle);

    const cols = [
      { label: 'Item No.',     x: 40,  w: 80 },
      { label: 'Description',  x: 125, w: 175 },
      { label: 'Category',     x: 305, w: 60 },
      { label: 'UOM',          x: 370, w: 40 },
      { label: 'On Hand',      x: 415, w: 55 },
      { label: 'Reorder Pt',   x: 475, w: 55 },
      { label: 'Status',       x: 500, w: 55 },
    ];
    tableHeader(doc, cols);

    doc.font('Helvetica').fontSize(9);
    rows.forEach(row => {
      if (doc.y > 750) { doc.addPage(); tableHeader(doc, cols); }
      const ry = doc.y;
      doc.text(row.item_number || '-',    cols[0].x, ry, { width: cols[0].w });
      doc.text(row.description_1 || '-',  cols[1].x, ry, { width: cols[1].w });
      doc.text(row.category || '-',       cols[2].x, ry, { width: cols[2].w });
      doc.text(row.uom || '-',            cols[3].x, ry, { width: cols[3].w });
      doc.text(String(row.total_qty),     cols[4].x, ry, { width: cols[4].w });
      doc.text(String(row.reorder_point || 0), cols[5].x, ry, { width: cols[5].w });
      doc.font(row.low_stock ? 'Helvetica-Bold' : 'Helvetica')
         .text(row.low_stock ? 'LOW' : 'OK', cols[6].x, ry, { width: cols[6].w });
      doc.font('Helvetica').moveDown(0.65);
    });

    if (rows.length === 0) {
      doc.font('Helvetica').fontSize(10).text('No items found.', { align: 'center' });
    }

    doc.end();
  });
};

// ─── GRN PDF ─────────────────────────────────────────────────────────────────
exports.generateGRNPdf = async (data) => {
  const qr = await qrBuffer(`GRN:${data.grn_number}`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.image(qr, 455, 40, { width: 100 });

    sysHeader(doc, 'GOODS RECEIPT NOTE (GRN)');

    doc.fontSize(10).font('Helvetica');
    const y1 = doc.y;
    doc.text('GRN Number: ', 40, y1, { continued: true }).font('Helvetica-Bold').text(data.grn_number);
    doc.font('Helvetica').text('Date: ', 350, y1, { continued: true }).font('Helvetica-Bold')
       .text(String(data.received_date).slice(0, 10));
    doc.font('Helvetica').moveDown(0.4);
    if (data.supplier_name) {
      doc.text('Supplier: ', { continued: true }).font('Helvetica-Bold').text(data.supplier_name);
      doc.font('Helvetica').moveDown(0.3);
    }
    if (data.po_number) {
      doc.text('PO Reference: ', { continued: true }).font('Helvetica-Bold').text(data.po_number);
      doc.font('Helvetica').moveDown(0.3);
    }
    doc.text('Status: ', { continued: true }).font('Helvetica-Bold').text((data.status || '').toUpperCase());
    doc.font('Helvetica').moveDown(0.5);

    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold').text('ITEMS RECEIVED');
    doc.moveDown(0.3);

    const cols = [
      { label: '#',           x: 40,  w: 20 },
      { label: 'Item No.',    x: 65,  w: 80 },
      { label: 'Description', x: 150, w: 185 },
      { label: 'UOM',         x: 340, w: 45 },
      { label: 'Qty Received',x: 390, w: 70 },
      { label: 'Condition',   x: 465, w: 90 },
    ];
    tableHeader(doc, cols);

    doc.font('Helvetica').fontSize(9);
    (data.items || []).forEach((item, i) => {
      if (doc.y > 750) { doc.addPage(); tableHeader(doc, cols); }
      const ry = doc.y;
      doc.text(String(i + 1),                  cols[0].x, ry, { width: cols[0].w });
      doc.text(item.item_number || '-',         cols[1].x, ry, { width: cols[1].w });
      doc.text(item.description_1 || '-',       cols[2].x, ry, { width: cols[2].w });
      doc.text(item.uom || '-',                 cols[3].x, ry, { width: cols[3].w });
      doc.text(String(item.qty_received),       cols[4].x, ry, { width: cols[4].w });
      doc.text(item.condition || 'good',        cols[5].x, ry, { width: cols[5].w });
      doc.moveDown(0.7);
    });

    signatureBlock(doc, 'Received By', data.created_by_name, 'Verified By', null);
    doc.end();
  });
};

// ─── Bin Label ────────────────────────────────────────────────────────────────
exports.generateBinLabel = async (bin) => {
  const qr = await qrBuffer(`BIN:${bin.full_code}`);
  return new Promise((resolve, reject) => {
    // A6 landscape ~420x298 pt
    const doc = new PDFDocument({ margin: 20, size: [420, 298] });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // QR code left side
    doc.image(qr, 20, 20, { width: 180 });

    // Right side text
    const tx = 215;
    doc.fontSize(9).font('Helvetica').fillColor('#666666').text('WAREHOUSE BIN LABEL', tx, 20);
    doc.moveTo(tx, doc.y + 4).lineTo(400, doc.y + 4).stroke('#cccccc');
    doc.moveDown(0.6);

    doc.fontSize(28).font('Helvetica-Bold').fillColor('#000000').text(bin.full_code, tx, doc.y, { width: 185 });
    doc.moveDown(0.8);

    if (bin.zone_name) {
      doc.fontSize(10).font('Helvetica').fillColor('#444444').text('Zone', tx, doc.y);
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000').text(bin.zone_name, tx, doc.y, { width: 185 });
      doc.moveDown(0.4);
    }
    if (bin.rack_code) {
      doc.fontSize(10).font('Helvetica').fillColor('#444444').text('Rack / Shelf', tx, doc.y);
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000')
         .text(`${bin.rack_code} / ${bin.shelf_code || '-'}`, tx, doc.y, { width: 185 });
      doc.moveDown(0.4);
    }
    if (bin.max_qty) {
      doc.fontSize(10).font('Helvetica').fillColor('#444444').text('Max Qty', tx, doc.y);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text(String(bin.max_qty), tx, doc.y);
    }

    // Barcode-style footer
    doc.fontSize(8).font('Helvetica').fillColor('#999999')
       .text(`Site Inventory Management System`, 20, 270, { width: 380, align: 'center' });

    doc.end();
  });
};

// ─── Item Label ───────────────────────────────────────────────────────────────
exports.generateItemLabel = async (item) => {
  const qr = await qrBuffer(`ITEM:${item.item_number}`);
  return new Promise((resolve, reject) => {
    // A6 landscape
    const doc = new PDFDocument({ margin: 20, size: [420, 298] });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // QR code left
    doc.image(qr, 20, 20, { width: 180 });

    const tx = 215;
    doc.fontSize(9).font('Helvetica').fillColor('#666666').text('ITEM LABEL', tx, 20);
    doc.moveTo(tx, doc.y + 4).lineTo(400, doc.y + 4).stroke('#cccccc');
    doc.moveDown(0.6);

    doc.fontSize(24).font('Helvetica-Bold').fillColor('#000000').text(item.item_number, tx, doc.y, { width: 185 });
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#222222').text(item.description_1, tx, doc.y, { width: 185 });
    if (item.description_2) {
      doc.fontSize(10).font('Helvetica').fillColor('#555555').text(item.description_2, tx, doc.y, { width: 185 });
    }
    doc.moveDown(0.5);

    const catColors = { CH: '#dc2626', DC: '#2563eb', SPARE: '#7c3aed', GENERAL: '#059669' };
    const catColor = catColors[item.category] || '#374151';
    doc.fontSize(10).font('Helvetica').fillColor('#444444').text('Category  /  UOM', tx, doc.y);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(catColor)
       .text(`${item.category || '-'}  /  ${item.uom || '-'}`, tx, doc.y, { width: 185 });

    if (item.reorder_point) {
      doc.moveDown(0.4);
      doc.fontSize(9).font('Helvetica').fillColor('#888888')
         .text(`Reorder Point: ${item.reorder_point}`, tx, doc.y);
    }

    doc.fontSize(8).font('Helvetica').fillColor('#999999')
       .text('Site Inventory Management System', 20, 270, { width: 380, align: 'center' });

    doc.end();
  });
};

// ─── Delivery Note (original) ────────────────────────────────────────────────
exports.generateDeliveryNote = (issueData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 515; // usable width

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('SITE INVENTORY MANAGEMENT SYSTEM', { align: 'center' });
    doc.fontSize(14).text('DELIVERY NOTE', { align: 'center' });
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // DN info row
    doc.fontSize(10).font('Helvetica');
    const y1 = doc.y;
    doc.text(`DN Number: `, 40, y1, { continued: true }).font('Helvetica-Bold').text(issueData.delivery_note_id);
    doc.font('Helvetica').text(`Date: `, 350, y1, { continued: true }).font('Helvetica-Bold').text(String(issueData.issue_date).slice(0,10));
    doc.font('Helvetica').moveDown(0.5);

    doc.text(`Project: `, { continued: true }).font('Helvetica-Bold').text(issueData.project_name);
    doc.font('Helvetica').moveDown(0.8);

    // Request info
    doc.font('Helvetica').moveDown(0.3);
    if (issueData.request_ref) {
      doc.text(`Request Ref: `, { continued: true }).font('Helvetica-Bold').text(issueData.request_ref);
      doc.font('Helvetica').moveDown(0.5);
    }
    doc.moveDown(0.3);

    // Items table
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold').text('ITEMS ISSUED');
    doc.moveDown(0.3);

    // Table header
    const cols = { no: 40, itemNo: 60, desc: 155, batch: 350, qty: 430, uom: 490 };
    doc.fontSize(9).font('Helvetica-Bold');
    const th = doc.y;
    doc.text('#', cols.no, th);
    doc.text('Item No.', cols.itemNo, th);
    doc.text('Description', cols.desc, th);
    doc.text('Batch No.', cols.batch, th);
    doc.text('Qty', cols.qty, th);
    doc.text('UOM', cols.uom, th);
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.2);

    // Table rows
    doc.font('Helvetica').fontSize(9);
    (issueData.items || []).forEach((item, i) => {
      const ry = doc.y;
      doc.text(String(i + 1), cols.no, ry);
      doc.text(item.item_number || '-', cols.itemNo, ry);
      doc.text(item.description_1 + (item.description_2 ? ` / ${item.description_2}` : ''), cols.desc, ry, { width: 185 });
      doc.text(item.batch_number || '-', cols.batch, ry, { width: 75 });
      doc.text(String(item.quantity_issued), cols.qty, ry);
      doc.text(item.uom, cols.uom, ry);
      doc.moveDown(0.7);
    });

    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    // Footer — two columns: Issued By (left) | Received By (right)
    doc.fontSize(10).font('Helvetica');
    const footerY = doc.y;
    const leftX = 40;
    const rightX = 300;

    // Left: Issued By
    doc.font('Helvetica').text('Issued By:', leftX, footerY);
    doc.font('Helvetica-Bold').text(issueData.storekeeper_name || 'N/A', leftX, doc.y);
    doc.font('Helvetica').text('(Storekeeper)', leftX, doc.y);
    doc.moveDown(1.5);
    const sigY = doc.y;
    doc.text('Signature: ______________________', leftX, sigY);
    doc.moveDown(0.5);
    doc.text('Date: ___________________________', leftX, doc.y);

    // Right: Received By
    doc.font('Helvetica').text('Received By:', rightX, footerY);
    doc.font('Helvetica-Bold').text(issueData.receiver_name || 'N/A', rightX, footerY + 14);
    doc.font('Helvetica').text(`(${issueData.receiver_position || 'Requester'})`, rightX, footerY + 28);
    doc.text('Signature: ______________________', rightX, sigY);
    doc.moveDown(0.5);
    doc.text('Date: ___________________________', rightX, sigY + 17);

    doc.end();
  });
};
