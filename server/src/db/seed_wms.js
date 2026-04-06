require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/site_inventory';

async function seed() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('🌱 Seeding WMS test data...\n');

  // ── 1. WMS Users ────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('Pass@1234', 10);
  const users = [
    { name: 'Mohammed Al-Rashidi', employee_id: 'wm01',  role: 'warehouse_manager', position: 'Warehouse Manager' },
    { name: 'Khalid Al-Sayed',     employee_id: 'rcv01', role: 'receiver',          position: 'Receiver' },
    { name: 'Ahmed Al-Farsi',      employee_id: 'pkr01', role: 'picker',            position: 'Picker' },
  ];
  const userIds = {};
  for (const u of users) {
    const r = await client.query(`
      INSERT INTO users (name, employee_id, role, position, password_hash, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (employee_id) DO UPDATE
        SET name = EXCLUDED.name, role = EXCLUDED.role, position = EXCLUDED.position
      RETURNING id
    `, [u.name, u.employee_id, u.role, u.position, hash]);
    userIds[u.employee_id] = r.rows[0].id;
    console.log(`  ✓ User: ${u.name} (${u.employee_id}) — ${u.role}`);
  }

  // Get admin user id
  const adminRow = await client.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  const adminId = adminRow.rows[0]?.id;

  // ── 2. Suppliers ─────────────────────────────────────────────────────────────
  const suppliers = [
    { code: 'SUP-001', name: 'Al-Barakah Trading Co.', contact_name: 'Faisal Hassan', contact_email: 'faisal@albarakah.com', contact_phone: '+966 50 123 4567', lead_time_days: 7 },
    { code: 'SUP-002', name: 'Gulf Supplies Ltd.',     contact_name: 'Omar Khalil',   contact_email: 'omar@gulfsupplies.com', contact_phone: '+966 55 987 6543', lead_time_days: 14 },
    { code: 'SUP-003', name: 'National Equipment Co.', contact_name: 'Saad Al-Otaibi',contact_email: 'saad@natequip.com',   contact_phone: '+966 54 321 0987', lead_time_days: 10 },
  ];
  const supplierIds = {};
  for (const s of suppliers) {
    const r = await client.query(`
      INSERT INTO wms_suppliers (code, name, contact_name, contact_email, contact_phone, lead_time_days, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,true)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [s.code, s.name, s.contact_name, s.contact_email, s.contact_phone, s.lead_time_days]);
    supplierIds[s.code] = r.rows[0].id;
    console.log(`  ✓ Supplier: ${s.name}`);
  }

  // ── 3. Item Master ────────────────────────────────────────────────────────────
  const items = [
    { item_number: 'CH-001', description_1: 'Chemical Solvent Type A',        description_2: '200L Drum',     category: 'CH',      uom: 'Drum',  reorder_point: 5,  min_stock_level: 2 },
    { item_number: 'CH-002', description_1: 'Industrial Cleaner Concentrate',  description_2: '25L Barrel',    category: 'CH',      uom: 'Barrel',reorder_point: 10, min_stock_level: 4 },
    { item_number: 'DC-001', description_1: 'Safety Gloves Heavy Duty',        description_2: 'Size L',        category: 'DC',      uom: 'Pair',  reorder_point: 50, min_stock_level: 20 },
    { item_number: 'DC-002', description_1: 'Hard Hat Class E',                description_2: 'Yellow',        category: 'DC',      uom: 'Each',  reorder_point: 30, min_stock_level: 10 },
    { item_number: 'DC-003', description_1: 'Safety Harness Full Body',        description_2: 'EN361',         category: 'DC',      uom: 'Each',  reorder_point: 15, min_stock_level: 5 },
    { item_number: 'SP-001', description_1: 'Hydraulic Pump Filter 10 Micron', description_2: 'Part# HPF-10',  category: 'SPARE',   uom: 'Each',  reorder_point: 8,  min_stock_level: 3 },
    { item_number: 'SP-002', description_1: 'V-Belt Drive B68',                description_2: 'Industrial',    category: 'SPARE',   uom: 'Each',  reorder_point: 20, min_stock_level: 8 },
    { item_number: 'GN-001', description_1: 'Cable Tie 300mm',                 description_2: 'Black UV',      category: 'GENERAL', uom: 'Bag',   reorder_point: 25, min_stock_level: 10 },
    { item_number: 'GN-002', description_1: 'Masking Tape 50mm x 50m',         description_2: 'Roll',          category: 'GENERAL', uom: 'Roll',  reorder_point: 40, min_stock_level: 15 },
    { item_number: 'GN-003', description_1: 'WD-40 Lubricant 400ml',           description_2: 'Spray Can',     category: 'GENERAL', uom: 'Can',   reorder_point: 20, min_stock_level: 8 },
  ];
  const itemIds = {};
  for (const it of items) {
    const r = await client.query(`
      INSERT INTO wms_item_master (item_number, description_1, description_2, category, uom, reorder_point, min_stock_level, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,true)
      ON CONFLICT (item_number) DO UPDATE SET description_1 = EXCLUDED.description_1
      RETURNING id
    `, [it.item_number, it.description_1, it.description_2, it.category, it.uom, it.reorder_point, it.min_stock_level]);
    itemIds[it.item_number] = r.rows[0].id;
  }
  console.log(`  ✓ ${items.length} items added to Item Master`);

  // ── 4. Locations (Zones → Racks → Shelves → Bins) ──────────────────────────
  const zones = [
    { code: 'ZA', name: 'Zone A – Chemicals',     description: 'Flammable & chemical storage' },
    { code: 'ZB', name: 'Zone B – PPE & Safety',  description: 'Personal protective equipment' },
    { code: 'ZC', name: 'Zone C – Spare Parts',   description: 'Mechanical spare parts' },
    { code: 'ZD', name: 'Zone D – General Items', description: 'General consumables' },
  ];
  const zoneIds = {};
  for (const z of zones) {
    const r = await client.query(`
      INSERT INTO wms_zones (code, name, description, is_active)
      VALUES ($1,$2,$3,true)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [z.code, z.name, z.description]);
    zoneIds[z.code] = r.rows[0].id;
  }
  console.log(`  ✓ ${zones.length} zones created`);

  // Rack/Shelf/Bin per zone
  const binIds = {}; // key: full_code
  for (const [zcode, zid] of Object.entries(zoneIds)) {
    for (const rnum of ['R01', 'R02']) {
      const rr = await client.query(`
        INSERT INTO wms_racks (zone_id, code, name)
        VALUES ($1,$2,$3)
        ON CONFLICT (zone_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [zid, rnum, `${zcode}-${rnum}`]);
      const rid = rr.rows[0].id;

      for (const snum of ['S01', 'S02']) {
        const sr = await client.query(`
          INSERT INTO wms_shelves (rack_id, code, name)
          VALUES ($1,$2,$3)
          ON CONFLICT (rack_id, code) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `, [rid, snum, `${zcode}-${rnum}-${snum}`]);
        const sid = sr.rows[0].id;

        for (const bnum of ['B01', 'B02', 'B03']) {
          const fullCode = `${zcode}-${rnum}-${snum}-${bnum}`;
          const br = await client.query(`
            INSERT INTO wms_bins (shelf_id, code, full_code, max_qty, is_active)
            VALUES ($1,$2,$3,500,true)
            ON CONFLICT (full_code) DO UPDATE SET is_active = true
            RETURNING id
          `, [sid, bnum, fullCode]);
          binIds[fullCode] = br.rows[0].id;
        }
      }
    }
  }
  console.log(`  ✓ Racks, shelves & bins created (${Object.keys(binIds).length} bins)`);

  // ── 5. Purchase Orders ────────────────────────────────────────────────────────
  const poData = [
    {
      supplier: 'SUP-001',
      status: 'received',
      expected_date: '2026-03-15',
      items: [
        { item: 'CH-001', qty_ordered: 20, qty_received: 20, unit_cost: 450.00 },
        { item: 'CH-002', qty_ordered: 50, qty_received: 50, unit_cost: 85.00 },
      ],
    },
    {
      supplier: 'SUP-002',
      status: 'received',
      expected_date: '2026-03-20',
      items: [
        { item: 'DC-001', qty_ordered: 100, qty_received: 100, unit_cost: 12.50 },
        { item: 'DC-002', qty_ordered: 60,  qty_received: 60,  unit_cost: 35.00 },
        { item: 'DC-003', qty_ordered: 30,  qty_received: 30,  unit_cost: 120.00 },
      ],
    },
    {
      supplier: 'SUP-003',
      status: 'partial',
      expected_date: '2026-04-10',
      items: [
        { item: 'SP-001', qty_ordered: 20, qty_received: 12, unit_cost: 75.00 },
        { item: 'SP-002', qty_ordered: 40, qty_received: 40, unit_cost: 28.00 },
        { item: 'GN-001', qty_ordered: 60, qty_received: 60, unit_cost: 18.00 },
        { item: 'GN-002', qty_ordered: 80, qty_received: 80, unit_cost: 9.50 },
        { item: 'GN-003', qty_ordered: 50, qty_received: 50, unit_cost: 22.00 },
      ],
    },
  ];

  const poIds = [];
  for (const po of poData) {
    const numRow = await client.query(`SELECT 'PO-' || LPAD(nextval('wms_po_seq')::TEXT, 6, '0') AS num`);
    const po_number = numRow.rows[0].num;
    const r = await client.query(`
      INSERT INTO wms_purchase_orders (po_number, supplier_id, status, expected_date, notes, created_by)
      VALUES ($1,$2,$3,$4,'Auto-seeded PO',$5)
      ON CONFLICT (po_number) DO NOTHING
      RETURNING id
    `, [po_number, supplierIds[po.supplier], po.status, po.expected_date, adminId]);
    if (!r.rows[0]) continue;
    const poId = r.rows[0].id;
    poIds.push(poId);

    for (const it of po.items) {
      await client.query(`
        INSERT INTO wms_po_items (po_id, item_master_id, qty_ordered, qty_received, unit_cost)
        VALUES ($1,$2,$3,$4,$5)
      `, [poId, itemIds[it.item], it.qty_ordered, it.qty_received, it.unit_cost]);
    }
    console.log(`  ✓ PO: ${po_number} (${po.status})`);
  }

  // ── 6. GRNs ──────────────────────────────────────────────────────────────────
  // GRN 1 – confirmed (for first two POs)
  const grnDefs = [
    {
      supplier: 'SUP-001', po_idx: 0, status: 'confirmed',
      received_date: '2026-03-16',
      items: [
        { item: 'CH-001', qty_received: 20, condition: 'good' },
        { item: 'CH-002', qty_received: 50, condition: 'good' },
      ],
    },
    {
      supplier: 'SUP-002', po_idx: 1, status: 'confirmed',
      received_date: '2026-03-21',
      items: [
        { item: 'DC-001', qty_received: 100, condition: 'good' },
        { item: 'DC-002', qty_received: 60,  condition: 'good' },
        { item: 'DC-003', qty_received: 25,  condition: 'good' },
        { item: 'DC-003', qty_received: 5,   condition: 'damaged' },
      ],
    },
    {
      supplier: 'SUP-003', po_idx: 2, status: 'confirmed',
      received_date: '2026-03-28',
      items: [
        { item: 'SP-001', qty_received: 12,  condition: 'good' },
        { item: 'SP-002', qty_received: 40,  condition: 'good' },
        { item: 'GN-001', qty_received: 60,  condition: 'good' },
        { item: 'GN-002', qty_received: 80,  condition: 'good' },
        { item: 'GN-003', qty_received: 50,  condition: 'good' },
      ],
    },
  ];

  const grnItemIds = {}; // grn_item_id by item_number for putaway
  for (const grn of grnDefs) {
    const numRow = await client.query(`SELECT 'GRN-' || LPAD(nextval('wms_grn_seq')::TEXT, 6, '0') AS num`);
    const grn_number = numRow.rows[0].num;
    const r = await client.query(`
      INSERT INTO wms_grn (grn_number, po_id, supplier_id, received_date, status, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,'Seeded GRN',$6)
      ON CONFLICT (grn_number) DO NOTHING
      RETURNING id
    `, [grn_number, poIds[grn.po_idx], supplierIds[grn.supplier], grn.received_date, grn.status, adminId]);
    if (!r.rows[0]) continue;
    const grnId = r.rows[0].id;

    for (const it of grn.items) {
      const ir = await client.query(`
        INSERT INTO wms_grn_items (grn_id, item_master_id, qty_received, condition)
        VALUES ($1,$2,$3,$4) RETURNING id
      `, [grnId, itemIds[it.item], it.qty_received, it.condition]);
      if (!grnItemIds[it.item]) grnItemIds[it.item] = [];
      grnItemIds[it.item].push({ id: ir.rows[0].id, qty: it.qty_received, condition: it.condition });
    }
    console.log(`  ✓ GRN: ${grn_number} (${grn.status})`);
  }

  // ── 7. Putaway Tasks + Bin Stock ─────────────────────────────────────────────
  // Map each item to a bin
  const itemBinMap = {
    'CH-001': 'ZA-R01-S01-B01', 'CH-002': 'ZA-R01-S01-B02',
    'DC-001': 'ZB-R01-S01-B01', 'DC-002': 'ZB-R01-S01-B02', 'DC-003': 'ZB-R01-S02-B01',
    'SP-001': 'ZC-R01-S01-B01', 'SP-002': 'ZC-R01-S01-B02',
    'GN-001': 'ZD-R01-S01-B01', 'GN-002': 'ZD-R01-S01-B02', 'GN-003': 'ZD-R01-S01-B03',
  };

  // Final stock quantities (sum of good condition receipts)
  const stockQty = {
    'CH-001': 20, 'CH-002': 50,
    'DC-001': 100, 'DC-002': 60, 'DC-003': 25,
    'SP-001': 12, 'SP-002': 40,
    'GN-001': 60, 'GN-002': 80, 'GN-003': 50,
  };

  let putawayCount = 0;
  for (const [itemNum, entries] of Object.entries(grnItemIds)) {
    const binCode = itemBinMap[itemNum];
    if (!binCode || !binIds[binCode]) continue;
    const binId = binIds[binCode];

    for (const entry of entries) {
      if (entry.condition !== 'good') continue;
      await client.query(`
        INSERT INTO wms_putaway_tasks (grn_item_id, item_master_id, bin_id, qty_to_putaway, qty_putaway, status, assigned_to, completed_by, completed_at)
        VALUES ($1,$2,$3,$4,$4,'completed',$5,$5,NOW())
        ON CONFLICT DO NOTHING
      `, [entry.id, itemIds[itemNum], binId, entry.qty, userIds['rcv01']]);
      putawayCount++;
    }

    // Seed bin stock directly
    const qty = stockQty[itemNum] || 0;
    await client.query(`
      INSERT INTO wms_bin_stock (bin_id, item_master_id, qty_on_hand, qty_reserved)
      VALUES ($1,$2,$3,0)
      ON CONFLICT (bin_id, item_master_id) DO UPDATE SET qty_on_hand = EXCLUDED.qty_on_hand
    `, [binId, itemIds[itemNum], qty]);

    // Log stock transaction (PUTAWAY_IN)
    await client.query(`
      INSERT INTO wms_stock_transactions (item_master_id, bin_id, transaction_type, quantity, notes, user_id)
      VALUES ($1,$2,'PUTAWAY_IN',$3,'Seeded via GRN putaway',$4)
    `, [itemIds[itemNum], binId, qty, userIds['rcv01']]);
  }
  console.log(`  ✓ ${putawayCount} putaway tasks completed, bin stock populated`);

  // ── 8. Dispatch Orders ────────────────────────────────────────────────────────
  const dispatchDefs = [
    {
      status: 'dispatched',
      destination: 'Site A – North Block',
      items: [
        { item: 'DC-001', qty: 20 },
        { item: 'DC-002', qty: 10 },
        { item: 'GN-001', qty: 5 },
      ],
    },
    {
      status: 'confirmed',
      destination: 'Site B – South Wing',
      items: [
        { item: 'CH-001', qty: 3 },
        { item: 'SP-001', qty: 4 },
      ],
    },
    {
      status: 'draft',
      destination: 'Site C – Maintenance',
      items: [
        { item: 'SP-002', qty: 10 },
        { item: 'GN-003', qty: 8 },
      ],
    },
  ];

  for (const ddef of dispatchDefs) {
    const numRow = await client.query(`SELECT 'DO-' || LPAD(nextval('wms_do_seq')::TEXT, 6, '0') AS num`);
    const order_number = numRow.rows[0].num;
    const confirmedBy  = ['confirmed','dispatched'].includes(ddef.status) ? userIds['wm01'] : null;
    const confirmedAt  = ['confirmed','dispatched'].includes(ddef.status) ? new Date() : null;
    const dispatchedBy = ddef.status === 'dispatched' ? userIds['wm01'] : null;
    const dispatchedAt = ddef.status === 'dispatched' ? new Date() : null;

    const r = await client.query(`
      INSERT INTO wms_dispatch_orders (order_number, destination, status, created_by, confirmed_by, confirmed_at, dispatched_by, dispatched_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
    `, [order_number, ddef.destination, ddef.status, userIds['wm01'], confirmedBy, confirmedAt, dispatchedBy, dispatchedAt]);
    const dispId = r.rows[0].id;

    for (const it of ddef.items) {
      const binCode = itemBinMap[it.item];
      const binId = binCode ? binIds[binCode] : null;
      const qtyDispatched = ddef.status === 'dispatched' ? it.qty : 0;

      await client.query(`
        INSERT INTO wms_dispatch_items (dispatch_order_id, item_master_id, bin_id, qty_requested, qty_dispatched)
        VALUES ($1,$2,$3,$4,$5)
      `, [dispId, itemIds[it.item], binId, it.qty, qtyDispatched]);

      // Deduct from bin stock for dispatched orders
      if (ddef.status === 'dispatched' && binId) {
        await client.query(`
          UPDATE wms_bin_stock SET qty_on_hand = qty_on_hand - $1
          WHERE bin_id = $2 AND item_master_id = $3
        `, [it.qty, binId, itemIds[it.item]]);

        await client.query(`
          INSERT INTO wms_stock_transactions (item_master_id, bin_id, transaction_type, quantity, reference_id, reference_type, notes, user_id)
          VALUES ($1,$2,'DISPATCH_OUT',$3,$4,'wms_dispatch_order','Seeded dispatch',$5)
        `, [itemIds[it.item], binId, -it.qty, dispId, userIds['wm01']]);
      }
    }
    console.log(`  ✓ Dispatch Order: ${order_number} (${ddef.status})`);
  }

  // ── 9. Cycle Count ────────────────────────────────────────────────────────────
  const ccNumRow = await client.query(`SELECT 'CC-' || LPAD(nextval('wms_cc_seq')::TEXT, 6, '0') AS num`);
  const cc_number = ccNumRow.rows[0].num;
  const ccR = await client.query(`
    INSERT INTO wms_cycle_counts (count_number, zone_id, notes, status, created_by, completed_by, completed_at)
    VALUES ($1, $2, 'Seeded cycle count – Zone B full count', 'completed', $3, $3, NOW())
    RETURNING id
  `, [cc_number, zoneIds['ZB'], userIds['wm01']]);
  const ccId = ccR.rows[0].id;

  const ccItems = [
    { item: 'DC-001', bin: 'ZB-R01-S01-B01', expected: 80, counted: 80 },
    { item: 'DC-002', bin: 'ZB-R01-S01-B02', expected: 60, counted: 58 },
    { item: 'DC-003', bin: 'ZB-R01-S02-B01', expected: 25, counted: 25 },
  ];

  for (const ci of ccItems) {
    await client.query(`
      INSERT INTO wms_cycle_count_items (cycle_count_id, bin_id, item_master_id, expected_qty, counted_qty, counted_by, counted_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
      ON CONFLICT DO NOTHING
    `, [ccId, binIds[ci.bin], itemIds[ci.item], ci.expected, ci.counted, userIds['pkr01']]);
  }
  console.log(`  ✓ Cycle Count: ${cc_number} (completed)`);

  // Second count – open
  const ccNumRow2 = await client.query(`SELECT 'CC-' || LPAD(nextval('wms_cc_seq')::TEXT, 6, '0') AS num`);
  const cc_number2 = ccNumRow2.rows[0].num;
  const ccR2 = await client.query(`
    INSERT INTO wms_cycle_counts (count_number, notes, status, created_by)
    VALUES ($1, 'Monthly full warehouse count – April 2026', 'open', $2)
    RETURNING id
  `, [cc_number2, userIds['wm01']]);
  const ccId2 = ccR2.rows[0].id;

  // Generate items for open count
  const binStockRows = await client.query(`
    SELECT bs.bin_id, bs.item_master_id, bs.qty_on_hand
    FROM wms_bin_stock bs
    WHERE bs.qty_on_hand > 0
    LIMIT 15
  `);
  for (const row of binStockRows.rows) {
    await client.query(`
      INSERT INTO wms_cycle_count_items (cycle_count_id, bin_id, item_master_id, expected_qty)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT DO NOTHING
    `, [ccId2, row.bin_id, row.item_master_id, row.qty_on_hand]);
  }
  console.log(`  ✓ Cycle Count: ${cc_number2} (open, ${binStockRows.rows.length} items)`);

  // ── Done ──────────────────────────────────────────────────────────────────────
  console.log('\n✅ WMS seed complete!\n');
  console.log('─── Test Users ────────────────────────────────────');
  console.log('  employee_id: wm01   password: Pass@1234  role: warehouse_manager');
  console.log('  employee_id: rcv01  password: Pass@1234  role: receiver');
  console.log('  employee_id: pkr01  password: Pass@1234  role: picker');
  console.log('──────────────────────────────────────────────────\n');

  await client.end();
}

seed().catch(err => { console.error('❌ Seed error:', err.message); process.exit(1); });
