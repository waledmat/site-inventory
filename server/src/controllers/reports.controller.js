const db = require('../config/db');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const dailyReportService = require('../services/dailyReport.service');

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
      `SELECT p.name as project_name,
              COUNT(i.id) as issue_count,
              SUM(ii.quantity_issued) as total_qty,
              SUM(ii.quantity_issued * COALESCE(s.unit_cost, 0)) as issued_value
       FROM material_issues i
       JOIN projects p ON p.id = i.project_id
       JOIN issue_items ii ON ii.issue_id = i.id
       LEFT JOIN stock_items s ON s.id = ii.stock_item_id
       ${wc} GROUP BY p.name ORDER BY p.name`, params
    );
    // Build a separate where clause for returns (using return_date instead of issue_date)
    let rwhere = [], rparams = [];
    if (project_id) { rparams.push(project_id); rwhere.push(`r.project_id = $${rparams.length}`); }
    if (date_from)  { rparams.push(date_from);  rwhere.push(`r.return_date >= $${rparams.length}`); }
    if (date_to)    { rparams.push(date_to);    rwhere.push(`r.return_date <= $${rparams.length}`); }
    const rwc = rwhere.length ? 'WHERE ' + rwhere.join(' AND ') : '';

    const returned = await db.query(
      `SELECT p.name as project_name,
              SUM(r.quantity_returned) as total_returned,
              SUM(r.quantity_returned * COALESCE(s.unit_cost, 0)) as returned_value
       FROM material_returns r
       JOIN projects p ON p.id = r.project_id
       LEFT JOIN issue_items ii ON ii.id = r.issue_item_id
       LEFT JOIN stock_items s ON s.id = ii.stock_item_id
       ${rwc} GROUP BY p.name`, rparams
    );

    const issuedRows  = issued.rows;
    const returnedMap = Object.fromEntries(returned.rows.map(r => [r.project_name, { qty: r.total_returned, value: r.returned_value }]));
    const dateRange   = (date_from || date_to) ? `Period: ${date_from || '—'} to ${date_to || '—'}` : `Date: ${TODAY()}`;

    const fmt2 = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totals = issuedRows.reduce((acc, r) => {
      const retData = returnedMap[r.project_name] || { qty: 0, value: 0 };
      acc.issues       += Number(r.issue_count);
      acc.qty          += Number(r.total_qty);
      acc.issuedValue  += Number(r.issued_value || 0);
      acc.retQty       += Number(retData.qty || 0);
      acc.retValue     += Number(retData.value || 0);
      return acc;
    }, { issues: 0, qty: 0, issuedValue: 0, retQty: 0, retValue: 0 });

    if (format === 'excel') {
      const data = issuedRows.map(r => {
        const retData = returnedMap[r.project_name] || { qty: 0, value: 0 };
        return {
          'Project':          r.project_name,
          'Total Issues':     Number(r.issue_count),
          'Total Qty Issued': Number(r.total_qty),
          'Issued Value':     Number(r.issued_value || 0),
          'Total Returned':   Number(retData.qty || 0),
          'Returned Value':   Number(retData.value || 0),
          'Net Outstanding':  Number(r.total_qty) - Number(retData.qty || 0),
          'Outstanding Value': Number(r.issued_value || 0) - Number(retData.value || 0),
        };
      });
      data.push({
        'Project': 'GRAND TOTAL',
        'Total Issues': totals.issues,
        'Total Qty Issued': totals.qty,
        'Issued Value': totals.issuedValue,
        'Total Returned': totals.retQty,
        'Returned Value': totals.retValue,
        'Net Outstanding': totals.qty - totals.retQty,
        'Outstanding Value': totals.issuedValue - totals.retValue,
      });
      return sendExcel(res, `summary-${TODAY()}.xlsx`, [{ name: 'Summary', data }]);
    }

    if (format === 'pdf') {
      return sendPdf(res, `summary-${TODAY()}.pdf`, doc => {
        pdfHeader(doc, 'MATERIAL SUMMARY REPORT', null, dateRange);

        const cols = { no: 40, proj: 60, issues: 240, qty: 295, issVal: 365, ret: 445, retVal: 500, out: 580, outVal: 650 };
        doc.fontSize(8).font('Helvetica-Bold');
        const th = doc.y;
        doc.text('#',            cols.no,     th);
        doc.text('Project',      cols.proj,   th);
        doc.text('Issues',       cols.issues, th);
        doc.text('Qty Iss.',     cols.qty,    th);
        doc.text('Issued $',     cols.issVal, th);
        doc.text('Returned',     cols.ret,    th);
        doc.text('Return $',     cols.retVal, th);
        doc.text('Outstand.',    cols.out,    th);
        doc.text('Outst. $',     cols.outVal, th);
        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
        doc.moveDown(0.2);

        doc.font('Helvetica').fontSize(8);
        issuedRows.forEach((r, i) => {
          const retData = returnedMap[r.project_name] || { qty: 0, value: 0 };
          const retQ    = Number(retData.qty || 0);
          const retV    = Number(retData.value || 0);
          const issV    = Number(r.issued_value || 0);
          const outQ    = Number(r.total_qty) - retQ;
          const outV    = issV - retV;
          const ry = doc.y;
          doc.text(String(i + 1),            cols.no,     ry);
          doc.text(r.project_name,           cols.proj,   ry, { width: 175 });
          doc.text(String(r.issue_count),    cols.issues, ry);
          doc.text(String(r.total_qty),      cols.qty,    ry);
          doc.text(fmt2(issV),               cols.issVal, ry);
          doc.text(String(retQ),             cols.ret,    ry);
          doc.text(fmt2(retV),               cols.retVal, ry);
          doc.text(outQ.toFixed(3),          cols.out,    ry);
          doc.text(fmt2(outV),               cols.outVal, ry);
          doc.moveDown(0.7);
        });

        doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').fontSize(9);
        const ty = doc.y;
        doc.text('GRAND TOTAL',                 cols.proj,   ty);
        doc.text(String(totals.issues),         cols.issues, ty);
        doc.text(totals.qty.toFixed(3),         cols.qty,    ty);
        doc.text(fmt2(totals.issuedValue),      cols.issVal, ty);
        doc.text(totals.retQty.toFixed(3),      cols.ret,    ty);
        doc.text(fmt2(totals.retValue),         cols.retVal, ty);
        doc.text((totals.qty - totals.retQty).toFixed(3),     cols.out,    ty);
        doc.text(fmt2(totals.issuedValue - totals.retValue), cols.outVal, ty);
        doc.moveDown(1);
        doc.font('Helvetica').fontSize(8).text(`Generated: ${new Date().toLocaleString()}`, 40);
      });
    }

    res.json({ issued: issuedRows, returned: returned.rows, totals });
  } catch (err) { next(err); }
};

