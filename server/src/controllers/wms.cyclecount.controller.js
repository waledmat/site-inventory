const db = require('../config/db');
const { logWmsTransaction } = require('../utils/audit');

// ─── List cycle counts ───────────────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    const where = status ? (params.push(status), 'WHERE cc.status = $1') : '';

    const { rows } = await db.query(`
      SELECT
        cc.id, cc.count_number, cc.status, cc.notes, cc.created_at, cc.completed_at,
        z.name  AS zone_name,
        u1.name AS created_by_name,
        u2.name AS completed_by_name,
        COUNT(cci.id)::INT           AS total_items,
        COUNT(cci.counted_qty)::INT  AS counted_items
      FROM wms_cycle_counts cc
      LEFT JOIN wms_zones           z   ON z.id   = cc.zone_id
      LEFT JOIN users               u1  ON u1.id  = cc.created_by
      LEFT JOIN users               u2  ON u2.id  = cc.completed_by
      LEFT JOIN wms_cycle_count_items cci ON cci.cycle_count_id = cc.id
      ${where}
      GROUP BY cc.id, z.name, u1.name, u2.name
      ORDER BY cc.created_at DESC
    `, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list cycle counts' });
  }
};

// ─── Create cycle count (generates items from current bin stock) ─────────────
exports.create = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { zone_id, notes } = req.body;

    // Generate count number
    const seqRow = await client.query(`SELECT 'CC-' || LPAD(nextval('wms_cc_seq')::TEXT, 6, '0') AS num`);
    const count_number = seqRow.rows[0].num;

    const { rows: [cc] } = await client.query(`
      INSERT INTO wms_cycle_counts (count_number, zone_id, notes, status, created_by)
      VALUES ($1, $2, $3, 'open', $4)
      RETURNING *
    `, [count_number, zone_id || null, notes || null, req.user.id]);

    // Generate count items from current bin stock (scoped to zone if provided)
    const stockQuery = zone_id
      ? `SELECT bs.bin_id, bs.item_master_id, bs.qty_on_hand
           FROM wms_bin_stock bs
           JOIN wms_bins     b  ON b.id  = bs.bin_id
           JOIN wms_shelves  sh ON sh.id = b.shelf_id
           JOIN wms_racks    r  ON r.id  = sh.rack_id
           WHERE r.zone_id = $1 AND bs.qty_on_hand > 0`
      : `SELECT bin_id, item_master_id, qty_on_hand FROM wms_bin_stock WHERE qty_on_hand > 0`;

    const { rows: stockRows } = await client.query(stockQuery, zone_id ? [zone_id] : []);

    if (stockRows.length === 0) {
      throw new Error('No bin stock found for the selected scope. Cannot create an empty count.');
    }

    for (const row of stockRows) {
      await client.query(`
        INSERT INTO wms_cycle_count_items (cycle_count_id, bin_id, item_master_id, expected_qty)
        VALUES ($1, $2, $3, $4)
      `, [cc.id, row.bin_id, row.item_master_id, row.qty_on_hand]);
    }

    await client.query('COMMIT');
    res.status(201).json({ ...cc, item_count: stockRows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to create cycle count' });
  } finally {
    client.release();
  }
};

