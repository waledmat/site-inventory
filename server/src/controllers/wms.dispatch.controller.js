const db = require('../config/db');
const { logWmsTransaction } = require('../utils/audit');

// ─── List dispatch orders ────────────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const { status, project_id } = req.query;
    const conditions = [];
    const params = [];

    if (status)     { params.push(status);     conditions.push(`dsp.status = $${params.length}`); }
    if (project_id) { params.push(project_id); conditions.push(`dsp.project_id = $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await db.query(`
      SELECT
        dsp.id, dsp.order_number, dsp.status, dsp.destination, dsp.notes,
        dsp.created_at, dsp.dispatched_at,
        p.name  AS project_name,
        u.name  AS created_by_name,
        COUNT(di.id)::INT AS item_count
      FROM wms_dispatch_orders dsp
      LEFT JOIN projects           p  ON p.id  = dsp.project_id
      LEFT JOIN users              u  ON u.id  = dsp.created_by
      LEFT JOIN wms_dispatch_items di ON di.dispatch_order_id = dsp.id
      ${where}
      GROUP BY dsp.id, p.name, u.name
      ORDER BY dsp.created_at DESC
    `, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list dispatch orders' });
  }
};

// ─── Create dispatch order (draft) ──────────────────────────────────────────
exports.create = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { project_id, destination, notes, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    const seqRow = await client.query(`SELECT 'DO-' || LPAD(nextval('wms_do_seq')::TEXT, 6, '0') AS num`);
    const order_number = seqRow.rows[0].num;

    const { rows: [order] } = await client.query(`
      INSERT INTO wms_dispatch_orders (order_number, project_id, destination, notes, status, created_by)
      VALUES ($1, $2, $3, $4, 'draft', $5)
      RETURNING *
    `, [order_number, project_id || null, destination || null, notes || null, req.user.id]);

    for (const item of items) {
      if (!item.item_master_id || !item.qty_requested) {
        throw new Error('Each item requires item_master_id and qty_requested');
      }
      await client.query(`
        INSERT INTO wms_dispatch_items (dispatch_order_id, item_master_id, bin_id, qty_requested)
        VALUES ($1, $2, $3, $4)
      `, [order.id, item.item_master_id, item.bin_id || null, item.qty_requested]);
    }

    await client.query('COMMIT');
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to create dispatch order' });
  } finally {
    client.release();
  }
};

// ─── Get dispatch order detail ───────────────────────────────────────────────
exports.get = async (req, res) => {
  try {
    const { rows: [order] } = await db.query(`
      SELECT
        dsp.*, p.name AS project_name,
        u1.name AS created_by_name,
        u2.name AS confirmed_by_name,
        u3.name AS dispatched_by_name
      FROM wms_dispatch_orders dsp
      LEFT JOIN projects p  ON p.id  = dsp.project_id
      LEFT JOIN users   u1 ON u1.id = dsp.created_by
      LEFT JOIN users   u2 ON u2.id = dsp.confirmed_by
      LEFT JOIN users   u3 ON u3.id = dsp.dispatched_by
      WHERE dsp.id = $1
    `, [req.params.id]);

    if (!order) return res.status(404).json({ error: 'Dispatch order not found' });

    const { rows: items } = await db.query(`
      SELECT
        di.id, di.item_master_id, di.bin_id,
        di.qty_requested, di.qty_dispatched,
        im.item_number, im.description_1, im.description_2, im.uom, im.category,
        b.full_code AS bin_code,
        bs.qty_on_hand AS bin_stock
      FROM wms_dispatch_items di
      JOIN wms_item_master im ON im.id = di.item_master_id
      LEFT JOIN wms_bins      b  ON b.id  = di.bin_id
      LEFT JOIN wms_bin_stock bs ON bs.bin_id = di.bin_id AND bs.item_master_id = di.item_master_id
      WHERE di.dispatch_order_id = $1
      ORDER BY di.created_at
    `, [order.id]);

    res.json({ ...order, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get dispatch order' });
  }
};

// ─── Confirm dispatch order ──────────────────────────────────────────────────
exports.confirm = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [order] } = await client.query(
      'SELECT * FROM wms_dispatch_orders WHERE id = $1', [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Dispatch order not found' });
    if (order.status !== 'draft') {
      return res.status(400).json({ error: `Cannot confirm a ${order.status} order` });
    }

    const { rows: items } = await client.query(
      'SELECT * FROM wms_dispatch_items WHERE dispatch_order_id = $1', [order.id]
    );

    for (const item of items) {
      if (item.bin_id) {
        const { rows: [stock] } = await client.query(
          'SELECT qty_on_hand FROM wms_bin_stock WHERE bin_id = $1 AND item_master_id = $2',
          [item.bin_id, item.item_master_id]
        );
        const available = stock?.qty_on_hand || 0;
        if (available < item.qty_requested) {
          const { rows: [im] } = await client.query(
            'SELECT item_number FROM wms_item_master WHERE id = $1', [item.item_master_id]
          );
          throw new Error(`Insufficient stock for item ${im?.item_number}: need ${item.qty_requested}, have ${available}`);
        }
      }
    }

    await client.query(`
      UPDATE wms_dispatch_orders
      SET status = 'confirmed', confirmed_by = $1, confirmed_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [req.user.id, order.id]);

    await client.query('COMMIT');
    res.json({ message: 'Dispatch order confirmed' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to confirm dispatch order' });
  } finally {
    client.release();
  }
};

// ─── Dispatch (deduct stock) ─────────────────────────────────────────────────
exports.dispatch = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [order] } = await client.query(
      'SELECT * FROM wms_dispatch_orders WHERE id = $1', [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Dispatch order not found' });
    if (order.status !== 'confirmed') {
      return res.status(400).json({ error: 'Order must be confirmed before dispatching' });
    }

    const { rows: items } = await client.query(
      'SELECT * FROM wms_dispatch_items WHERE dispatch_order_id = $1', [order.id]
    );

    for (const item of items) {
      if (!item.bin_id) continue;

      await client.query(`
        INSERT INTO wms_bin_stock (bin_id, item_master_id, qty_on_hand, qty_reserved)
        VALUES ($1, $2, -$3, 0)
        ON CONFLICT (bin_id, item_master_id)
        DO UPDATE SET qty_on_hand = wms_bin_stock.qty_on_hand - $3
      `, [item.bin_id, item.item_master_id, item.qty_requested]);

      await client.query(
        'UPDATE wms_dispatch_items SET qty_dispatched = qty_requested WHERE id = $1',
        [item.id]
      );

      await logWmsTransaction(
        client, item.item_master_id, item.bin_id,
        'DISPATCH_OUT', -item.qty_requested,
        order.id, 'wms_dispatch_order',
        req.user.id, `Dispatched via ${order.order_number}`
      );
    }

    await client.query(`
      UPDATE wms_dispatch_orders
      SET status = 'dispatched', dispatched_by = $1, dispatched_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [req.user.id, order.id]);

    await client.query('COMMIT');
    res.json({ message: 'Dispatched successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to dispatch order' });
  } finally {
    client.release();
  }
};

// ─── Cancel dispatch order ───────────────────────────────────────────────────
exports.cancel = async (req, res) => {
  try {
    const { rows: [order] } = await db.query(
      'SELECT * FROM wms_dispatch_orders WHERE id = $1', [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Not found' });
    if (order.status === 'dispatched') {
      return res.status(400).json({ error: 'Cannot cancel a dispatched order' });
    }
    await db.query(
      "UPDATE wms_dispatch_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );
    res.json({ message: 'Cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel' });
  }
};
