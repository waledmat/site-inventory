/**
 * WMS Fake Data Seed — fills all WMS tables with realistic test data
 * Run: node src/db/wms_seed.js
 */
require('dotenv').config();
const db = require('../config/db');

async function seed() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Admin user ID ──────────────────────────────────────────────────────
    const { rows: [admin] } = await client.query(
      `SELECT id FROM users WHERE employee_id = '73106302'`
    );
    const ADMIN = admin.id;

    // ── 2. Suppliers ──────────────────────────────────────────────────────────
    console.log('Seeding suppliers…');
    const supplierData = [
      { code: 'SUP-004', name: 'Gulf Steel Trading',        contact_name: 'Ahmed Hassan',    contact_email: 'ahmed@gulfsteel.ae',   contact_phone: '+971-50-111-2222', lead_time_days: 7 },
      { code: 'SUP-005', name: 'Arabian Cables Co.',        contact_name: 'Sara Al-Farsi',   contact_email: 'sara@arabcables.ae',   contact_phone: '+971-55-333-4444', lead_time_days: 14 },
      { code: 'SUP-006', name: 'Desert Tech Supplies',      contact_name: 'Mohammed Yusuf',  contact_email: 'm.yusuf@deserttech.ae',contact_phone: '+971-56-555-6666', lead_time_days: 5 },
      { code: 'SUP-007', name: 'Al-Rashid General Trading', contact_name: 'Khalid Al-Rashid',contact_email: 'k.rashid@alrashid.ae', contact_phone: '+971-50-777-8888', lead_time_days: 10 },
    ];
    const supplierIds = {};
    for (const s of supplierData) {
      const { rows: [row] } = await client.query(
        `INSERT INTO wms_suppliers (code, name, contact_name, contact_email, contact_phone, lead_time_days)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name
         RETURNING id, code`,
        [s.code, s.name, s.contact_name, s.contact_email, s.contact_phone, s.lead_time_days]
      );
      supplierIds[row.code] = row.id;
    }
    // Fetch all suppliers
    const { rows: allSuppliers } = await client.query(`SELECT id, code FROM wms_suppliers`);
    allSuppliers.forEach(s => { supplierIds[s.code] = s.id; });
    const SUP = Object.values(supplierIds);

    // ── 3. Item Master ────────────────────────────────────────────────────────
    console.log('Seeding item master…');
    const itemData = [
      { item_number: 'CH-003', description_1: 'Chemical Solvent Type A',      description_2: '20L Drum',           category: 'CH',      uom: 'DRUM', reorder_point: 5,  min_stock_level: 10 },
      { item_number: 'CH-004', description_1: 'Corrosion Inhibitor',           description_2: 'Industrial Grade',   category: 'CH',      uom: 'L',    reorder_point: 20, min_stock_level: 40 },
      { item_number: 'CH-005', description_1: 'Hydraulic Oil ISO 46',          description_2: '200L Barrel',        category: 'CH',      uom: 'BAR',  reorder_point: 3,  min_stock_level: 6  },
      { item_number: 'DC-004', description_1: 'Power Distribution Unit 32A',   description_2: 'Panel Mount',        category: 'DC',      uom: 'EA',   reorder_point: 2,  min_stock_level: 4  },
      { item_number: 'DC-005', description_1: 'MCB Circuit Breaker 16A',        description_2: 'Single Pole',        category: 'DC',      uom: 'EA',   reorder_point: 10, min_stock_level: 20 },
      { item_number: 'DC-006', description_1: 'Cable Tray 100x50mm',            description_2: '3m Length',          category: 'DC',      uom: 'PC',   reorder_point: 15, min_stock_level: 30 },
      { item_number: 'SP-001', description_1: 'Pump Seal Kit — 2"',             description_2: 'O-Ring Set',         category: 'SPARE',   uom: 'SET',  reorder_point: 5,  min_stock_level: 10 },
      { item_number: 'SP-002', description_1: 'Bearing SKF 6205',               description_2: 'Deep Groove Ball',   category: 'SPARE',   uom: 'EA',   reorder_point: 8,  min_stock_level: 15 },
      { item_number: 'SP-003', description_1: 'V-Belt B Section 1000mm',        description_2: 'Industrial Grade',   category: 'SPARE',   uom: 'EA',   reorder_point: 10, min_stock_level: 20 },
      { item_number: 'SP-004', description_1: 'Filter Cartridge 10 Micron',     description_2: '250mm Length',       category: 'SPARE',   uom: 'EA',   reorder_point: 12, min_stock_level: 24 },
      { item_number: 'GEN-001', description_1: 'Safety Helmet Class E',         description_2: 'Yellow Hard Hat',    category: 'GENERAL', uom: 'EA',   reorder_point: 20, min_stock_level: 40 },
      { item_number: 'GEN-002', description_1: 'Safety Vest High-Visibility',   description_2: 'Orange Class 2',     category: 'GENERAL', uom: 'EA',   reorder_point: 20, min_stock_level: 40 },
      { item_number: 'GEN-003', description_1: 'Cable Tie 300mm',               description_2: 'UV Resistant Black', category: 'GENERAL', uom: 'PKT',  reorder_point: 10, min_stock_level: 20 },
      { item_number: 'GEN-004', description_1: 'Duct Tape 50mm × 50m',          description_2: 'Heavy Duty Silver',  category: 'GENERAL', uom: 'RL',   reorder_point: 15, min_stock_level: 30 },
      { item_number: 'GEN-005', description_1: 'Padlock 50mm Brass',            description_2: 'Keyed Alike Set',    category: 'GENERAL', uom: 'EA',   reorder_point: 5,  min_stock_level: 10 },
    ];
    const itemIds = {};
    for (const item of itemData) {
      const { rows: [row] } = await client.query(
        `INSERT INTO wms_item_master (item_number, description_1, description_2, category, uom, reorder_point, min_stock_level)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (item_number) DO UPDATE SET description_1=EXCLUDED.description_1
         RETURNING id, item_number`,
        [item.item_number, item.description_1, item.description_2, item.category, item.uom, item.reorder_point, item.min_stock_level]
      );
      itemIds[row.item_number] = row.id;
    }
    // Fetch all items
    const { rows: allItems } = await client.query(`SELECT id, item_number FROM wms_item_master`);
    allItems.forEach(i => { itemIds[i.item_number] = i.id; });
    const ITEMS = Object.values(itemIds);

    // ── 4. Fetch bins ─────────────────────────────────────────────────────────
    const { rows: allBins } = await client.query(`SELECT id, full_code, shelf_id FROM wms_bins LIMIT 48`);
    const BINS = allBins.map(b => b.id);

    // ── 5. Purchase Orders ────────────────────────────────────────────────────
    console.log('Seeding purchase orders…');
    const poData = [
      { supplier_code: 'SUP-001', status: 'received',   days_ago: 45, items: [['CH-001',100,12.5],['CH-003',50,35.0]] },
      { supplier_code: 'SUP-002', status: 'received',   days_ago: 30, items: [['DC-001',200,8.75],['DC-004',20,450.0]] },
      { supplier_code: 'SUP-003', status: 'partial',    days_ago: 20, items: [['SP-001',40,55.0],['SP-002',60,22.5]] },
      { supplier_code: 'SUP-004', status: 'sent',       days_ago: 10, items: [['CH-004',80,18.0],['CH-005',15,120.0]] },
      { supplier_code: 'SUP-005', status: 'draft',      days_ago:  5, items: [['DC-005',100,15.0],['DC-006',50,28.0]] },
      { supplier_code: 'SUP-006', status: 'received',   days_ago: 60, items: [['GEN-001',100,12.0],['GEN-002',100,8.5]] },
      { supplier_code: 'SUP-007', status: 'cancelled',  days_ago: 15, items: [['SP-003',80,9.5],['SP-004',120,6.0]] },
      { supplier_code: 'SUP-001', status: 'draft',      days_ago:  2, items: [['CH-001',200,12.0],['GEN-003',50,5.5]] },
    ];
    const poIds = [];
    for (let i = 0; i < poData.length; i++) {
      const po = poData[i];
      const num = `PO-${String(2000 + i + 1).padStart(4,'0')}`;
      const { rows: [poRow] } = await client.query(
        `INSERT INTO wms_purchase_orders (po_number, supplier_id, status, expected_date, created_by, created_at)
         VALUES ($1,$2,$3,CURRENT_DATE + INTERVAL '14 days',
                 $4, NOW() - INTERVAL '${po.days_ago} days')
         ON CONFLICT (po_number) DO UPDATE SET status=EXCLUDED.status
         RETURNING id`,
        [num, supplierIds[po.supplier_code] || SUP[0], po.status, ADMIN]
      );
      const poId = poRow.id;
      poIds.push(poId);
      for (const [itemNum, qty, cost] of po.items) {
        const itemId = itemIds[itemNum];
        if (!itemId) continue;
        await client.query(
          `INSERT INTO wms_po_items (po_id, item_master_id, qty_ordered, qty_received, unit_cost)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT DO NOTHING`,
          [poId, itemId, qty, po.status === 'received' ? qty : po.status === 'partial' ? Math.floor(qty/2) : 0, cost]
        );
      }
    }

    // ── 6. GRNs ───────────────────────────────────────────────────────────────
    console.log('Seeding GRNs…');
    const grnData = [
      { po_idx: 0, supplier_code: 'SUP-001', status: 'confirmed', days_ago: 40, items: [['CH-001',100,'good'],['CH-003',50,'good']] },
      { po_idx: 1, supplier_code: 'SUP-002', status: 'confirmed', days_ago: 28, items: [['DC-001',180,'good'],['DC-004',20,'good']] },
      { po_idx: 2, supplier_code: 'SUP-003', status: 'confirmed', days_ago: 18, items: [['SP-001',20,'good'],['SP-002',30,'good']] },
      { po_idx: 5, supplier_code: 'SUP-006', status: 'confirmed', days_ago: 55, items: [['GEN-001',80,'good'],['GEN-002',100,'good']] },
      { po_idx: 1, supplier_code: 'SUP-002', status: 'confirmed', days_ago: 10, items: [['DC-001',20,'damaged'],['DC-005',50,'good']] },
      { po_idx: 0, supplier_code: 'SUP-001', status: 'draft',     days_ago:  3, items: [['CH-004',40,'good'],['CH-005',10,'good']] },
      { po_idx: 7, supplier_code: 'SUP-001', status: 'draft',     days_ago:  1, items: [['CH-001',50,'good'],['GEN-003',30,'good']] },
    ];
    const grnIds = [];
    for (let i = 0; i < grnData.length; i++) {
      const grn = grnData[i];
      const num = `GRN-${String(3000 + i + 1).padStart(4,'0')}`;
      const suppId = supplierIds[grn.supplier_code] || SUP[0];
      const { rows: [grnRow] } = await client.query(
        `INSERT INTO wms_grn (grn_number, po_id, supplier_id, received_date, status, created_by, created_at)
         VALUES ($1,$2,$3, CURRENT_DATE - INTERVAL '${grn.days_ago} days',
                 $4,$5, NOW() - INTERVAL '${grn.days_ago} days')
         ON CONFLICT (grn_number) DO UPDATE SET status=EXCLUDED.status
         RETURNING id`,
        [num, poIds[grn.po_idx] || null, suppId, grn.status, ADMIN]
      );
      const grnId = grnRow.id;
      grnIds.push(grnId);
      for (const [itemNum, qty, cond] of grn.items) {
        const itemId = itemIds[itemNum];
        if (!itemId) continue;
        await client.query(
          `INSERT INTO wms_grn_items (grn_id, item_master_id, qty_received, condition)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT DO NOTHING`,
          [grnId, itemId, qty, cond]
        );
      }
    }

    // ── 7. Putaway Tasks ──────────────────────────────────────────────────────
    console.log('Seeding putaway tasks…');
    // Create putaway tasks from confirmed GRNs (first 5)
    const { rows: confirmedGrnItems } = await client.query(
      `SELECT gi.id AS grn_item_id, gi.item_master_id, gi.qty_received
       FROM wms_grn_items gi
       JOIN wms_grn g ON g.id = gi.grn_id
       WHERE g.status = 'confirmed'
       AND NOT EXISTS (SELECT 1 FROM wms_putaway_tasks pt WHERE pt.grn_item_id = gi.id)`
    );
    let binIdx = 0;
    for (const gi of confirmedGrnItems) {
      const bin = BINS[binIdx % BINS.length];
      binIdx++;
      const isOld = binIdx <= confirmedGrnItems.length * 0.7; // 70% completed
      await client.query(
        `INSERT INTO wms_putaway_tasks
           (grn_item_id, item_master_id, bin_id, qty_to_putaway, qty_putaway, status,
            assigned_to, completed_by, completed_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW() - INTERVAL '${binIdx} days')
         ON CONFLICT DO NOTHING`,
        [
          gi.grn_item_id, gi.item_master_id, bin,
          gi.qty_received, isOld ? gi.qty_received : 0,
          isOld ? 'completed' : 'pending',
          ADMIN, isOld ? ADMIN : null,
          isOld ? new Date(Date.now() - binIdx * 86400000) : null,
        ]
      );
    }

    // ── 8. Bin Stock ──────────────────────────────────────────────────────────
    console.log('Seeding bin stock…');
    // Distribute items across bins
    const binStockData = [
      // [item_number, bin_index, qty_on_hand, qty_reserved]
      ['CH-001', 0,  80, 10], ['CH-001', 1,  45,  5],
      ['CH-002', 2,  60,  0], ['CH-002', 3,  30,  5],
      ['CH-003', 4,  40,  0], ['CH-003', 5,  20,  0],
      ['CH-004', 6,  35, 10], ['CH-005', 7,  12,  2],
      ['DC-001', 8, 150,  0], ['DC-001', 9,  80, 20],
      ['DC-002', 10, 60,  5], ['DC-003', 11, 45,  0],
      ['DC-004', 12, 18,  3], ['DC-005', 13, 75, 15],
      ['DC-006', 14, 40,  0],
      ['SP-001', 15, 30,  0], ['SP-001', 16, 15,  5],
      ['SP-002', 17, 50,  0], ['SP-003', 18, 60, 10],
      ['SP-004', 19, 90,  0],
      ['GEN-001', 20, 70,  0], ['GEN-001', 21, 50,  5],
      ['GEN-002', 22, 80,  0], ['GEN-003', 23, 35,  0],
      ['GEN-004', 24, 45,  0], ['GEN-005', 25, 22,  3],
    ];
    for (const [itemNum, bi, qoh, qr] of binStockData) {
      const itemId = itemIds[itemNum];
      const binId  = BINS[bi % BINS.length];
      if (!itemId || !binId) continue;
      await client.query(
        `INSERT INTO wms_bin_stock (bin_id, item_master_id, qty_on_hand, qty_reserved, updated_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (bin_id, item_master_id)
         DO UPDATE SET qty_on_hand=EXCLUDED.qty_on_hand, qty_reserved=EXCLUDED.qty_reserved`,
        [binId, itemId, qoh, qr]
      );
    }

    // ── 9. Stock Transactions ─────────────────────────────────────────────────
    console.log('Seeding stock transactions…');
    const txnData = [
      ['CH-001',  0, 'putaway',   80, 30], ['CH-001',  1, 'putaway',   45, 28],
      ['CH-002',  2, 'putaway',   60, 25], ['DC-001',  8, 'putaway',  150, 20],
      ['DC-001',  9, 'putaway',   80, 18], ['SP-001', 15, 'putaway',   30, 15],
      ['GEN-001',20, 'putaway',   70, 12], ['GEN-002',22, 'putaway',   80, 10],
      ['CH-001',  0, 'dispatch',  -15,  7], ['DC-001',  8, 'dispatch',  -30,  5],
      ['SP-002', 17, 'dispatch',  -10,  4], ['GEN-001',20, 'dispatch', -20,  3],
      ['CH-003',  4, 'adjust',    10,   2], ['DC-005', 13, 'adjust',    25,  1],
      ['GEN-003',23, 'adjust',    35,   1],
    ];
    for (const [itemNum, bi, txType, qty, daysAgo] of txnData) {
      const itemId = itemIds[itemNum];
      const binId  = BINS[bi % BINS.length];
      if (!itemId) continue;
      await client.query(
        `INSERT INTO wms_stock_transactions (item_master_id, bin_id, transaction_type, quantity, user_id, created_at)
         VALUES ($1,$2,$3,$4,$5, NOW() - INTERVAL '${daysAgo} days')`,
        [itemId, binId, txType, qty, ADMIN]
      );
    }

    // ── 10. Dispatch Orders ───────────────────────────────────────────────────
    console.log('Seeding dispatch orders…');
    // Get a project id if any
    const { rows: projects } = await client.query(`SELECT id FROM projects LIMIT 3`);
    const projIds = projects.map(p => p.id);

    const doData = [
      { status: 'dispatched', days_ago: 25, dest: 'Site A — Block 5',     items: [['CH-001',20,0],['DC-001',30,1]] },
      { status: 'dispatched', days_ago: 15, dest: 'Site B — Workshop',    items: [['GEN-001',15,0],['GEN-002',20,2]] },
      { status: 'confirmed',  days_ago:  5, dest: 'Site C — Pump House',  items: [['SP-001',10,3],['SP-002',15,4]] },
      { status: 'draft',      days_ago:  2, dest: 'Site A — Main Store',  items: [['DC-005',20,5],['GEN-003',10,6]] },
      { status: 'cancelled',  days_ago: 20, dest: 'Site D — Lab',         items: [['CH-004',5,7]] },
    ];
    for (let i = 0; i < doData.length; i++) {
      const d = doData[i];
      const num = `DO-${String(4000 + i + 1).padStart(4,'0')}`;
      const projId = projIds[i % Math.max(projIds.length, 1)] || null;
      const { rows: [doRow] } = await client.query(
        `INSERT INTO wms_dispatch_orders
           (order_number, project_id, destination, status, created_by,
            confirmed_by, confirmed_at, dispatched_by, dispatched_at, created_at)
         VALUES ($1,$2,$3,$4,$5,
           $6, $7, $8, $9,
           NOW() - INTERVAL '${d.days_ago} days')
         ON CONFLICT (order_number) DO UPDATE SET status=EXCLUDED.status
         RETURNING id`,
        [
          num, projId, d.dest, d.status, ADMIN,
          (d.status === 'confirmed' || d.status === 'dispatched') ? ADMIN : null,
          (d.status === 'confirmed' || d.status === 'dispatched') ? new Date(Date.now() - (d.days_ago - 1) * 86400000) : null,
          d.status === 'dispatched' ? ADMIN : null,
          d.status === 'dispatched' ? new Date(Date.now() - (d.days_ago - 2) * 86400000) : null,
        ]
      );
      const doId = doRow.id;
      for (const [itemNum, qty, bi] of d.items) {
        const itemId = itemIds[itemNum];
        const binId  = BINS[bi % BINS.length];
        if (!itemId) continue;
        await client.query(
          `INSERT INTO wms_dispatch_items (dispatch_order_id, item_master_id, bin_id, qty_requested, qty_dispatched)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT DO NOTHING`,
          [doId, itemId, binId, qty, d.status === 'dispatched' ? qty : 0]
        );
      }
    }

    // ── 11. Cycle Counts ──────────────────────────────────────────────────────
    console.log('Seeding cycle counts…');
    const { rows: zones } = await client.query(`SELECT id, code FROM wms_zones LIMIT 4`);
    const { rows: binStockRows } = await client.query(
      `SELECT bs.bin_id, bs.item_master_id, bs.qty_on_hand
       FROM wms_bin_stock bs LIMIT 20`
    );

    const ccData = [
      { status: 'completed', days_ago: 30, zone_idx: 0 },
      { status: 'counting',  days_ago:  7, zone_idx: 1 },
      { status: 'open',      days_ago:  2, zone_idx: 2 },
      { status: 'completed', days_ago: 60, zone_idx: null }, // full count
    ];
    for (let i = 0; i < ccData.length; i++) {
      const cc = ccData[i];
      const num = `CC-${String(5000 + i + 1).padStart(4,'0')}`;
      const zoneId = cc.zone_idx !== null ? (zones[cc.zone_idx]?.id || null) : null;
      const { rows: [ccRow] } = await client.query(
        `INSERT INTO wms_cycle_counts
           (count_number, zone_id, status, created_by, completed_by, completed_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6, NOW() - INTERVAL '${cc.days_ago} days')
         ON CONFLICT (count_number) DO UPDATE SET status=EXCLUDED.status
         RETURNING id`,
        [
          num, zoneId, cc.status, ADMIN,
          cc.status === 'completed' ? ADMIN : null,
          cc.status === 'completed' ? new Date(Date.now() - (cc.days_ago - 2) * 86400000) : null,
        ]
      );
      const ccId = ccRow.id;
      // Add count items from bin stock
      const slice = binStockRows.slice(i * 5, i * 5 + 5);
      for (const bs of slice) {
        const variance = cc.status === 'completed' ? (Math.random() > 0.8 ? -2 : 0) : null;
        const counted = cc.status !== 'open' && variance !== null ? parseFloat(bs.qty_on_hand) + variance : null;
        await client.query(
          `INSERT INTO wms_cycle_count_items
             (cycle_count_id, bin_id, item_master_id, expected_qty, counted_qty, counted_by, counted_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT DO NOTHING`,
          [
            ccId, bs.bin_id, bs.item_master_id, bs.qty_on_hand,
            cc.status !== 'open' ? counted : null,
            cc.status !== 'open' ? ADMIN : null,
            cc.status !== 'open' ? new Date(Date.now() - (cc.days_ago - 1) * 86400000) : null,
          ]
        );
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ WMS seed complete!');

    // Summary
    const tables = ['wms_suppliers','wms_item_master','wms_bins','wms_purchase_orders',
                    'wms_grn','wms_putaway_tasks','wms_bin_stock','wms_stock_transactions',
                    'wms_dispatch_orders','wms_cycle_counts'];
    for (const t of tables) {
      const { rows: [r] } = await db.query(`SELECT COUNT(*) FROM ${t}`);
      console.log(`  ${t}: ${r.count}`);
    }
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
  }
}

seed();
