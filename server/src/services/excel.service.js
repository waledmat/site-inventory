const XLSX = require('xlsx');
const db = require('../config/db');

function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

const REQUIRED = ['ITEM NUMBER', 'ITEM DESCRIPTION', 'UOM', 'PROJECT NUMBER'];

exports.parsePackingList = async (buffer, overrideProjectId = null) => {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });

  const { rows: projects } = await db.query('SELECT id, name, project_number FROM projects WHERE is_active = true');
  const projectMap = {};
  projects.forEach(p => { projectMap[String(p.name).trim().toLowerCase()] = p.id; });

  const valid = [], errors = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const errs = [];

    const itemNo = row['ITEM NUMBER'] || row['Item Number'] || row['item_number'];
    const desc1 = row['ITEM DESCRIPTION'] || row['Item Description'] || row['description_1'];
    const desc2 = row['DESCRIPTION LINE 2'] || row['description_2'] || null;
    const uom = row['UOM'] || row['uom'];
    const projNum = String(row['PROJECT NUMBER'] || row['Project Number'] || '').trim();
    const projName = String(row['PROJECT NAME'] || row['Project Name'] || '').trim().toLowerCase();
    const wbs = row['Y3#'] || row['wbs'] || null;
    const category = row['CATEGORY'] || row['category'] || null;
    const qtyRequested = parseFloat(row['project requested'] || row['qty_requested'] || 0);
    const qtyOnHand = parseFloat(row['Project Onhand'] || row['project onhand'] || row['issed to project'] || row['issued to project'] || row['on hand'] || row['qty_on_hand'] || 0);
    const qtyPending = parseFloat(row['BALANCE'] || row['balance'] || 0);
    const containerNo = row['Container No.'] || row['CONT. #'] || row['container_no'] || null;
    const qtyIssued = parseFloat(row['Issued Quantity'] || row['issued qty'] || row['qty_issued'] || 0);
    const issuedById = row['ID issued by'] || row['issued by'] || row['issued_by_id'] || null;
    const receivedById = row['Received By'] || row['recved by'] || row['received_by_id'] || null;
    const qtyReturned = parseFloat(row['Returned Quantity'] || row['return qty'] || row['qty_returned'] || 0);
    const qtyPendingReturn = parseFloat(row['Pending Return QTY'] || row['pending rturn'] || row['pending return'] || row['qty_pending_return'] || 0);

    if (!desc1) errs.push('Item Description is required');
    if (!uom) errs.push('UOM is required');

    // Resolve project
    let project_id = overrideProjectId || null;
    if (project_id) {
      // project chosen by user — skip matching
    } else if (projectMap[projName]) {
      // 1. exact name match
      project_id = projectMap[projName];
    } else if (projNum) {
      // 2. exact project_number match
      const byNum = projects.find(p => p.project_number && String(p.project_number).trim().toLowerCase() === projNum.toLowerCase());
      if (byNum) project_id = byNum.id;
    }
    if (!project_id) {
      // 3. fuzzy name match (contains or close edit distance)
      const needle = projName || projNum.toLowerCase();
      const byFuzzy = projects.find(p => {
        const dbName = String(p.name).trim().toLowerCase();
        if (dbName.includes(needle) || needle.includes(dbName)) return true;
        const maxDist = Math.max(1, Math.floor(Math.max(dbName.length, needle.length) * 0.25));
        return editDistance(dbName, needle) <= maxDist;
      });
      if (byFuzzy) {
        project_id = byFuzzy.id;
      } else {
        const available = projects.map(p => `"${p.name.trim()}"${p.project_number ? ` (No: ${p.project_number})` : ''}`).join(', ');
        errs.push(`Project "${projName || projNum}" not found. Available: ${available}`);
      }
    }

    // Validate category
    let cat = null;
    if (category) {
      const c = String(category).toUpperCase();
      if (c.includes('CH')) cat = 'CH';
      else if (c.includes('DC') || c.includes('CONS')) cat = 'DC';
      else if (c.includes('SPARE') || c.includes('SP')) cat = 'SPARE';
      else cat = null;
    }

    const resolvedProject = projects.find(p => p.id === project_id);
    const entry = {
      project_id, project_name: resolvedProject?.name || projName || projNum,
      project_number: projNum, y3_number: wbs, category: cat,
      item_number: itemNo, description_1: desc1, description_2: desc2, uom,
      qty_requested: qtyRequested, qty_on_hand: qtyOnHand, qty_pending_warehouse: qtyPending,
      container_no: containerNo, qty_issued: qtyIssued,
      issued_by_id: issuedById, received_by_id: receivedById,
      qty_returned: qtyReturned, qty_pending_return: qtyPendingReturn
    };

    if (errs.length) {
      errors.push({ row: rowNum, errors: errs, data: entry });
    } else {
      valid.push(entry);
    }
  });

  return { valid, errors };
};

exports.confirmImport = async (validRows) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const row of validRows) {
      await client.query(
        `INSERT INTO stock_items
           (project_id, project_number, y3_number, category, item_number,
            description_1, description_2, uom, qty_requested, qty_on_hand,
            qty_pending_warehouse, container_no, qty_issued, qty_returned, qty_pending_return)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (project_id, item_number) DO UPDATE SET
           description_1       = EXCLUDED.description_1,
           description_2       = EXCLUDED.description_2,
           category            = EXCLUDED.category,
           uom                 = EXCLUDED.uom,
           qty_requested       = EXCLUDED.qty_requested,
           qty_on_hand         = EXCLUDED.qty_on_hand,
           qty_pending_warehouse = EXCLUDED.qty_pending_warehouse,
           qty_issued          = EXCLUDED.qty_issued,
           qty_returned        = EXCLUDED.qty_returned,
           qty_pending_return  = EXCLUDED.qty_pending_return,
           updated_at          = NOW()`,
        [row.project_id, row.project_number, row.y3_number, row.category, row.item_number,
         row.description_1, row.description_2, row.uom, row.qty_requested, row.qty_on_hand,
         row.qty_pending_warehouse, row.container_no, row.qty_issued, row.qty_returned, row.qty_pending_return]
      );
    }
    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
};
