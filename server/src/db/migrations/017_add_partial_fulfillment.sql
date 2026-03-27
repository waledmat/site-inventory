ALTER TABLE request_items ADD COLUMN IF NOT EXISTS quantity_issued NUMERIC;
ALTER TABLE request_items ADD COLUMN IF NOT EXISTS fulfillment_notes TEXT;
