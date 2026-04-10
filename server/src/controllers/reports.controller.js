const db = require('../config/db');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

const TODAY = () => new Date().toISOString().slice(0, 10);

// ─── helpers ────────────────────────────────────────────────────────────────

function sendPdf(res, filename, buildFn) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  const chunks = [];
  doc.on('data', d => chunks.push(d));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.concat(chunks));
  });
  doc.on('error', err => { throw err; });
  buildFn(doc);
  doc.end();
}

function sendExcel(res, filename, sheets) {
  const wb = XLSX.utils.book_new();
  for (const { name, data } of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name);
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

function pdfHeader(doc, title, subtitle, info) {
  doc.fontSize(16).font('Helvetica-Bold').text('SITE INVENTORY MANAGEMENT SYSTEM', { align: 'center' });
  doc.fontSize(12).text(title, { align: 'center' });
  if (subtitle) doc.fontSize(10).font('Helvetica').text(subtitle, { align: 'center' });
  if (info) doc.fontSize(9).font('Helvetica').text(info, { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
  doc.moveDown(0.4);
}

// ─── summary ────────────────────────────────────────────────────────────────

exports.summary = async (req, res, next) => {
  try {
    const { project_id, date_from, date_to, format } = req.query;
    let where = [], params = [];
    if (project_id) { params.push(project_id); where.push(`i.project_id = $${params.length}`); }
    if (date_from)  { params.push(date_from);  where.push(`i.issue_date >= $${params.length}`); }
    if (date_to)    { params.push(date_to);    where.push(`i.issue_date <= $${params.length}`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const issued = await db.query(
      `SELECT p.name as project_name, COUNT(i.id) as issue_count, SUM(ii.quantity_issued) as total_qty
       FROM material_issues i
       JOIN projects p ON p.id = i.project_id
       JOIN issue_items ii ON ii.issue_id = i.id
       ${wc} GROUP BY p.name ORDER BY p.name`, params
    );
    // Build a separate where clause for returns (using return_date instead of issue_date)
    let rwhere = [], rparams = [];
    if (project_id) { rparams.push(project_id); rwhere.push(`r.project_id = $${rparams.length}`); }
    if (date_from)  { rparams.push(date_from);  rwhere.push(`r.return_date >= $${rparams.length}`); }
    if (date_to)    { rparams.push(date_to);    rwhere.push(`r.return_date <= $${rparams.length}`); }
    const rwc = rwhere.length ? 'WHERE ' + rwhere.join(' AND ') : '';

    const returned = await db.query(
      `SELECT p.name as project_name, SUM(r.quantity_returned) as total_returned
       FROM material_returns r
       JOIN projects p ON p.id = r.project_id
       ${rwc} GROUP BY p.name`, rparams
    );

    const issuedRows  = issued.rows;
    const returnedMap = Object.fromEntries(returned.rows.map(r => [r.project_name, r.total_returned]));
    const dateRange   = (date_from || date_to) ? `Period: ${date_from || '—'} to ${date_to || '—'}` : `Date: ${TODAY()}`;

    if (format === 'excel') {
      const data = issuedRows.map(r => ({
        'Project':          r.project_name,
        'Total Issues':     Number(r.issue_count),
        'Total Qty Issued': Number(r.total_qty),
        'Total Returned':   Number(returnedMap[r.project_name] ?? 0),
        'Net Outstanding':  Number(r.total_qty) - Number(returnedMap[r.project_name] ?? 0),
      }));
      return sendExcel(res, `summary-${TODAY()}.xlsx`, [{ name: 'Summary', data }]);
    }

    if (format === 'pdf') {
      return sendPdf(res, `summary-${TODAY()}.pdf`, doc => {
        pdfHeader(doc, 'MATERIAL SUMMARY REPORT', null, dateRange);

        const cols = { no: 40, proj: 70, issues: 310, qty: 390, returned: 480, outstanding: 570 };
        doc.fontSize(9).font('Helvetica-Bold');
        const th = doc.y;
        doc.text('#',            cols.no,          th);
        doc.text('Project',      cols.proj,         th);
        doc.text('Issues',       cols.issues,       th);
        doc.text('Qty Issued',   cols.qty,          th);
        doc.text('Returned',     cols.returned,     th);
        doc.text('Outstanding',  cols.outstanding,  th);
        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
        doc.moveDown(0.2);

        doc.font('Helvetica').fontSize(9);
        let totalIssues = 0, totalQty = 0, totalRet = 0;
        issuedRows.forEach((r, i) => {
          const ret  = Number(returnedMap[r.project_name] ?? 0);
          const out  = Number(r.total_qty) - ret;
          totalIssues += Number(r.issue_count);
          totalQty    += Number(r.total_qty);
          totalRet    += ret;
          const ry = doc.y;
          doc.text(String(i + 1),            cols.no,         ry);
          doc.text(r.project_name,           cols.proj,       ry, { width: 230 });
          doc.text(String(r.issue_count),    cols.issues,     ry);
          doc.text(String(r.total_qty),      cols.qty,        ry);
          doc.text(String(ret),              cols.returned,   ry);
          doc.text(String(out.toFixed(3)),   cols.outstanding,ry);
          doc.moveDown(0.7);
        });

        doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').fontSize(9);
        const ty = doc.y;
        doc.text('TOTAL', cols.proj, ty);
        doc.text(String(totalIssues), cols.issues, ty);
        doc.text(String(totalQty.toFixed(3)), cols.qty, ty);
        doc.text(String(totalRet.toFixed(3)), cols.returned, ty);
        doc.text(String((totalQty - totalRet).toFixed(3)), cols.outstanding, ty);
        doc.moveDown(1);
        doc.font('Helvetica').fontSize(8).text(`Generated: ${new Date().toLocaleString()}`, 40);
      });
    }

    res.json({ issued: issuedRows, returned: returned.rows });
  } catch (err) { next(err); }
};

// ─── daily log ───────────────────────────────────────────────────────────────

exports.dailyLog = async (req, res, next) => {
  try {
    const { format, project_id } = req.query;
    let where = [], params = [];
    if (project_id) { params.push(project_id); where.push(`dr.project_id = $${params.length}`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { rows } = await db.query(
      `SELECT dr.report_date, p.name as project_name,
              dr.issued_count, dr.returned_count, dr.pending_count, dr.overdue_count, dr.sent_at
       FROM daily_reports dr
       LEFT JOIN projects p ON p.id = dr.project_id
       ${wc} ORDER BY dr.report_date DESC LIMIT 100`,
      params
    );

    if (format === 'excel') {
      const data = rows.map(r => ({
        'Date':           r.report_date,
        'Project':        r.project_name || '—',
        'Issued Count':   r.issued_count ?? 0,
        'Returned Count': r.returned_count ?? 0,
        'Pending Count':  r.pending_count ?? 0,
        'Overdue Count':  r.overdue_count ?? 0,
        'Sent At':        r.sent_at || '',
      }));
      return sendExcel(res, `daily-log-${TODAY()}.xlsx`, [{ name: 'Daily Log', data }]);
    }

    if (format === 'pdf') {
      return sendPdf(res, `daily-log-${TODAY()}.pdf`, doc => {
        pdfHeader(doc, 'DAILY ACTIVITY LOG', null, `Date: ${TODAY()}`);

        const cols = { no: 40, date: 70, proj: 160, issues: 390, returns: 470, notes: 540 };
        doc.fontSize(9).font('Helvetica-Bold');
        const th = doc.y;
        doc.text('#',             cols.no,      th);
        doc.text('Date',          cols.date,    th);
        doc.text('Project',       cols.proj,    th);
        doc.text('Issues',        cols.issues,  th);
        doc.text('Returns',       cols.returns, th);
        doc.text('Notes',         cols.notes,   th);
        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
        doc.moveDown(0.2);

        doc.font('Helvetica').fontSize(9);
        if (rows.length === 0) {
          doc.text('No daily log entries found.', 40, doc.y);
        } else {
          rows.forEach((r, i) => {
            if (doc.y > 520) { doc.addPage({ layout: 'landscape' }); doc.y = 40; }
            const ry = doc.y;
            doc.text(String(i + 1),           cols.no,      ry);
            doc.text(String(r.report_date).slice(0,10), cols.date, ry);
            doc.text(r.project_name || '—',   cols.proj,    ry, { width: 220 });
            doc.text(String(r.issued_count ?? 0),   cols.issues,  ry);
            doc.text(String(r.returned_count ?? 0), cols.returns, ry);
            doc.text(r.sent_at ? 'Sent' : 'Pending', cols.notes, ry, { width: 220 });
            doc.moveDown(0.7);
          });
        }

        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(8).text(`Total Entries: ${rows.length}  |  Generated: ${new Date().toLocaleString()}`, 40);
      });
    }

    res.json(rows);
  } catch (err) { next(err); }
};

// ─── packing list ────────────────────────────────────────────────────────────

exports.packingList = async (req, res, next) => {
  try {
    const { project_id, format } = req.query;
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

    if (format === 'excel') {
      const data = rows.map(r => ({
        'Item Number':    r.item_number || '',
        'Description':    r.description_1 || '',
        'Description 2':  r.description_2 || '',
        'Category':       r.category || '',
        'UOM':            r.uom || '',
        'On Hand':        Number(r.qty_on_hand ?? 0),
        'Issued':         Number(r.qty_issued ?? 0),
        'Pending Return': Number(r.qty_pending_return ?? 0),
        'Container No':   r.container_no || '',
        'Y3 Number':      r.y3_number || '',
      }));
      return sendExcel(res, `packing-list-${TODAY()}.xlsx`, [{ name: projectName.slice(0, 31), data }]);
    }

    // Default: PDF (existing behaviour)
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('end', () => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="packing-list-${TODAY()}.pdf"`);
      res.send(Buffer.concat(chunks));
    });
    doc.on('error', next);

    doc.fontSize(16).font('Helvetica-Bold').text('SITE INVENTORY MANAGEMENT SYSTEM', { align: 'center' });
    doc.fontSize(12).text('STOCK ON-HAND REPORT (PACKING LIST)', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Project: ${projectName}    |    Date: ${TODAY()}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
    doc.moveDown(0.4);

    const cols = { no: 40, itemNo: 60, desc: 160, cat: 340, uom: 400, onHand: 445, issued: 510, pending: 575, container: 635 };
    doc.fontSize(8).font('Helvetica-Bold');
    const th = doc.y;
    doc.text('#',            cols.no,        th);
    doc.text('Item No.',     cols.itemNo,    th);
    doc.text('Description',  cols.desc,      th);
    doc.text('Cat',          cols.cat,       th);
    doc.text('UOM',          cols.uom,       th);
    doc.text('On Hand',      cols.onHand,    th);
    doc.text('Issued',       cols.issued,    th);
    doc.text('Pending Ret.', cols.pending,   th);
    doc.text('Container',    cols.container, th);
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
    doc.moveDown(0.2);

    doc.font('Helvetica').fontSize(8);
    rows.forEach((item, i) => {
      if (doc.y > 520) { doc.addPage({ layout: 'landscape' }); doc.y = 40; }
      const ry = doc.y;
      doc.text(String(i + 1),                                                    cols.no,        ry);
      doc.text(item.item_number || '—',                                           cols.itemNo,    ry);
      doc.text((item.description_1 || '') + (item.description_2 ? ` / ${item.description_2}` : ''), cols.desc, ry, { width: 170 });
      doc.text(item.category || '—',                                              cols.cat,       ry);
      doc.text(item.uom || '—',                                                   cols.uom,       ry);
      doc.text(String(item.qty_on_hand ?? 0),                                     cols.onHand,    ry);
      doc.text(String(item.qty_issued ?? 0),                                      cols.issued,    ry);
      doc.text(String(item.qty_pending_return ?? 0),                              cols.pending,   ry);
      doc.text(item.container_no || '—',                                          cols.container, ry, { width: 100 });
      doc.moveDown(0.7);
    });

    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica').text(`Total Items: ${rows.length}`, 40);
    doc.end();
  } catch (err) { next(err); }
};

// ─── issues export (excel) ───────────────────────────────────────────────────

exports.exportExcel = async (req, res, next) => {
  try {
    const { project_id, date_from, date_to, format } = req.query;
    let where = [], params = [];
    if (project_id) { params.push(project_id); where.push(`i.project_id = $${params.length}`); }
    if (date_from)  { params.push(date_from);  where.push(`i.issue_date >= $${params.length}`); }
    if (date_to)    { params.push(date_to);    where.push(`i.issue_date <= $${params.length}`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { rows } = await db.query(
      `SELECT i.delivery_note_id, mr.request_number, p.name as project, i.issue_date,
              sk.name as storekeeper, rc.name as receiver,
              ii.item_number, ii.description_1, ii.quantity_issued, ii.uom
       FROM material_issues i
       JOIN projects p ON p.id = i.project_id
       JOIN users sk ON sk.id = i.storekeeper_id
       LEFT JOIN users rc ON rc.id = i.receiver_id
       JOIN issue_items ii ON ii.issue_id = i.id
       LEFT JOIN material_requests mr ON mr.id = i.request_id
       ${wc} ORDER BY i.issue_date DESC`, params
    );

    if (format === 'pdf') {
      const dateRange = (date_from || date_to) ? `Period: ${date_from || '—'} to ${date_to || '—'}` : `Date: ${TODAY()}`;
      return sendPdf(res, `issues-export-${TODAY()}.pdf`, doc => {
        pdfHeader(doc, 'MATERIAL ISSUES REPORT', null, dateRange);

        const cols = { no: 40, dn: 65, proj: 160, date: 295, sk: 365, recv: 465, item: 555, desc: 610, qty: 720, uom: 755 };
        doc.fontSize(7).font('Helvetica-Bold');
        const th = doc.y;
        doc.text('#',           cols.no,   th);
        doc.text('DN#',         cols.dn,   th);
        doc.text('Project',     cols.proj, th);
        doc.text('Date',        cols.date, th);
        doc.text('Storekeeper', cols.sk,   th);
        doc.text('Receiver',    cols.recv, th);
        doc.text('Item',        cols.item, th);
        doc.text('Qty',         cols.qty,  th);
        doc.text('UOM',         cols.uom,  th);
        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
        doc.moveDown(0.2);

        doc.font('Helvetica').fontSize(7);
        rows.forEach((r, i) => {
          if (doc.y > 520) { doc.addPage({ layout: 'landscape' }); doc.y = 40; }
          const ry = doc.y;
          doc.text(String(i + 1),                  cols.no,   ry);
          doc.text(r.delivery_note_id || '—',       cols.dn,   ry, { width: 90 });
          doc.text(r.project || '—',                cols.proj, ry, { width: 125 });
          doc.text(String(r.issue_date).slice(0,10),cols.date, ry);
          doc.text(r.storekeeper || '—',            cols.sk,   ry, { width: 90 });
          doc.text(r.receiver || '—',               cols.recv, ry, { width: 80 });
          doc.text(r.item_number || '—',            cols.item, ry, { width: 50 });
          doc.text(String(r.quantity_issued ?? 0),  cols.qty,  ry);
          doc.text(r.uom || '—',                    cols.uom,  ry);
          doc.moveDown(0.65);
        });

        doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
        doc.moveDown(0.4);
        doc.font('Helvetica').fontSize(8).text(`Total Records: ${rows.length}  |  Generated: ${new Date().toLocaleString()}`, 40);
      });
    }

    // Default: Excel
    sendExcel(res, `issues-export-${TODAY()}.xlsx`, [{
      name: 'Issues',
      data: rows.map(r => ({
        'Delivery Note':  r.delivery_note_id,
        'Request Ref':    r.request_number || '',
        'Project':        r.project,
        'Issue Date':     r.issue_date,
        'Storekeeper':    r.storekeeper,
        'Receiver':       r.receiver,
        'Item Number':    r.item_number,
        'Description':    r.description_1,
        'Qty Issued':     Number(r.quantity_issued),
        'UOM':            r.uom,
      })),
    }]);
  } catch (err) { next(err); }
};

// ─── project detail (issued / returned / pending per item) ───────────────────

exports.projectDetail = async (req, res, next) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    // Per-item issued quantities for this project
    const { rows: issuedRows } = await db.query(
      `SELECT ii.stock_item_id, ii.item_number, ii.description_1, ii.description_2, ii.uom,
              SUM(ii.quantity_issued) AS qty_issued
       FROM issue_items ii
       JOIN material_issues mi ON mi.id = ii.issue_id
       WHERE mi.project_id = $1
       GROUP BY ii.stock_item_id, ii.item_number, ii.description_1, ii.description_2, ii.uom
       ORDER BY ii.description_1`,
      [project_id]
    );

    // Per-item returned quantities for this project
    const { rows: returnedRows } = await db.query(
      `SELECT ii.stock_item_id, SUM(r.quantity_returned) AS qty_returned
       FROM material_returns r
       JOIN issue_items ii ON ii.id = r.issue_item_id
       WHERE r.project_id = $1
       GROUP BY ii.stock_item_id`,
      [project_id]
    );

    const returnedMap = Object.fromEntries(
      returnedRows.map(r => [r.stock_item_id, parseFloat(r.qty_returned)])
    );

    const items = issuedRows.map(row => {
      const issued = parseFloat(row.qty_issued);
      const returned = returnedMap[row.stock_item_id] ?? 0;
      const pending = Math.max(0, issued - returned);
      return { ...row, qty_issued: issued, qty_returned: returned, qty_pending: pending };
    });

    res.json(items);
  } catch (err) { next(err); }
};

// ─── KPIs dashboard ──────────────────────────────────────────────────────────

exports.kpis = async (req, res, next) => {
  try {
    const [pending, issuedMonth, lowStock, topItems, recentRequests] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM material_requests WHERE status = 'pending'`),
      db.query(`SELECT COALESCE(SUM(ii.quantity_issued), 0) as total
                FROM issue_items ii
                JOIN material_issues i ON i.id = ii.issue_id
                WHERE date_trunc('month', i.issue_date) = date_trunc('month', NOW())`),
      db.query(`SELECT COUNT(*) FROM stock_items WHERE reorder_point > 0 AND qty_on_hand <= reorder_point`),
      db.query(`SELECT ii.description_1, SUM(ii.quantity_issued) as total
                FROM issue_items ii
                GROUP BY ii.description_1
                ORDER BY total DESC
                LIMIT 5`),
      db.query(`SELECT COUNT(*) FROM material_requests
                WHERE created_at >= NOW() - INTERVAL '7 days'`),
    ]);

    res.json({
      pending_requests: parseInt(pending.rows[0].count),
      issued_this_month: parseFloat(issuedMonth.rows[0].total),
      low_stock_count: parseInt(lowStock.rows[0].count),
      top_items: topItems.rows,
      requests_last_7_days: parseInt(recentRequests.rows[0].count),
    });
  } catch (err) { next(err); }
};
