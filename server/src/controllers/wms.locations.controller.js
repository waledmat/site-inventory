const db = require('../config/db');
const { logAudit } = require('../utils/audit');

// ── Zones ─────────────────────────────────────────────────────────────────────

exports.listZones = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM wms_zones ORDER BY code');
    res.json(rows);
  } catch (err) { next(err); }
};

exports.createZone = async (req, res, next) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
    const { rows } = await db.query(
      `INSERT INTO wms_zones (code, name, description) VALUES ($1,$2,$3) RETURNING *`,
      [code.trim().toUpperCase(), name, description || null]
    );
    await logAudit(db, req.user.id, 'WMS_ZONE_CREATED', 'wms_zone', rows[0].id, null, rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Zone code already exists' });
    next(err);
  }
};

// ── Racks ─────────────────────────────────────────────────────────────────────

exports.listRacks = async (req, res, next) => {
  try {
    const { zone_id } = req.query;
    let q = `SELECT r.*, z.code AS zone_code FROM wms_racks r JOIN wms_zones z ON z.id = r.zone_id`;
    const params = [];
    if (zone_id) { params.push(zone_id); q += ` WHERE r.zone_id = $1`; }
    q += ' ORDER BY z.code, r.code';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.createRack = async (req, res, next) => {
  try {
    const { zone_id, code, name } = req.body;
    if (!zone_id || !code) return res.status(400).json({ error: 'zone_id and code are required' });
    const { rows } = await db.query(
      `INSERT INTO wms_racks (zone_id, code, name) VALUES ($1,$2,$3) RETURNING *`,
      [zone_id, code.trim().toUpperCase(), name || null]
    );
    await logAudit(db, req.user.id, 'WMS_RACK_CREATED', 'wms_rack', rows[0].id, null, rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Rack code already exists in this zone' });
    next(err);
  }
};

// ── Shelves ───────────────────────────────────────────────────────────────────

exports.listShelves = async (req, res, next) => {
  try {
    const { rack_id } = req.query;
    let q = `SELECT s.*, r.code AS rack_code, z.code AS zone_code
             FROM wms_shelves s
             JOIN wms_racks r ON r.id = s.rack_id
             JOIN wms_zones z ON z.id = r.zone_id`;
    const params = [];
    if (rack_id) { params.push(rack_id); q += ` WHERE s.rack_id = $1`; }
    q += ' ORDER BY z.code, r.code, s.code';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.createShelf = async (req, res, next) => {
  try {
    const { rack_id, code, name } = req.body;
    if (!rack_id || !code) return res.status(400).json({ error: 'rack_id and code are required' });
    const { rows } = await db.query(
      `INSERT INTO wms_shelves (rack_id, code, name) VALUES ($1,$2,$3) RETURNING *`,
      [rack_id, code.trim().toUpperCase(), name || null]
    );
    await logAudit(db, req.user.id, 'WMS_SHELF_CREATED', 'wms_shelf', rows[0].id, null, rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Shelf code already exists in this rack' });
    next(err);
  }
};

// ── Bins ──────────────────────────────────────────────────────────────────────

exports.listBins = async (req, res, next) => {
  try {
    const { shelf_id, zone_id } = req.query;
    let q = `SELECT b.*, s.code AS shelf_code, r.code AS rack_code, z.code AS zone_code
             FROM wms_bins b
             JOIN wms_shelves s ON s.id = b.shelf_id
             JOIN wms_racks r ON r.id = s.rack_id
             JOIN wms_zones z ON z.id = r.zone_id
             WHERE 1=1`;
    const params = [];
    if (shelf_id) { params.push(shelf_id); q += ` AND b.shelf_id = $${params.length}`; }
    if (zone_id)  { params.push(zone_id);  q += ` AND z.id = $${params.length}`; }
    q += ' ORDER BY b.full_code';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.createBin = async (req, res, next) => {
  try {
    const { shelf_id, code, max_qty } = req.body;
    if (!shelf_id || !code) return res.status(400).json({ error: 'shelf_id and code are required' });

    // Build full_code from parent chain
    const { rows: parents } = await db.query(
      `SELECT z.code AS z, r.code AS r, s.code AS s
       FROM wms_shelves s
       JOIN wms_racks r ON r.id = s.rack_id
       JOIN wms_zones z ON z.id = r.zone_id
       WHERE s.id = $1`,
      [shelf_id]
    );
    if (!parents[0]) return res.status(400).json({ error: 'Shelf not found' });
    const { z, r, s } = parents[0];
    const full_code = `${z}-${r}-${s}-${code.trim().toUpperCase()}`;

    const { rows } = await db.query(
      `INSERT INTO wms_bins (shelf_id, code, full_code, max_qty) VALUES ($1,$2,$3,$4) RETURNING *`,
      [shelf_id, code.trim().toUpperCase(), full_code, max_qty || null]
    );
    await logAudit(db, req.user.id, 'WMS_BIN_CREATED', 'wms_bin', rows[0].id, null, rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Bin code already exists in this shelf' });
    next(err);
  }
};

exports.getBinStock = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT bs.*, im.item_number, im.description_1, im.uom,
              bs.qty_on_hand - bs.qty_reserved AS qty_available
       FROM wms_bin_stock bs
       JOIN wms_item_master im ON im.id = bs.item_master_id
       WHERE bs.bin_id = $1
       ORDER BY im.item_number`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};