// ─── Get cycle count detail with items ──────────────────────────────────────
exports.get = async (req, res) => {
  try {
    const { rows: [cc] } = await db.query(`
      SELECT cc.*, z.name AS zone_name,
             u1.name AS created_by_name, u2.name AS completed_by_name
      FROM wms_cycle_counts cc
      LEFT JOIN wms_zones z  ON z.id  = cc.zone_id
      LEFT JOIN users    u1 ON u1.id = cc.created_by
      LEFT JOIN users    u2 ON u2.id = cc.completed_by
      WHERE cc.id = $1
    `, [req.params.id]);

    if (!cc) return res.status(404).json({ error: 'Cycle count not found' });

    const { rows: items } = await db.query(`
      SELECT
        cci.id, cci.bin_id, cci.item_master_id,
        cci.expected_qty, cci.counted_qty, cci.notes,
        cci.counted_at,
        (cci.counted_qty - cci.expected_qty) AS variance,
        im.item_number, im.description_1, im.description_2, im.uom, im.category,
        b.full_code AS bin_code,
        u.name AS counted_by_name
      FROM wms_cycle_count_items cci
      JOIN wms_item_master im ON im.id = cci.item_master_id
      JOIN wms_bins        b  ON b.id  = cci.bin_id
      LEFT JOIN users      u  ON u.id  = cci.counted_by
      WHERE cci.cycle_count_id = $1
      ORDER BY b.full_code, im.item_number
    `, [cc.id]);

    res.json({ ...cc, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get cycle count' });
  }
};

// ─── Record actual count for an item ────────────────────────────────────────
exports.recordCount = async (req, res) => {
  try {
    const { counted_qty, notes } = req.body;
    if (counted_qty === undefined || counted_qty === null) {
      return res.status(400).json({ error: 'counted_qty is required' });
    }

    // Verify item belongs to this count
    const { rows: [item] } = await db.query(
      'SELECT * FROM wms_cycle_count_items WHERE id = $1 AND cycle_count_id = $2',
      [req.params.itemId, req.params.id]
    );
    if (!item) return res.status(404).json({ error: 'Count item not found' });

    const { rows: [cc] } = await db.query(
      "SELECT status FROM wms_cycle_counts WHERE id = $1", [req.params.id]
    );
    if (cc.status === 'completed' || cc.status === 'cancelled') {
      return res.status(400).json({ error: `Cannot record count on a ${cc.status} cycle count` });
    }

    await db.query(`
      UPDATE wms_cycle_count_items
      SET counted_qty = $1, notes = $2, counted_by = $3, counted_at = NOW()
      WHERE id = $4
    `, [counted_qty, notes || null, req.user.id, item.id]);

    // Auto-progress status to 'counting'
    await db.query(`
      UPDATE wms_cycle_counts SET status = 'counting', updated_at = NOW()
      WHERE id = $1 AND status = 'open'
    `, [req.params.id]);

    res.json({ message: 'Count recorded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record count' });
  }
};

// ─── Complete cycle count (optionally apply adjustments) ────────────────────
exports.complete = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { apply_adjustments = false } = req.body;

    const { rows: [cc] } = await client.query(
      'SELECT * FROM wms_cycle_counts WHERE id = $1', [req.params.id]
    );
    if (!cc) return res.status(404).json({ error: 'Not found' });
    if (!['open', 'counting'].includes(cc.status)) {
      return res.status(400).json({ error: `Cannot complete a ${cc.status} cycle count` });
    }

    if (apply_adjustments) {
      const { rows: items } = await client.query(`
        SELECT * FROM wms_cycle_count_items
        WHERE cycle_count_id = $1 AND counted_qty IS NOT NULL
      `, [cc.id]);

      for (const item of items) {
        const variance = item.counted_qty - item.expected_qty;
        if (variance === 0) continue;

        // Adjust bin stock to match counted qty
        await client.query(`
          INSERT INTO wms_bin_stock (bin_id, item_master_id, qty_on_hand, qty_reserved)
          VALUES ($1, $2, $3, 0)
          ON CONFLICT (bin_id, item_master_id)
          DO UPDATE SET qty_on_hand = $3, updated_at = NOW()
        `, [item.bin_id, item.item_master_id, item.counted_qty]);

        await logWmsTransaction(
          client, item.item_master_id, item.bin_id,
          'CYCLE_COUNT_ADJ', variance,
          cc.id, 'wms_cycle_count',
          req.user.id, `Cycle count ${cc.count_number} adjustment`
        );
      }
    }

    await client.query(`
      UPDATE wms_cycle_counts
      SET status = 'completed', completed_by = $1, completed_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [req.user.id, cc.id]);

    await client.query('COMMIT');
    res.json({ message: apply_adjustments ? 'Completed and adjustments applied' : 'Completed' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to complete cycle count' });
  } finally {
    client.release();
  }
};

// ─── Cancel cycle count ──────────────────────────────────────────────────────
exports.cancel = async (req, res) => {
  try {
    const { rows: [cc] } = await db.query(
      'SELECT status FROM wms_cycle_counts WHERE id = $1', [req.params.id]
    );
    if (!cc) return res.status(404).json({ error: 'Not found' });
    if (cc.status === 'completed') {
      return res.status(400).json({ error: 'Cannot cancel a completed count' });
    }
    await db.query(
      "UPDATE wms_cycle_counts SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );
    res.json({ message: 'Cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel' });
  }
};