// ─── daily log ───────────────────────────────────────────────────────────────

exports.dailyLog = async (req, res, next) => {
  try {
    const { format, project_id, date_from, date_to } = req.query;

    // Compute per-(project, date) activity on the fly so the page reflects
    // today's issues/returns even if the cron hasn't fired yet. LEFT JOIN
    // daily_reports for the persisted sent_at when an email actually went out.
    // $1 = project_id (or NULL), $2 = date_from (or NULL), $3 = date_to (or NULL)
    const params = [project_id || null, date_from || null, date_to || null];

    const { rows } = await db.query(
      `WITH activity AS (
         SELECT mi.project_id, mi.issue_date AS report_date,
                COUNT(*)::int AS issued_count, 0 AS returned_count
         FROM material_issues mi
         WHERE ($1::uuid IS NULL OR mi.project_id  = $1::uuid)
           AND ($2::date IS NULL OR mi.issue_date >= $2::date)
           AND ($3::date IS NULL OR mi.issue_date <= $3::date)
         GROUP BY mi.project_id, mi.issue_date
         UNION ALL
         SELECT mr.project_id, mr.return_date AS report_date,
                0 AS issued_count, COUNT(*)::int AS returned_count
         FROM material_returns mr
         WHERE ($1::uuid IS NULL OR mr.project_id   = $1::uuid)
           AND ($2::date IS NULL OR mr.return_date >= $2::date)
           AND ($3::date IS NULL OR mr.return_date <= $3::date)
         GROUP BY mr.project_id, mr.return_date
       ),
       daily AS (
         SELECT project_id, report_date,
                SUM(issued_count)::int   AS issued_count,
                SUM(returned_count)::int AS returned_count
         FROM activity
         GROUP BY project_id, report_date
       ),
       pending AS (
         SELECT i.project_id, COUNT(*)::int AS pending_count
         FROM issue_items ii
         JOIN material_issues i ON i.id = ii.issue_id
         WHERE ii.quantity_issued > COALESCE(
           (SELECT SUM(r.quantity_returned) FROM material_returns r WHERE r.issue_item_id = ii.id), 0)
         GROUP BY i.project_id
       )
       SELECT d.report_date,
              p.name AS project_name,
              d.issued_count,
              d.returned_count,
              COALESCE(pe.pending_count, 0) AS pending_count,
              0 AS overdue_count,
              dr.sent_at
       FROM daily d
       LEFT JOIN projects p       ON p.id = d.project_id
       LEFT JOIN pending pe       ON pe.project_id = d.project_id
       LEFT JOIN daily_reports dr ON dr.project_id = d.project_id AND dr.report_date = d.report_date
       ORDER BY d.report_date DESC, p.name
       LIMIT 200`,
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

// Manually trigger the daily-report job for today (or a chosen date) and
// optionally email the recipients. Used by the "Run Now" button on the
// Daily Report Log page so users don't have to wait for the cron.
exports.runDailyReport = async (req, res, next) => {
  try {
    const date = (req.body?.date || req.query.date || TODAY()).slice(0, 10);
    const sendEmail = req.body?.send_email === true || req.query.send_email === 'true';
    const summary = await dailyReportService.generate({ date, sendEmail });
    res.json(summary);
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
              qty_on_hand, qty_issued, qty_pending_return, container_no, y3_number,
              COALESCE(unit_cost, 0) AS unit_cost,
              (qty_on_hand * COALESCE(unit_cost, 0)) AS total_value
       FROM stock_items ${wc} ORDER BY item_number`, params
    );

    let projectName = 'All Projects';
    if (project_id) {
      const pr = await db.query('SELECT name FROM projects WHERE id = $1', [project_id]);
      if (pr.rows[0]) projectName = pr.rows[0].name;
    }

    const grandTotal = rows.reduce((s, r) => s + Number(r.total_value || 0), 0);

    if (format === 'excel') {
      const data = rows.map(r => ({
        'Item Number':    r.item_number || '',
        'Description':    r.description_1 || '',
        'Description 2':  r.description_2 || '',
        'Category':       r.category || '',
        'UOM':            r.uom || '',
        'On Hand':        Number(r.qty_on_hand ?? 0),
        'Unit Cost':      Number(r.unit_cost ?? 0),
        'Total Value':    Number(r.total_value ?? 0),
        'Issued':         Number(r.qty_issued ?? 0),
        'Pending Return': Number(r.qty_pending_return ?? 0),
        'Container No':   r.container_no || '',
        'Y3 Number':      r.y3_number || '',
      }));
      // Grand total footer row
      data.push({
        'Item Number': '', 'Description': 'GRAND TOTAL', 'Description 2': '',
        'Category': '', 'UOM': '', 'On Hand': '', 'Unit Cost': '',
        'Total Value': grandTotal,
        'Issued': '', 'Pending Return': '', 'Container No': '', 'Y3 Number': '',
      });
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

    const cols = { no: 40, itemNo: 60, desc: 150, cat: 305, uom: 340, onHand: 380, unitCost: 430, totalVal: 490, issued: 565, pending: 615, container: 670 };
    const fmt2 = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.fontSize(8).font('Helvetica-Bold');
    const th = doc.y;
    doc.text('#',            cols.no,        th);
    doc.text('Item No.',     cols.itemNo,    th);
    doc.text('Description',  cols.desc,      th);
    doc.text('Cat',          cols.cat,       th);
    doc.text('UOM',          cols.uom,       th);
    doc.text('On Hand',      cols.onHand,    th);
    doc.text('Unit Cost',    cols.unitCost,  th);
    doc.text('Total Value',  cols.totalVal,  th);
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
      doc.text((item.description_1 || '') + (item.description_2 ? ` / ${item.description_2}` : ''), cols.desc, ry, { width: 145 });
      doc.text(item.category || '—',                                              cols.cat,       ry);
      doc.text(item.uom || '—',                                                   cols.uom,       ry);
      doc.text(String(item.qty_on_hand ?? 0),                                     cols.onHand,    ry);
      doc.text(fmt2(item.unit_cost),                                              cols.unitCost,  ry);
      doc.text(fmt2(item.total_value),                                            cols.totalVal,  ry);
      doc.text(String(item.qty_issued ?? 0),                                      cols.issued,    ry);
      doc.text(String(item.qty_pending_return ?? 0),                              cols.pending,   ry);
      doc.text(item.container_no || '—',                                          cols.container, ry, { width: 100 });
      doc.moveDown(0.7);
    });

    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9);
    const ty = doc.y;
    doc.text('GRAND TOTAL', cols.desc, ty);
    doc.text(fmt2(grandTotal), cols.totalVal, ty);
    doc.moveDown(0.8);
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
              ii.item_number, ii.description_1, ii.quantity_issued, ii.uom,
              COALESCE(s.unit_cost, 0) AS unit_cost,
              (ii.quantity_issued * COALESCE(s.unit_cost, 0)) AS total_value
       FROM material_issues i
       JOIN projects p ON p.id = i.project_id
       JOIN users sk ON sk.id = i.storekeeper_id
       LEFT JOIN users rc ON rc.id = i.receiver_id
       JOIN issue_items ii ON ii.issue_id = i.id
       LEFT JOIN stock_items s ON s.id = ii.stock_item_id
       LEFT JOIN material_requests mr ON mr.id = i.request_id
       ${wc} ORDER BY i.issue_date DESC`, params
    );

    const fmt2 = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const grandTotal = rows.reduce((s, r) => s + Number(r.total_value || 0), 0);

    if (format === 'pdf') {
      const dateRange = (date_from || date_to) ? `Period: ${date_from || '—'} to ${date_to || '—'}` : `Date: ${TODAY()}`;
      return sendPdf(res, `issues-export-${TODAY()}.pdf`, doc => {
        pdfHeader(doc, 'MATERIAL ISSUES REPORT', null, dateRange);

        const cols = { no: 40, dn: 65, proj: 145, date: 250, sk: 310, recv: 395, item: 475, qty: 540, uom: 575, unitCost: 615, totalVal: 680 };
        doc.fontSize(7).font('Helvetica-Bold');
        const th = doc.y;
        doc.text('#',           cols.no,       th);
        doc.text('DN#',         cols.dn,       th);
        doc.text('Project',     cols.proj,     th);
        doc.text('Date',        cols.date,     th);
        doc.text('Storekeeper', cols.sk,       th);
        doc.text('Receiver',    cols.recv,     th);
        doc.text('Item',        cols.item,     th);
        doc.text('Qty',         cols.qty,      th);
        doc.text('UOM',         cols.uom,      th);
        doc.text('Unit Cost',   cols.unitCost, th);
        doc.text('Total',       cols.totalVal, th);
        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
        doc.moveDown(0.2);

        doc.font('Helvetica').fontSize(7);
        rows.forEach((r, i) => {
          if (doc.y > 520) { doc.addPage({ layout: 'landscape' }); doc.y = 40; }
          const ry = doc.y;
          doc.text(String(i + 1),                   cols.no,       ry);
          doc.text(r.delivery_note_id || '—',        cols.dn,       ry, { width: 75 });
          doc.text(r.project || '—',                 cols.proj,     ry, { width: 100 });
          doc.text(String(r.issue_date).slice(0,10), cols.date,     ry);
          doc.text(r.storekeeper || '—',             cols.sk,       ry, { width: 80 });
          doc.text(r.receiver || '—',                cols.recv,     ry, { width: 75 });
          doc.text(r.item_number || '—',             cols.item,     ry, { width: 60 });
          doc.text(String(r.quantity_issued ?? 0),   cols.qty,      ry);
          doc.text(r.uom || '—',                     cols.uom,      ry);
          doc.text(fmt2(r.unit_cost),                cols.unitCost, ry);
          doc.text(fmt2(r.total_value),              cols.totalVal, ry);
          doc.moveDown(0.65);
        });

        doc.moveTo(40, doc.y).lineTo(801, doc.y).stroke();
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').fontSize(8);
        const ty = doc.y;
        doc.text('GRAND TOTAL',     cols.item,     ty);
        doc.text(fmt2(grandTotal),  cols.totalVal, ty);
        doc.moveDown(0.6);
        doc.font('Helvetica').fontSize(8).text(`Total Records: ${rows.length}  |  Generated: ${new Date().toLocaleString()}`, 40);
      });
    }

    // Default: Excel
    const excelData = rows.map(r => ({
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
      'Unit Cost':      Number(r.unit_cost || 0),
      'Total Value':    Number(r.total_value || 0),
    }));
    excelData.push({
      'Delivery Note': '', 'Request Ref': '', 'Project': '', 'Issue Date': '',
      'Storekeeper': '', 'Receiver': '', 'Item Number': '', 'Description': 'GRAND TOTAL',
      'Qty Issued': '', 'UOM': '', 'Unit Cost': '', 'Total Value': grandTotal,
    });
    sendExcel(res, `issues-export-${TODAY()}.xlsx`, [{ name: 'Issues', data: excelData }]);
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
              COALESCE(s.unit_cost, 0) AS unit_cost,
              SUM(ii.quantity_issued) AS qty_issued
       FROM issue_items ii
       JOIN material_issues mi ON mi.id = ii.issue_id
       LEFT JOIN stock_items s ON s.id = ii.stock_item_id
       WHERE mi.project_id = $1
       GROUP BY ii.stock_item_id, ii.item_number, ii.description_1, ii.description_2, ii.uom, s.unit_cost
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
      const unitCost = parseFloat(row.unit_cost) || 0;
      return {
        ...row,
        qty_issued:     issued,
        qty_returned:   returned,
        qty_pending:    pending,
        unit_cost:      unitCost,
        issued_value:   issued * unitCost,
        returned_value: returned * unitCost,
        pending_value:  pending * unitCost,
      };
    });

    res.json(items);
  } catch (err) { next(err); }
};

