const XLSX = require('xlsx');
const db = require('../config/db');

const DEFAULT_COLUMNS = {
  y3_number:     'Y3#',
  item_number:   'ITEM NUMBER',
  description_1: 'ITEM DESCRIPTION',
  description_2: 'DESCRIPTION LINE 2',
  category:      'CATEGORY',
  uom:           'UOM',
  unit_cost:     'unit cost',
  qty_on_hand:   'Project Onhand',
  container_no:  'Container No.',
};

async function getColumnMap() {
  try {
    const { rows } = await db.query("SELECT value FROM system_settings WHERE key = 'packing_list_columns'");
    if (rows.length) {
      const parsed = JSON.parse(rows[0].value);
      const result = {};
      Object.entries(parsed).forEach(([field, val]) => {
        if (typeof val === 'string') {
          result[field] = { header: val, enabled: true };
        } else if (val && typeof val === 'object') {
          result[field] = { header: val.header || '', enabled: val.enabled !== false };
        }
      });
      Object.entries(DEFAULT_COLUMNS).forEach(([field, header]) => {
        if (!result[field]) result[field] = { header, enabled: true };
      });
      return result;
    }
  } catch (_) {}
  return Object.fromEntries(Object.entries(DEFAULT_COLUMNS).map(([f, h]) => [f, { header: h, enabled: true }]));
}

function pick(row, colName) {
  if (!colName) return undefined;
  if (row[colName] !== undefined) return row[colName];
  const lower = colName.toLowerCase();
  const key = Object.keys(row).find(k => k.toLowerCase() === lower);
  return key ? row[key] : undefined;
}

function col(cols, field) {
  const cfg = cols[field];
  if (!cfg || cfg.enabled === false) return null;
  return cfg.header || null;
}

exports.parsePackingList = async (buffer, overrideProjectId = null) => {
  if (!overrideProjectId) {
    return { valid: [], errors: [{ row: 0, errors: ['Please select a project before uploading.'], data: {} }] };
  }

  const { rows: projectRows } = await db.query('SELECT id, name FROM projects WHERE id = $1 AND is_active = true', [overrideProjectId]);
  if (!projectRows.length) {
    return { valid: [], errors: [{ row: 0, errors: ['Selected project not found or inactive.'], data: {} }] };
  }
  const project = projectRows[0];

  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });

  const cols = await getColumnMap();
  const valid = [], errors = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const errs = [];

    const itemNo      = pick(row, col(cols, 'item_number'));
    const desc1       = pick(row, col(cols, 'description_1'));
    const desc2       = pick(row, col(cols, 'description_2')) ?? null;
    const uom         = pick(row, col(cols, 'uom'));
    const wbs         = pick(row, col(cols, 'y3_number')) ?? null;
    const category    = pick(row, col(cols, 'category'))   ?? null;
    const qtyOnHand   = parseFloat(pick(row, col(cols, 'qty_on_hand'))  ?? 0) || 0;
    const containerNo = pick(row, col(cols, 'container_no')) ?? null;
    const unitCost    = parseFloat(pick(row, col(cols, 'unit_cost'))   ?? 0) || 0;

    if (!desc1) errs.push('Item Description is required');
    if (!uom)   errs.push('UOM is required');

    let cat = null;
    if (category) {
      const c = String(category).toUpperCase();
      if (c.includes('CH')) cat = 'CH';
      else if (c.includes('DC') || c.includes('CONS')) cat = 'DC';
      else if (c.includes('SPARE') || c.includes('SP')) cat = 'SPARE';
      else cat = null;
    }

    const entry = {
      project_id: project.id,
      project_name: project.name,
      y3_number: wbs,
      category: cat,
      item_number: itemNo,
      description_1: desc1,
      description_2: desc2,
      uom,
      qty_on_hand: qtyOnHand,
      container_no: containerNo,
      unit_cost: unitCost,
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
           (project_id, y3_number, category, item_number,
            description_1, description_2, uom, qty_on_hand,
            container_no, unit_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (project_id, item_number) DO UPDATE SET
           y3_number     = EXCLUDED.y3_number,
           category      = EXCLUDED.category,
           description_1 = EXCLUDED.description_1,
           description_2 = EXCLUDED.description_2,
           uom           = EXCLUDED.uom,
           qty_on_hand   = EXCLUDED.qty_on_hand,
           container_no  = EXCLUDED.container_no,
           unit_cost     = CASE WHEN EXCLUDED.unit_cost > 0 THEN EXCLUDED.unit_cost ELSE stock_items.unit_cost END,
           updated_at    = NOW()`,
        [row.project_id, row.y3_number, row.category, row.item_number,
         row.description_1, row.description_2, row.uom, row.qty_on_hand,
         row.container_no, row.unit_cost || 0]
      );
    }
    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
};
