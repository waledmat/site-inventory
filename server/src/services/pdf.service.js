const PDFDocument = require('pdfkit');

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
