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

    // Receiver box
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold').text('RECEIVER INFORMATION');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Receiver ID:   ${issueData.receiver_id_val || 'N/A'}`);
    doc.text(`Receiver Name: ${issueData.receiver_name || 'N/A'}`);
    doc.moveDown(0.5);
    doc.text('Signature: _____________________________________________');
    doc.moveDown(0.8);

    // Items table
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold').text('ITEMS ISSUED');
    doc.moveDown(0.3);

    // Table header
    const cols = { no: 40, itemNo: 60, desc: 160, qty: 400, uom: 460 };
    doc.fontSize(9).font('Helvetica-Bold');
    const th = doc.y;
    doc.text('#', cols.no, th);
    doc.text('Item No.', cols.itemNo, th);
    doc.text('Description', cols.desc, th);
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
      doc.text(item.description_1 + (item.description_2 ? ` / ${item.description_2}` : ''), cols.desc, ry, { width: 230 });
      doc.text(String(item.quantity_issued), cols.qty, ry);
      doc.text(item.uom, cols.uom, ry);
      doc.moveDown(0.7);
    });

    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    // Footer
    doc.fontSize(10).font('Helvetica');
    doc.text(`Issued By: `, { continued: true }).font('Helvetica-Bold').text(issueData.storekeeper_name);
    doc.font('Helvetica').moveDown(1.5);
    doc.text('Storekeeper Signature: _________________________     Date: ________________');

    doc.end();
  });
};
