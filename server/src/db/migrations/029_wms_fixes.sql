-- Migration 029: WMS schema fixes, missing indexes, and CHECK constraints
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS / ON CONFLICT)

-- ── 1. Add missing updated_at column to wms_grn (CRITICAL — referenced in code) ──────────────
ALTER TABLE wms_grn ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── 2. Soft-delete support for zones, racks, shelves ────────────────────────────────────────
ALTER TABLE wms_zones   ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE wms_racks   ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE wms_shelves ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 3. CHECK constraints on quantity fields ───────────────────────────────────────────────────
ALTER TABLE wms_po_items      DROP CONSTRAINT IF EXISTS chk_po_qty_ordered;
ALTER TABLE wms_po_items      ADD  CONSTRAINT chk_po_qty_ordered    CHECK (qty_ordered    > 0);

ALTER TABLE wms_grn_items     DROP CONSTRAINT IF EXISTS chk_grn_qty_received;
ALTER TABLE wms_grn_items     ADD  CONSTRAINT chk_grn_qty_received   CHECK (qty_received   > 0);

ALTER TABLE wms_putaway_tasks DROP CONSTRAINT IF EXISTS chk_putaway_qty;
ALTER TABLE wms_putaway_tasks ADD  CONSTRAINT chk_putaway_qty        CHECK (qty_to_putaway > 0);

ALTER TABLE wms_bin_stock     DROP CONSTRAINT IF EXISTS chk_bin_stock_qty;
ALTER TABLE wms_bin_stock     ADD  CONSTRAINT chk_bin_stock_qty      CHECK (qty_on_hand    >= 0);

-- ── 4. UNIQUE constraint on putaway task per GRN item (prevents duplicate tasks) ─────────────
ALTER TABLE wms_putaway_tasks DROP CONSTRAINT IF EXISTS uq_putaway_grn_item;
ALTER TABLE wms_putaway_tasks ADD  CONSTRAINT uq_putaway_grn_item UNIQUE (grn_item_id);

-- ── 5. ON DELETE SET NULL for user references (prevents orphaned records on user delete) ────
-- Already handled by REFERENCES users(id) with NULL default; no change needed for existing FKs.

-- ── 6. Missing indexes ────────────────────────────────────────────────────────────────────────

-- wms_bin_stock
CREATE INDEX IF NOT EXISTS idx_wms_bin_stock_item      ON wms_bin_stock(item_master_id);
CREATE INDEX IF NOT EXISTS idx_wms_bin_stock_updated   ON wms_bin_stock(updated_at);

-- wms_stock_transactions
CREATE INDEX IF NOT EXISTS idx_wms_txn_item            ON wms_stock_transactions(item_master_id);
CREATE INDEX IF NOT EXISTS idx_wms_txn_created         ON wms_stock_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_wms_txn_type            ON wms_stock_transactions(transaction_type);

-- wms_grn
CREATE INDEX IF NOT EXISTS idx_wms_grn_status          ON wms_grn(status);
CREATE INDEX IF NOT EXISTS idx_wms_grn_supplier        ON wms_grn(supplier_id);
CREATE INDEX IF NOT EXISTS idx_wms_grn_po              ON wms_grn(po_id);
CREATE INDEX IF NOT EXISTS idx_wms_grn_created         ON wms_grn(created_at);

-- wms_purchase_orders
CREATE INDEX IF NOT EXISTS idx_wms_po_status           ON wms_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_wms_po_supplier         ON wms_purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_wms_po_created          ON wms_purchase_orders(created_at);

-- wms_po_items
CREATE INDEX IF NOT EXISTS idx_wms_po_items_item       ON wms_po_items(item_master_id);

-- wms_grn_items
CREATE INDEX IF NOT EXISTS idx_wms_grn_items_item      ON wms_grn_items(item_master_id);
CREATE INDEX IF NOT EXISTS idx_wms_grn_items_grn       ON wms_grn_items(grn_id);

-- wms_putaway_tasks
CREATE INDEX IF NOT EXISTS idx_wms_putaway_status      ON wms_putaway_tasks(status);
CREATE INDEX IF NOT EXISTS idx_wms_putaway_item        ON wms_putaway_tasks(item_master_id);
CREATE INDEX IF NOT EXISTS idx_wms_putaway_created     ON wms_putaway_tasks(created_at);

-- wms_item_master
CREATE INDEX IF NOT EXISTS idx_wms_item_number         ON wms_item_master(item_number);
CREATE INDEX IF NOT EXISTS idx_wms_item_category       ON wms_item_master(category);
CREATE INDEX IF NOT EXISTS idx_wms_item_active         ON wms_item_master(is_active);

-- wms_suppliers
CREATE INDEX IF NOT EXISTS idx_wms_supplier_active     ON wms_suppliers(is_active);
