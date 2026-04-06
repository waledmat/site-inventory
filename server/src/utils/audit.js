const db = require('../config/db');

/**
 * Log an audit event to audit_log table.
 * @param {object} dbClient - db or transaction client
 * @param {string} userId
 * @param {string} action - e.g. 'ISSUE_CREATED', 'STOCK_ADJUSTED'
 * @param {string} entityType - e.g. 'material_issue', 'stock_item'
 * @param {string} entityId
 * @param {any} oldValue
 * @param {any} newValue
 */
async function logAudit(dbClient, userId, action, entityType, entityId, oldValue = null, newValue = null) {
  try {
    await dbClient.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        userId || null,
        action,
        entityType,
        entityId ? String(entityId) : null,
        oldValue !== null ? JSON.stringify(oldValue) : null,
        newValue !== null ? JSON.stringify(newValue) : null,
      ]
    );
  } catch (err) {
    // Audit failures should never break the main transaction
    console.error('[audit] failed to log:', err.message);
  }
}

/**
 * Log a stock transaction event.
 */
async function logStockTransaction(dbClient, stockItemId, type, quantity, referenceId, referenceType, userId, notes = null) {
  try {
    await dbClient.query(
      `INSERT INTO stock_transactions (stock_item_id, transaction_type, quantity, reference_id, reference_type, notes, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [stockItemId || null, type, quantity, referenceId ? String(referenceId) : null, referenceType || null, notes || null, userId || null]
    );
  } catch (err) {
    console.error('[stock_tx] failed to log:', err.message);
  }
}

/**
 * Log a WMS warehouse stock transaction event.
 */
async function logWmsTransaction(dbClient, itemMasterId, binId, type, quantity, referenceId, referenceType, userId, notes = null) {
  try {
    await dbClient.query(
      `INSERT INTO wms_stock_transactions (item_master_id, bin_id, transaction_type, quantity, reference_id, reference_type, notes, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        itemMasterId || null,
        binId || null,
        type,
        quantity,
        referenceId ? String(referenceId) : null,
        referenceType || null,
        notes || null,
        userId || null,
      ]
    );
  } catch (err) {
    console.error('[wms_tx] failed to log:', err.message);
  }
}

module.exports = { logAudit, logStockTransaction, logWmsTransaction };