// ─── consumption report (issued × unit_cost, consumables + spare parts only) ─

exports.consumption = async (req, res, next) => {
  try {
    const { project_id, date_from, date_to, format } = req.query;

    // Categories that count as actual consumption — exclude CH (chargeable)
    const categories = ['DC', 'SPARE'];

    let where = [`s.category = ANY($1)`];
    const params = [categories];

    if (project_id) { params.push(project_id); where.push(`mi.project_id = $${params.length}`); }
    if (date_from)  { params.push(date_from);  where.push(`mi.issue_date >= $${params.length}`); }
    if (date_to)    { params.push(date_to);    where.push(`mi.issue_date <= $${params.length}`); }

    const { rows } = await db.query(
      `SELECT s.id              AS stock_item_id,
              s.item_number,
              s.description_1,
              s.description_2,
              s.uom,
              s.category,
              p.id              AS project_id,
              p.name            AS project_name,
              s.unit_cost,
              SUM(ii.quantity_issued)                    AS qty_issued,
              SUM(ii.quantity_issued * s.unit_cost)      AS total_value
         FROM issue_items ii
         JOIN material_issues mi  ON mi.id = ii.issue_id
         JOIN stock_items s       ON s.id = ii.stock_item_id
         JOIN projects p          ON p.id = mi.project_id
        WHERE ${where.join(' AND ')}
        GROUP BY s.id, s.item_number, s.description_1, s.description_2, s.uom, s.category,
                 p.id, p.name, s.unit_cost
        ORDER BY total_value DESC NULLS LAST`,
      params
    );

    const items = rows.map(r => ({
      stock_item_id: r.stock_item_id,
      project_id:    r.project_id,
      project_name:  r.project_name,
      item_number:   r.item_number,
      description_1: r.description_1,
      description_2: r.description_2,
      uom:           r.uom,
      category:      r.category,
      qty_issued:    Number(r.qty_issued),
      unit_cost:     Number(r.unit_cost),
      total_value:   Number(r.total_value),
    }));

    const totals = {
      qty_issued:  items.reduce((s, r) => s + r.qty_issued,  0),
      total_value: items.reduce((s, r) => s + r.total_value, 0),
      by_category: {
        DC:    { qty: 0, value: 0 },
        SPARE: { qty: 0, value: 0 },
      },
    };
    items.forEach(r => {
      if (totals.by_category[r.category]) {
        totals.by_category[r.category].qty   += r.qty_issued;
        totals.by_category[r.category].value += r.total_value;
      }
    });

    if (format === 'excel') {
      const data = items.map(r => ({
        'Project':      r.project_name,
        'Category':     r.category,
        'Item No.':     r.item_number || '',
        'Description':  r.description_1,
        'UOM':          r.uom,
        'Qty Issued':   r.qty_issued,
        'Unit Cost':    r.unit_cost,
        'Total Value':  r.total_value,
      }));
      return sendExcel(res, `consumption-${TODAY()}.xlsx`, [{ name: 'Consumption', data }]);
    }

    res.json({ items, totals, categories });
  } catch (err) { next(err); }
};

