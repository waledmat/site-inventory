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

exports.getDashboardAnalytics = async (req, res, next) => {
  try {
    const results = await Promise.allSettled([
      // 1. Total stock qty & item count
      db.query(`SELECT COUNT(DISTINCT item_master_id) AS items, COALESCE(SUM(qty_on_hand),0) AS total_qty FROM wms_bin_stock`),
      // 2. Stock by category
      db.query(`SELECT im.category, COALESCE(SUM(bs.qty_on_hand),0) AS qty
                FROM wms_item_master im
                LEFT JOIN wms_bin_stock bs ON bs.item_master_id = im.id
                WHERE im.is_active = TRUE
                GROUP BY im.category ORDER BY qty DESC`),
      // 3. Stock by supplier (top 6 via PO)
      db.query(`SELECT s.name AS supplier, COUNT(DISTINCT im.id) AS item_count
                FROM wms_suppliers s
                JOIN wms_purchase_orders po ON po.supplier_id = s.id
                JOIN wms_po_items pi ON pi.po_id = po.id
                JOIN wms_item_master im ON im.id = pi.item_master_id
                WHERE s.is_active = TRUE
                GROUP BY s.name ORDER BY item_count DESC LIMIT 6`),
      // 4. GRN received qty by month (last 6 months)
      db.query(`SELECT TO_CHAR(g.received_date,'Mon YY') AS month,
                       DATE_TRUNC('month', g.received_date) AS month_ts,
                       COALESCE(SUM(gi.qty_received),0) AS qty
                FROM wms_grn g
                JOIN wms_grn_items gi ON gi.grn_id = g.id
                WHERE g.received_date >= NOW() - INTERVAL '6 months'
                  AND g.status = 'confirmed'
                GROUP BY month, month_ts ORDER BY month_ts ASC`),
      // 5. Dispatch qty by month (last 6 months)
      db.query(`SELECT TO_CHAR(d.dispatched_at,'Mon YY') AS month,
                       DATE_TRUNC('month', d.dispatched_at) AS month_ts,
                       COALESCE(SUM(di.qty_dispatched),0) AS qty
                FROM wms_dispatch_orders d
                JOIN wms_dispatch_items di ON di.dispatch_order_id = d.id
                WHERE d.dispatched_at >= NOW() - INTERVAL '6 months'
                  AND d.status = 'dispatched'
                GROUP BY month, month_ts ORDER BY month_ts ASC`),
      // 6. Low stock items by category
      db.query(`SELECT im.category,
                       COUNT(*) FILTER (WHERE COALESCE(s.total_qty_available,0) <= im.reorder_point AND im.reorder_point > 0) AS low_stock_count,
                       COUNT(*) AS total_count
                FROM wms_item_master im
                LEFT JOIN wms_stock_summary s ON s.item_master_id = im.id
                WHERE im.is_active = TRUE
                GROUP BY im.category ORDER BY category`),
      // 7. Transaction types last 30 days
      db.query(`SELECT transaction_type, COUNT(*) AS cnt, COALESCE(SUM(ABS(quantity)),0) AS total_qty
                FROM wms_stock_transactions
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY transaction_type`),
      // 8. Daily stock movements last 14 days
      db.query(`SELECT TO_CHAR(created_at::DATE,'DD Mon') AS day,
                       created_at::DATE AS day_ts,
                       COUNT(*) AS transactions,
                       COALESCE(SUM(CASE WHEN transaction_type IN ('putaway','adjust') THEN quantity ELSE 0 END),0) AS received,
                       COALESCE(SUM(CASE WHEN transaction_type = 'dispatch' THEN ABS(quantity) ELSE 0 END),0) AS dispatched
                FROM wms_stock_transactions
                WHERE created_at >= NOW() - INTERVAL '14 days'
                GROUP BY day, day_ts ORDER BY day_ts ASC`),
      // 9. Putaway task completion rate
      db.query(`SELECT
                  COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE status='completed') AS completed
                FROM wms_putaway_tasks`),
      // 10. GRN confirmation rate
      db.query(`SELECT
                  COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE status='confirmed') AS confirmed
                FROM wms_grn`),
      // 11. Top 5 items by quantity in stock
      db.query(`SELECT im.item_number, im.description_1, im.category,
                       COALESCE(s.total_qty_available, 0) AS qty
                FROM wms_item_master im
                LEFT JOIN wms_stock_summary s ON s.item_master_id = im.id
                WHERE im.is_active = TRUE
                ORDER BY qty DESC LIMIT 5`),
      // 12. Dispatch order fulfillment by status
      db.query(`SELECT status, COUNT(*) AS cnt FROM wms_dispatch_orders GROUP BY status`),
    ]);

    const safe = (r, fallback = []) => r.status === 'fulfilled' ? r.value.rows : fallback;
    const safeVal = (r, field, fallback = 0) => r.status === 'fulfilled' ? parseFloat(r.value.rows[0]?.[field] ?? fallback) : fallback;

    const [totals, byCategory, bySupplier, grnByMonth, dispatchByMonth,
           lowStockByCategory, txnTypes, dailyMovements,
           putawayRate, grnRate, topItems, dispatchStatus] = results;

    const totalQty = safeVal(totals, 'total_qty');
    const totalItems = safeVal(totals, 'items');
    const putawayTotal = safeVal(putawayRate, 'total');
    const putawayCompleted = safeVal(putawayRate, 'completed');
    const grnTotal = safeVal(grnRate, 'total');
    const grnConfirmed = safeVal(grnRate, 'confirmed');

    // Calculate low stock rate
    const lsCats = safe(lowStockByCategory);
    const totalItemsAll = lsCats.reduce((a, c) => a + parseInt(c.total_count), 0);
    const lowStockItems = lsCats.reduce((a, c) => a + parseInt(c.low_stock_count), 0);
    const stockoutRate = totalItemsAll > 0 ? ((lowStockItems / totalItemsAll) * 100).toFixed(1) : 0;

    res.json({
      kpis: {
        total_qty:         totalQty,
        total_items:       totalItems,
        stockout_rate:     parseFloat(stockoutRate),
        putaway_rate:      putawayTotal > 0 ? parseFloat(((putawayCompleted / putawayTotal) * 100).toFixed(1)) : 100,
        grn_confirm_rate:  grnTotal > 0 ? parseFloat(((grnConfirmed / grnTotal) * 100).toFixed(1)) : 100,
        low_stock_items:   lowStockItems,
      },
      by_category:        safe(byCategory),
      by_supplier:        safe(bySupplier),
      grn_by_month:       safe(grnByMonth),
      dispatch_by_month:  safe(dispatchByMonth),
      low_stock_by_cat:   safe(lowStockByCategory),
      txn_types:          safe(txnTypes),
      daily_movements:    safe(dailyMovements),
      top_items:          safe(topItems),
      dispatch_status:    safe(dispatchStatus),
    });
  } catch (err) { next(err); }
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
