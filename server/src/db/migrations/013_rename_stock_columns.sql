DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_items' AND column_name='wbs_request_no') THEN
    ALTER TABLE stock_items RENAME COLUMN wbs_request_no TO y3_number;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_items' AND column_name='contract_no') THEN
    ALTER TABLE stock_items RENAME COLUMN contract_no TO container_no;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_items_project_item_unique') THEN
    ALTER TABLE stock_items ADD CONSTRAINT stock_items_project_item_unique UNIQUE (project_id, item_number);
  END IF;
END $$;
