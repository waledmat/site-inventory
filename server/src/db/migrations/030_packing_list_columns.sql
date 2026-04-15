INSERT INTO system_settings (key, value) VALUES (
  'packing_list_columns',
  '{"item_number":"ITEM NUMBER","description_1":"ITEM DESCRIPTION","description_2":"DESCRIPTION LINE 2","uom":"UOM","project_number":"PROJECT NUMBER","project_name":"PROJECT NAME","y3_number":"Y3#","category":"CATEGORY","qty_requested":"project requested","qty_on_hand":"Project Onhand","qty_pending_warehouse":"BALANCE","container_no":"Container No.","qty_issued":"Issued Quantity","issued_by_id":"ID issued by","received_by_id":"Received By","qty_returned":"Returned Quantity","qty_pending_return":"Pending Return QTY"}'
) ON CONFLICT (key) DO NOTHING;
