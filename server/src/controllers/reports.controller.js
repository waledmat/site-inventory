const db = require('../config/db');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

exports.summary = async (req, res, next) => {
  try {
    const { project_id, date_from, date_to } = req.query;
    let where = [], params = [];
    if (project_id) { params.push(project_id); where.push(`i.project_id = $${params.length}`); }
    if (date_from) { params.push(date_from); where.push(`i.issue_date >= $${params.length}`); }
    if (date_to) { params.push(date_to); where.push(`i.issue_date <= $${params.length}`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const issued = await db.query(
      `SELECT p.name as project_name, COUNT(i.id) as issue_count, SUM(ii.quantity_issued) as total_qty
       FROM material_issues i JOIN projects p ON p.id = i.project_id JOIN issue_items ii ON ii.issue_id = i.id
       ${wc} GROUP BY p.name ORDER BY p.name`, params
    );
    const returned = await db.query(
      `SELECT p.name as project_name, SUM(r.quantity_returned) as total_returned
       FROM material_returns r JOIN material_issues i ON i.project_id = r.project_id JOIN projects p ON p.id = r.project_id
       ${wc} GROUP BY p.name`, params
    );
    res.json({ issued: issued.rows, returned: returned.rows });
  } catch (err) { next(err); }
};

exports.dailyLog = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT dr.*, p.name as project_name FROM daily_reports dr LEFT JOIN projects p ON p.id = dr.project_id ORDER BY dr.report_date DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.packingList = async (req, res, next) => {
  try {
    const { project_id } = req.query;
    let where = [], params = [];
    if (project_id) { params.push(project_id); where.push(`project_id = $${params.length}`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { rows } = await db.query(
      `SELECT item_number, description_1, description_2, category, uom,
              qty_on_hand, qty_issued, qty_pending_return, container_no, y3_number
       FROM stock_items ${wc} ORDER BY item_number`, params
    );

    let projectName = 'All Projects';
    if (project_id) {
      const pr = await db.query('SELECT name FROM projects WHERE id = $1', [project_id]);
      if (pr.rows[0]) projectName = pr.rows[0].name;
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="packing-list-${new Date().toISOString().slice(0,10)}.pdf"`);
      res.send(Buffer.concat(chunks));
    });
    doc.on('error', next);

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text('SITE INVENTORY MANAGEMENT SYSTEM', { align: 'center' });
    doc.fontSize(12).text('STOCK ON-HAND REPORT (PACKING LIST)', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Project: ${projectName}    |    Date: ${new Date().toISOString().slice(0,10)}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
    doc.moveDown(0.4);

    // Table header
    const cols = { no: 40, itemNo: 60, desc: 160, cat: 340, uom: 400, onHand: 445, issued: 510, pending: 575, container: 635 };
    doc.fontSize(8).font('Helvetica-Bold');
    const th = doc.y;
    doc.text('#', cols.no, th);
    doc.text('Item No.', cols.itemNo, th);
    doc.text('Description', cols.desc, th);
    doc.text('Cat', cols.cat, th);
    doc.text('UOM', cols.uom, th);
    doc.text('On Hand', cols.onHand, th);
    doc.text('Issued', cols.issued, th);
    doc.text('Pending Ret.', cols.pending, th);
    doc.text('Container', cols.container, th);
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(8);
    rows.forEach((item, i) => {
      if (doc.y > 520) {
        doc.addPage({ layout: 'landscape' });
        doc.y = 40;
      }
      const ry = doc.y;
      doc.text(String(i + 1), cols.no, ry);
      doc.text(item.item_number || '—', cols.itemNo, ry);
      doc.text((item.description_1 || '') + (item.description_2 ? ` / ${item.description_2}` : ''), cols.desc, ry, { width: 170 });
      doc.text(item.category || '—', cols.cat, ry);
      doc.text(item.uom || '—', cols.uom, ry);
      doc.text(String(item.qty_on_hand ?? 0), cols.onHand, ry);
      doc.text(String(item.qty_issued ?? 0), cols.issued, ry);
      doc.text(String(item.qty_pending_return ?? 0), cols.pending, ry);
      doc.text(item.container_no || '—', cols.container, ry, { width: 100 });
      doc.moveDown(0.7);
    });

    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica').text(`Total Items: ${rows.length}`, 40);
    doc.end();
  } catch (err) { next(err); }
};

exports.exportExcel = async (req, res, next) => {
  try {
    const { project_id, date_from, date_to } = req.query;
    let where = [], params = [];
    if (project_id) { params.push(project_id); where.push(`i.project_id = $${params.length}`); }
    if (date_from) { params.push(date_from); where.push(`i.issue_date >= $${params.length}`); }
    if (date_to) { params.push(date_to); where.push(`i.issue_date <= $${params.length}`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { rows } = await db.query(
      `SELECT i.delivery_note_id, p.name as project, i.issue_date,
              sk.name as storekeeper, rc.name as receiver,
              ii.item_number, ii.description_1, ii.quantity_issued, ii.uom
       FROM material_issues i
       JOIN projects p ON p.id = i.project_id
       JOIN users sk ON sk.id = i.storekeeper_id
       LEFT JOIN users rc ON rc.id = i.receiver_id
       JOIN issue_items ii ON ii.issue_id = i.id
       ${wc} ORDER BY i.issue_date DESC`, params
    );

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Issues');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="report.xlsx"');
    res.send(buf);
  } catch (err) { next(err); }
};
