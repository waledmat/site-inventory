/**
 * Finds or creates a wms_item_master entry for a stock_item, then links them.
 * Called after each stock_item upsert during packing list upload.
 *
 * @param {object} dbClient - pg client or pool
 * @param {object} stockItem - { id, item_number, description_1, description_2, category, uom }
 */
async function syncFromStockItem(dbClient, stockItem) {
  try {
    const { item_number, description_1, description_2, category, uom, id: stockItemId } = stockItem;
    if (!item_number) return;

    // Find or create item master entry
    const { rows: existing } = await dbClient.query(
      'SELECT id FROM wms_item_master WHERE item_number = $1',
      [item_number]
    );

    let itemMasterId;
    if (existing[0]) {
      itemMasterId = existing[0].id;
    } else {
      // Normalize category to valid WMS category
      const validCategories = ['CH', 'DC', 'SPARE', 'GENERAL'];
      const normalizedCategory = validCategories.includes(category) ? category : 'GENERAL';

      const { rows: inserted } = await dbClient.query(
        `INSERT INTO wms_item_master (item_number, description_1, description_2, category, uom)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (item_number) DO UPDATE SET
           description_1 = EXCLUDED.description_1,
           updated_at = NOW()
         RETURNING id`,
        [item_number, description_1 || item_number, description_2 || null, normalizedCategory, uom || 'EA']
      );
      itemMasterId = inserted[0].id;
    }

    // Link stock_item to item master
    await dbClient.query(
      'UPDATE stock_items SET item_master_id = $1 WHERE id = $2',
      [itemMasterId, stockItemId]
    );
  } catch (err) {
    // Sync failures must not break packing list upload
    console.error('[itemMasterSync] failed:', err.message);
  }
}

module.exports = { syncFromStockItem };
