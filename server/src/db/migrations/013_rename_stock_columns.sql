ALTER TABLE stock_items RENAME COLUMN wbs_request_no TO y3_number;
ALTER TABLE stock_items RENAME COLUMN contract_no TO container_no;
ALTER TABLE stock_items ADD CONSTRAINT stock_items_project_item_unique UNIQUE (project_id, item_number);