// ─── project cost report (issued / returned / pending × cost, all categories) ──
//
// "Pending" = issued − returned (clamped at 0). For DC/SPARE this is the project
// material spend (consumed); for CH (chargeable assets) it's items still owed
// back to the warehouse. Same calculation, different business meaning.
exports.projectCost = async (req, res, next) => {
  try {
    const { project_id, date_from, date_to, format, view } = req.query;
    const params = [project_id || null, date_from || null, date_to || null];

    // Per-issue / per-return transaction export — one row per issue_item or per return.
    if (format === 'excel-transactions') {
      const { rows: issues } = await db.query(
        `SELECT p.name           AS project_name,
                mi.issue_date,
                mi.delivery_note_id,
                ii.item_number,
                COALESCE(s.description_1, ii.description_1) AS description_1,
                COALESCE(s.description_2, ii.description_2) AS description_2,
                s.category,
                ii.uom,
                COALESCE(s.unit_cost, 0)                  AS unit_cost,
                ii.quantity_issued,
                (ii.quantity_issued * COALESCE(s.unit_cost, 0)) AS issued_value,
                s.y3_number,
                s.container_no,
                sk.name           AS storekeeper,
                rcv.name          AS receiver,
                req.name          AS requester
         FROM material_issues mi
         JOIN projects   p   ON p.id = mi.project_id
         JOIN issue_items ii ON ii.issue_id = mi.id
         LEFT JOIN stock_items s ON s.id = ii.stock_item_id
         LEFT JOIN users sk  ON sk.id = mi.storekeeper_id
         LEFT JOIN users rcv ON rcv.id = mi.receiver_id
         LEFT JOIN material_requests mr ON mr.id = mi.request_id
         LEFT JOIN users req ON req.id = mr.requester_id
         WHERE ($1::uuid IS NULL OR mi.project_id  = $1::uuid)
           AND ($2::date IS NULL OR mi.issue_date >= $2::date)
           AND ($3::date IS NULL OR mi.issue_date <= $3::date)
         ORDER BY mi.issue_date DESC, p.name, ii.item_number`,
        params
      );

      const { rows: returns } = await db.query(
        `SELECT p.name           AS project_name,
                r.return_date,
                ii.item_number,
                COALESCE(s.description_1, ii.description_1) AS description_1,
                s.category,
                ii.uom,
                COALESCE(s.unit_cost, 0)                  AS unit_cost,
                r.quantity_returned,
                (r.quantity_returned * COALESCE(s.unit_cost, 0)) AS returned_value,
                r.condition,
                r.notes,
                lb.name           AS logged_by,
                mi.delivery_note_id
         FROM material_returns r
         JOIN projects p   ON p.id = r.project_id
         JOIN issue_items ii ON ii.id = r.issue_item_id
         JOIN material_issues mi ON mi.id = ii.issue_id
         LEFT JOIN stock_items s ON s.id = ii.stock_item_id
         LEFT JOIN users lb ON lb.id = r.logged_by
         WHERE ($1::uuid IS NULL OR r.project_id   = $1::uuid)
           AND ($2::date IS NULL OR r.return_date >= $2::date)
           AND ($3::date IS NULL OR r.return_date <= $3::date)
         ORDER BY r.return_date DESC, p.name, ii.item_number`,
        params
      );

      const num = (n) => Number((Number(n) || 0).toFixed(2));

      const issueSheet = issues.map(r => ({
        'Project':          r.project_name,
        'Issue Date':       r.issue_date,
        'Delivery Note':    r.delivery_note_id || '',
        'Category':         r.category || '',
        'Item No.':         r.item_number || '',
        'Description':      r.description_1 || '',
        'Description 2':    r.description_2 || '',
        'UOM':              r.uom || '',
        'Y3#':              r.y3_number || '',
        'Container':        r.container_no || '',
        'Unit Cost':        num(r.unit_cost),
        'Qty Issued':       Number(r.quantity_issued),
        'Issued Value':     num(r.issued_value),
        'Storekeeper':      r.storekeeper || '',
        'Receiver':         r.receiver || '',
        'Requester':        r.requester || '',
      }));

      const returnSheet = returns.map(r => ({
        'Project':          r.project_name,
        'Return Date':      r.return_date,
        'Delivery Note':    r.delivery_note_id || '',
        'Category':         r.category || '',
        'Item No.':         r.item_number || '',
        'Description':      r.description_1 || '',
        'UOM':              r.uom || '',
        'Unit Cost':        num(r.unit_cost),
        'Qty Returned':     Number(r.quantity_returned),
        'Returned Value':   num(r.returned_value),
        'Condition':        r.condition || '',
        'Notes':            r.notes || '',
        'Logged By':        r.logged_by || '',
      }));

      return sendExcel(res, `project-cost-transactions-${TODAY()}.xlsx`, [
        { name: 'Issues',  data: issueSheet },
        { name: 'Returns', data: returnSheet },
      ]);
    }

    // Per-item rollup: issued and returned aggregated by (project, category, stock_item)
    const { rows: items } = await db.query(
      `WITH issued AS (
         SELECT mi.project_id, ii.stock_item_id,
                SUM(ii.quantity_issued)                            AS qty,
                SUM(ii.quantity_issued * COALESCE(s.unit_cost, 0)) AS value
         FROM material_issues mi
         JOIN issue_items ii ON ii.issue_id = mi.id
         LEFT JOIN stock_items s ON s.id = ii.stock_item_id
         WHERE ($1::uuid IS NULL OR mi.project_id  = $1::uuid)
           AND ($2::date IS NULL OR mi.issue_date >= $2::date)
           AND ($3::date IS NULL OR mi.issue_date <= $3::date)
         GROUP BY mi.project_id, ii.stock_item_id
       ),
       returned AS (
         SELECT mr.project_id, ii.stock_item_id,
                SUM(mr.quantity_returned)                            AS qty,
                SUM(mr.quantity_returned * COALESCE(s.unit_cost, 0)) AS value
         FROM material_returns mr
         JOIN issue_items ii ON ii.id = mr.issue_item_id
         LEFT JOIN stock_items s ON s.id = ii.stock_item_id
         WHERE ($1::uuid IS NULL OR mr.project_id   = $1::uuid)
           AND ($2::date IS NULL OR mr.return_date >= $2::date)
           AND ($3::date IS NULL OR mr.return_date <= $3::date)
         GROUP BY mr.project_id, ii.stock_item_id
       )
       SELECT p.id           AS project_id,
              p.name         AS project_name,
              s.id           AS stock_item_id,
              s.item_number,
              s.description_1,
              s.description_2,
              s.uom,
              s.category,
              COALESCE(s.unit_cost, 0) AS unit_cost,
              COALESCE(i.qty,   0) AS qty_issued,
              COALESCE(i.value, 0) AS value_issued,
              COALESCE(r.qty,   0) AS qty_returned,
              COALESCE(r.value, 0) AS value_returned
       FROM (SELECT project_id, stock_item_id FROM issued
             UNION
             SELECT project_id, stock_item_id FROM returned) k
       JOIN projects    p ON p.id = k.project_id
       LEFT JOIN stock_items s ON s.id = k.stock_item_id
       LEFT JOIN issued   i ON i.project_id = k.project_id AND i.stock_item_id IS NOT DISTINCT FROM k.stock_item_id
       LEFT JOIN returned r ON r.project_id = k.project_id AND r.stock_item_id IS NOT DISTINCT FROM k.stock_item_id
       WHERE s.category IS NOT NULL
       ORDER BY p.name, s.category, s.item_number`,
      params
    );

    const emptyCat = () => ({
      qty_issued: 0, value_issued: 0,
      qty_returned: 0, value_returned: 0,
      qty_pending: 0, value_pending: 0,
    });

    const projectsMap = new Map();
    const grand = emptyCat();

    for (const row of items) {
      const qIss = Number(row.qty_issued)   || 0;
      const vIss = Number(row.value_issued) || 0;
      const qRet = Number(row.qty_returned) || 0;
      const vRet = Number(row.value_returned) || 0;
      // Only Chargeable (CH) items are owed back to the warehouse.
      // For DC and SPARE the difference is "consumed in project", not pending — so we don't count it as pending.
      const isPending = row.category === 'CH';
      const qPen = isPending ? Math.max(0, qIss - qRet) : 0;
      const vPen = isPending ? Math.max(0, vIss - vRet) : 0;

      let proj = projectsMap.get(row.project_id);
      if (!proj) {
        proj = {
          project_id: row.project_id,
          project_name: row.project_name,
          categories: { SPARE: emptyCat(), DC: emptyCat(), CH: emptyCat() },
          items: [],
          totals: emptyCat(),
        };
        projectsMap.set(row.project_id, proj);
      }

      proj.items.push({
        stock_item_id: row.stock_item_id,
        item_number:   row.item_number,
        description_1: row.description_1,
        description_2: row.description_2,
        uom:           row.uom,
        category:      row.category,
        unit_cost:     Number(row.unit_cost) || 0,
        qty_issued:    qIss, value_issued:   vIss,
        qty_returned:  qRet, value_returned: vRet,
        qty_pending:   qPen, value_pending:  vPen,
      });

      const c = proj.categories[row.category] || emptyCat();
      c.qty_issued    += qIss; c.value_issued    += vIss;
      c.qty_returned  += qRet; c.value_returned  += vRet;
      c.qty_pending   += qPen; c.value_pending   += vPen;
      proj.categories[row.category] = c;

      proj.totals.qty_issued    += qIss; proj.totals.value_issued    += vIss;
      proj.totals.qty_returned  += qRet; proj.totals.value_returned  += vRet;
      proj.totals.qty_pending   += qPen; proj.totals.value_pending   += vPen;

      grand.qty_issued    += qIss; grand.value_issued    += vIss;
      grand.qty_returned  += qRet; grand.value_returned  += vRet;
      grand.qty_pending   += qPen; grand.value_pending   += vPen;
    }

    const by_project = Array.from(projectsMap.values());

    if (format === 'excel') {
      const summary = [];
      const detail = [];
      const num = (n) => Number((Number(n) || 0).toFixed(2));

      const penQty = (cat, q) => cat === 'CH' ? q : '';
      const penVal = (cat, v) => cat === 'CH' ? num(v) : '';

      for (const proj of by_project) {
        for (const cat of ['CH', 'SPARE', 'DC']) {
          const c = proj.categories[cat];
          if (!c || (c.qty_issued === 0 && c.qty_returned === 0)) continue;
          summary.push({
            'Project':        proj.project_name,
            'Category':       cat,
            'Qty Issued':     c.qty_issued,
            'Issued Value':   num(c.value_issued),
            'Qty Returned':   c.qty_returned,
            'Returned Value': num(c.value_returned),
            'Qty Pending':    penQty(cat, c.qty_pending),
            'Pending Value':  penVal(cat, c.value_pending),
          });
        }
        summary.push({
          'Project':        proj.project_name,
          'Category':       'TOTAL',
          'Qty Issued':     proj.totals.qty_issued,
          'Issued Value':   num(proj.totals.value_issued),
          'Qty Returned':   proj.totals.qty_returned,
          'Returned Value': num(proj.totals.value_returned),
          'Qty Pending':    proj.totals.qty_pending,
          'Pending Value':  num(proj.totals.value_pending),
        });

        for (const it of proj.items) {
          detail.push({
            'Project':        proj.project_name,
            'Item No.':       it.item_number || '',
            'Description':    it.description_1 || '',
            'Description 2':  it.description_2 || '',
            'Category':       it.category,
            'UOM':            it.uom || '',
            'Unit Cost':      num(it.unit_cost),
            'Qty Issued':     it.qty_issued,
            'Issued Value':   num(it.value_issued),
            'Qty Returned':   it.qty_returned,
            'Returned Value': num(it.value_returned),
            'Qty Pending':    penQty(it.category, it.qty_pending),
            'Pending Value':  penVal(it.category, it.value_pending),
          });
        }
      }

      summary.push({
        'Project':        'GRAND TOTAL',
        'Category':       '',
        'Qty Issued':     grand.qty_issued,
        'Issued Value':   num(grand.value_issued),
        'Qty Returned':   grand.qty_returned,
        'Returned Value': num(grand.value_returned),
        'Qty Pending':    grand.qty_pending,
        'Pending Value':  num(grand.value_pending),
      });

      const sheets = view === 'summary' ? [{ name: 'Summary', data: summary }]
                   : view === 'detail'  ? [{ name: 'Item Detail', data: detail }]
                   : [{ name: 'Summary', data: summary }, { name: 'Item Detail', data: detail }];
      const tag = view === 'summary' ? '-summary' : view === 'detail' ? '-detail' : '';
      return sendExcel(res, `project-cost${tag}-${TODAY()}.xlsx`, sheets);
    }

    res.json({ by_project, grand_total: grand });
  } catch (err) { next(err); }
};

