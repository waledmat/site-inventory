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

const DEFAULT_COLUMNS = {
  item_number:          'ITEM NUMBER',
  description_1:        'ITEM DESCRIPTION',
  description_2:        'DESCRIPTION LINE 2',
  uom:                  'UOM',
  project_number:       'PROJECT NUMBER',
  project_name:         'PROJECT NAME',
  y3_number:            'Y3#',
  category:             'CATEGORY',
  qty_requested:        'project requested',
  qty_on_hand:          'Project Onhand',
  qty_pending_warehouse:'BALANCE',
  container_no:         'Container No.',
  qty_issued:           'Issued Quantity',
  issued_by_id:         'ID issued by',
  received_by_id:       'Received By',
  qty_returned:         'Returned Quantity',
  qty_pending_return:   'Pending Return QTY',
};

async function getColumnMap() {
  try {
    const { rows } = await db.query("SELECT value FROM system_settings WHERE key = 'packing_list_columns'");
    if (rows.length) {
      const parsed = JSON.parse(rows[0].value);
      const result = {};
      // Support both old string format and new {header, enabled} object format
      Object.entries(parsed).forEach(([field, val]) => {
        if (typeof val === 'string') {
          result[field] = { header: val, enabled: true };
        } else if (val && typeof val === 'object') {
          result[field] = { header: val.header || '', enabled: val.enabled !== false };
        }
      });
      // Fill in any defaults not in saved config
      Object.entries(DEFAULT_COLUMNS).forEach(([field, header]) => {
        if (!result[field]) result[field] = { header, enabled: true };
      });
      return result;
    }
  } catch (_) {}
  // Return defaults as {header, enabled} objects
  return Object.fromEntries(Object.entries(DEFAULT_COLUMNS).map(([f, h]) => [f, { header: h, enabled: true }]));
}

function pick(row, colName) {
  if (!colName) return undefined;
  // exact match first, then case-insensitive fallback
  if (row[colName] !== undefined) return row[colName];
  const lower = colName.toLowerCase();
  const key = Object.keys(row).find(k => k.toLowerCase() === lower);
  return key ? row[key] : undefined;
}

function col(cols, field) {
  const cfg = cols[field];
  if (!cfg || cfg.enabled === false) return null; // disabled — skip
  return cfg.header || null;
}

exports.parsePackingList = async (buffer, overrideProjectId = null) => {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });

  const cols = await getColumnMap();
  const { rows: projects } = await db.query('SELECT id, name, project_number FROM projects WHERE is_active = true');
  const projectMap = {};
  projects.forEach(p => { projectMap[String(p.name).trim().toLowerCase()] = p.id; });

  const valid = [], errors = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const errs = [];

    const itemNo    = pick(row, col(cols, 'item_number'));
    const desc1     = pick(row, col(cols, 'description_1'));
    const desc2     = pick(row, col(cols, 'description_2')) ?? null;
    const uom       = pick(row, col(cols, 'uom'));
    const projNum   = String(pick(row, col(cols, 'project_number')) ?? '').trim();
    const projName  = String(pick(row, col(cols, 'project_name'))   ?? '').trim().toLowerCase();
    const wbs       = pick(row, col(cols, 'y3_number')) ?? null;
    const category  = pick(row, col(cols, 'category'))  ?? null;
    const qtyRequested    = parseFloat(pick(row, col(cols, 'qty_requested'))         ?? 0);
    const qtyOnHand       = parseFloat(pick(row, col(cols, 'qty_on_hand'))           ?? 0);
    const qtyPending      = parseFloat(pick(row, col(cols, 'qty_pending_warehouse')) ?? 0);
    const containerNo     = pick(row, col(cols, 'container_no')) ?? null;
    const qtyIssued       = parseFloat(pick(row, col(cols, 'qty_issued'))            ?? 0);
    const issuedById      = pick(row, col(cols, 'issued_by_id'))   ?? null;
    const receivedById    = pick(row, col(cols, 'received_by_id')) ?? null;
    const qtyReturned     = parseFloat(pick(row, col(cols, 'qty_returned'))          ?? 0);
    const qtyPendingReturn= parseFloat(pick(row, col(cols, 'qty_pending_return'))    ?? 0);

    if (!desc1) errs.push('Item Description is required');
    if (!uom)   errs.push('UOM is required');

    // Resolve project
    let project_id = overrideProjectId || null;
    if (project_id) {
      // project chosen by user — skip matching
    } else if (projectMap[projName]) {
      project_id = projectMap[projName];
    } else if (projNum) {
      const byNum = projects.find(p => p.project_number && String(p.project_number).trim().toLowerCase() === projNum.toLowerCase());
      if (byNum) project_id = byNum.id;
    }
    if (!project_id) {
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
           description_1         = EXCLUDED.description_1,
           description_2         = EXCLUDED.description_2,
           category              = EXCLUDED.category,
           uom                   = EXCLUDED.uom,
           qty_requested         = EXCLUDED.qty_requested,
           qty_on_hand           = EXCLUDED.qty_on_hand,
           qty_pending_warehouse = EXCLUDED.qty_pending_warehouse,
           qty_issued            = EXCLUDED.qty_issued,
           qty_returned          = EXCLUDED.qty_returned,
           qty_pending_return    = EXCLUDED.qty_pending_return,
           updated_at            = NOW()`,
        [row.project_id, row.project_number, row.y3_number, row.category, row.item_number,
         row.description_1, row.description_2, row.uom, row.qty_requested, row.qty_on_hand,
         row.qty_pending_warehouse, row.container_no, row.qty_issued, row.qty_returned, row.qty_pending_return]
      );
    }
    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
};
