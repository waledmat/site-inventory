const db = require('../config/db');
const { logWmsTransaction } = require('../utils/audit');

exports.listTasks = async (req, res, next) => {
  try {
    const { status } = req.query;
    let q = `SELECT pt.*, im.item_number, im.description_1, im.uom,
               b.full_code AS bin_full_code,
               g.grn_number
             FROM wms_putaway_tasks pt
             JOIN wms_item_master im ON im.id = pt.item_master_id
             LEFT JOIN wms_bins b ON b.id = pt.bin_id
             LEFT JOIN wms_grn_items gi ON gi.id = pt.grn_item_id
             LEFT JOIN wms_grn g ON g.id = gi.grn_id
             WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND pt.status = $${params.length}`; }
    else { q += ` AND pt.status != 'completed'`; }
    q += ' ORDER BY pt.created_at ASC';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.completeTask = async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { bin_id } = req.body;
    if (!bin_id) return res.status(400).json({ error: 'bin_id is required' });

    const { rows: [task] } = await client.query(
      `SELECT * FROM wms_putaway_tasks WHERE id = $1 FOR UPDATE`, [req.params.id]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status === 'completed') return res.status(409).json({ error: 'Already completed' });

    // Verify bin exists
    const { rows: [bin] } = await client.query(`SELECT id FROM wms_bins WHERE id = $1`, [bin_id]);
    if (!bin) return res.status(400).json({ error: 'Bin not found' });

    // Upsert bin stock — lock existing row first to prevent race conditions
    await client.query(
      `INSERT INTO wms_bin_stock (bin_id, item_master_id, qty_on_hand, updated_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (bin_id, item_master_id)
       DO UPDATE SET qty_on_hand = wms_bin_stock.qty_on_hand + $3, updated_at = NOW()`,
      [bin_id, task.item_master_id, task.qty_to_putaway]
    );

    // Log transaction
    await logWmsTransaction(
      client, task.item_master_id, bin_id,
      'putaway', task.qty_to_putaway,
      task.id, 'putaway_task',
      req.user.id, `Putaway from GRN item ${task.grn_item_id}`
    );

    // Mark task complete
    await client.query(
      `UPDATE wms_putaway_tasks
       SET status='completed', bin_id=$1, qty_putaway=$2, completed_by=$3, completed_at=NOW()
       WHERE id=$4`,
      [bin_id, task.qty_to_putaway, req.user.id, task.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Putaway completed' });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
};
