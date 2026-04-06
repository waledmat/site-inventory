const db = require('../config/db');
const { logWmsTransaction } = require('../utils/audit');

exports.listStock = async (req, res, next) => {
  try {
    const { q, category, low_stock } = req.query;
    let query = `SELECT * FROM wms_stock_summary WHERE 1=1`;
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (item_number ILIKE $${params.length} OR description_1 ILIKE $${params.length})`;
    }
    if (category) { params.push(category); query += ` AND category = $${params.length}`; }
    if (low_stock === 'true') {
      query += ` AND total_qty_available <= reorder_point`;
    }
    query += ' ORDER BY item_number';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.getBinStock = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT bs.*, b.full_code, b.code AS bin_code,
              s.code AS shelf_code, r.code AS rack_code, z.code AS zone_code,
              (bs.qty_on_hand - bs.qty_reserved) AS qty_available
       FROM wms_bin_stock bs
       JOIN wms_bins b ON b.id = bs.bin_id
       JOIN wms_shelves s ON s.id = b.shelf_id
       JOIN wms_racks r ON r.id = s.rack_id
       JOIN wms_zones z ON z.id = r.zone_id
       WHERE bs.item_master_id = $1
       ORDER BY b.full_code`,
      [req.params.itemId]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.adjust = async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { bin_id, item_master_id, qty_adjustment, notes } = req.body;
    if (!bin_id || !item_master_id || qty_adjustment === undefined)
      return res.status(400).json({ error: 'bin_id, item_master_id, qty_adjustment required' });

    // Upsert bin stock with adjustment
    const { rows: [bs] } = await client.query(
      `INSERT INTO wms_bin_stock (bin_id, item_master_id, qty_on_hand, updated_at)
       VALUES ($1,$2,GREATEST(0,$3),NOW())
       ON CONFLICT (bin_id, item_master_id)
       DO UPDATE SET qty_on_hand = GREATEST(0, wms_bin_stock.qty_on_hand + $3), updated_at = NOW()
       RETURNING *`,
      [bin_id, item_master_id, qty_adjustment]
    );

    await logWmsTransaction(
      client, item_master_id, bin_id,
      'adjust', qty_adjustment,
      null, null,
      req.user.id, notes || 'Manual adjustment'
    );

    await client.query('COMMIT');
    res.json(bs);
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
};

exports.getDashboardStats = async (req, res, next) => {
  try {
    const results = await Promise.allSettled([
      db.query(`SELECT COUNT(*) FROM wms_suppliers WHERE is_active=TRUE`),
      db.query(`SELECT COUNT(*) FROM wms_item_master WHERE is_active=TRUE`),
      db.query(`SELECT COUNT(*) FROM wms_zones WHERE is_active=TRUE`),
      db.query(`SELECT COUNT(*) FROM wms_grn WHERE status='draft'`),
      db.query(`SELECT COUNT(*) FROM wms_putaway_tasks WHERE status != 'completed'`),
      db.query(`SELECT COUNT(*) FROM wms_stock_summary WHERE total_qty_available <= reorder_point AND reorder_point > 0`),
    ]);

    const safe = (r) => r.status === 'fulfilled' ? parseInt(r.value.rows[0].count) : 0;
    const [suppliers, items, zones, pendingGRN, pendingPutaway, lowStock] = results;

    res.json({
      suppliers:       safe(suppliers),
      items:           safe(items),
      zones:           safe(zones),
      pending_grn:     safe(pendingGRN),
      pending_putaway: safe(pendingPutaway),
      low_stock:       safe(lowStock),
    });
  } catch (err) { next(err); }
};