// ─── cost summary (monetary value of stock / issued / returned / pending) ──

exports.costSummary = async (req, res, next) => {
  try {
    const { project_id } = req.query;

    // Optional role-based scoping for storekeepers
    let scopedIds = null;
    if (req.user.role === 'storekeeper') {
      const sk = await db.query('SELECT project_id FROM project_storekeepers WHERE user_id = $1', [req.user.id]);
      scopedIds = sk.rows.map(r => r.project_id);
      if (!scopedIds.length) {
        return res.json({ totals: { on_hand_value: 0, issued_value: 0, returned_value: 0, pending_return_value: 0, aging_value: 0 }, by_project: [] });
      }
    }

    let where = [], params = [];
    if (project_id) { params.push(project_id); where.push(`s.project_id = $${params.length}`); }
    if (scopedIds) { params.push(scopedIds); where.push(`s.project_id = ANY($${params.length})`); }
    const wc = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Per-project totals computed from stock_items (uses qty * unit_cost)
    const byProj = await db.query(
      `SELECT p.id as project_id, p.name as project_name,
              COALESCE(SUM(s.qty_on_hand        * s.unit_cost), 0) AS on_hand_value,
              COALESCE(SUM(s.qty_issued         * s.unit_cost), 0) AS issued_value,
              COALESCE(SUM(s.qty_returned       * s.unit_cost), 0) AS returned_value,
              COALESCE(SUM(s.qty_pending_return * s.unit_cost), 0) AS pending_return_value,
              COUNT(s.id) FILTER (WHERE s.unit_cost > 0) AS priced_items,
              COUNT(s.id) AS total_items
         FROM stock_items s
         JOIN projects p ON p.id = s.project_id
         ${wc}
        GROUP BY p.id, p.name
        ORDER BY on_hand_value DESC`,
      params
    );

    // Aging value: stock that has been sitting on-hand for > 90 days without movement (last update)
    const agingWhere = [...where, `s.qty_on_hand > 0`, `s.updated_at < NOW() - INTERVAL '90 days'`];
    const aging = await db.query(
      `SELECT COALESCE(SUM(s.qty_on_hand * s.unit_cost), 0) AS aging_value
         FROM stock_items s
        WHERE ${agingWhere.join(' AND ')}`,
      params
    );

    const totals = byProj.rows.reduce((acc, r) => ({
      on_hand_value:        acc.on_hand_value        + Number(r.on_hand_value),
      issued_value:         acc.issued_value         + Number(r.issued_value),
      returned_value:       acc.returned_value       + Number(r.returned_value),
      pending_return_value: acc.pending_return_value + Number(r.pending_return_value),
    }), { on_hand_value: 0, issued_value: 0, returned_value: 0, pending_return_value: 0 });

    totals.aging_value = Number(aging.rows[0]?.aging_value || 0);

    res.json({
      totals,
      by_project: byProj.rows.map(r => ({
        project_id:           r.project_id,
        project_name:         r.project_name,
        on_hand_value:        Number(r.on_hand_value),
        issued_value:         Number(r.issued_value),
        returned_value:       Number(r.returned_value),
        pending_return_value: Number(r.pending_return_value),
        priced_items:         Number(r.priced_items),
        total_items:          Number(r.total_items),
      })),
    });
  } catch (err) { next(err); }
};

// ─── KPIs dashboard ──────────────────────────────────────────────────────────

exports.kpis = async (req, res, next) => {
  try {
    const [pending, issuedMonth, lowStock, topItems, recentRequests, rejectionStats] = await Promise.all([
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
      db.query(`SELECT
                  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
                  COUNT(*) AS total
                FROM material_requests
                WHERE date_trunc('month', created_at) = date_trunc('month', NOW())`),
    ]);

    const rejected = parseInt(rejectionStats.rows[0].rejected);
    const totalMonth = parseInt(rejectionStats.rows[0].total);
    const rejection_rate = totalMonth > 0 ? Math.round((rejected / totalMonth) * 100) : 0;

    res.json({
      pending_requests: parseInt(pending.rows[0].count),
      issued_this_month: parseFloat(issuedMonth.rows[0].total),
      low_stock_count: parseInt(lowStock.rows[0].count),
      top_items: topItems.rows,
      requests_last_7_days: parseInt(recentRequests.rows[0].count),
      rejection_rate,
      rejected_this_month: rejected,
    });
  } catch (err) { next(err); }
};
