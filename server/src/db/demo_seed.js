/**
 * demo_seed.js — Full client demo data for Site Inventory + WMS
 * Run: node src/db/demo_seed.js
 */
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost/site_inventory' });

const log = (msg) => console.log(`[demo_seed] ${msg}`);

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─── 1. Hash passwords ────────────────────────────────────────────────
    const passHash = await bcrypt.hash('Pass@1234', 10);
    log('Password hashed');

    // ─── 2. Add Projects ──────────────────────────────────────────────────
    const projSABIC = randomUUID();
    const projAramco = randomUUID();
    const projNEOM = randomUUID();

    await client.query(`
      INSERT INTO projects (id, name, location, project_number, start_date, end_date, is_active)
      VALUES
        ($1, 'SABIC Ethylene Plant', 'Jubail Industrial City', '5600', '2025-06-01', '2027-03-31', true),
        ($2, 'Aramco Gas Processing Unit', 'Dhahran, Eastern Province', '6200', '2025-09-01', '2027-06-30', true),
        ($3, 'NEOM Infrastructure Phase 2', 'Tabuk Region', '7800', '2026-01-01', '2028-12-31', true)
      ON CONFLICT DO NOTHING
    `, [projSABIC, projAramco, projNEOM]);
    log('Projects added');

    // ─── 3. Add Users ─────────────────────────────────────────────────────
    const sk02 = randomUUID(); const sk03 = randomUUID(); const sk04 = randomUUID();
    const rq01 = randomUUID(); const rq02 = randomUUID(); const rq03 = randomUUID();
    const rq04 = randomUUID(); const rq05 = randomUUID(); const rq06 = randomUUID();
    const coord1 = randomUUID();

    await client.query(`
      INSERT INTO users (id, name, employee_id, role, email, password_hash, position, is_active) VALUES
        ($1,  'Faisal Al-Harbi',     'sk02',    'storekeeper', 'faisal.sk@demo.com',   $11, 'Storekeeper',   true),
        ($2,  'Nasser Al-Mutairi',   'sk03',    'storekeeper', 'nasser.sk@demo.com',   $11, 'Storekeeper',   true),
        ($3,  'Turki Al-Shehri',     'sk04',    'storekeeper', 'turki.sk@demo.com',    $11, 'Storekeeper',   true),
        ($4,  'Abdullah Al-Dossary', 'EMP-4101', 'requester',  'abdull.r@demo.com',    $11, 'Site Engineer', true),
        ($5,  'Ibrahim Al-Sulaiman', 'EMP-4102', 'requester',  'ibrahim.r@demo.com',   $11, 'Site Engineer', true),
        ($6,  'Fahad Al-Buainain',   'EMP-4103', 'requester',  'fahad.r@demo.com',     $11, 'Foreman',       true),
        ($7,  'Yasser Al-Qahtani',   'EMP-4104', 'requester',  'yasser.r@demo.com',    $11, 'Foreman',       true),
        ($8,  'Meshal Al-Rashidi',   'EMP-4105', 'requester',  'meshal.r@demo.com',    $11, 'Field Eng',     true),
        ($9,  'Rayan Al-Otibi',      'EMP-4106', 'requester',  'rayan.r@demo.com',     $11, 'Field Eng',     true),
        ($10, 'Sami Al-Dosari',      'coord01', 'coordinator', 'sami.coord@demo.com',  $11, 'Coordinator',   true)
      ON CONFLICT (employee_id) DO NOTHING
    `, [sk02, sk03, sk04, rq01, rq02, rq03, rq04, rq05, rq06, coord1, passHash]);
    log('Users added');

    // Get the existing storekeeper (waled) and admin IDs
    const { rows: existingUsers } = await client.query(`
      SELECT id, employee_id, role FROM users WHERE employee_id IN ('waled','73106302','2250','EMP-3101','EMP-3102','EMP-3103','EMP-3104','EMP-3105')
    `);
    const userMap = {};
    existingUsers.forEach(u => { userMap[u.employee_id] = u.id; });

    // Also get new user IDs by employee_id (in case ON CONFLICT skipped)
    const { rows: newUsers } = await client.query(`
      SELECT id, employee_id FROM users WHERE employee_id IN ('sk02','sk03','sk04','EMP-4101','EMP-4102','EMP-4103','EMP-4104','EMP-4105','EMP-4106')
    `);
    newUsers.forEach(u => { userMap[u.employee_id] = u.id; });

    // ─── 4. Assign storekeepers to projects ──────────────────────────────
    const { rows: [{ id: existingProjId }] } = await client.query(`SELECT id FROM projects WHERE name = 'Aramco X'`);

    await client.query(`
      INSERT INTO project_storekeepers (project_id, user_id) VALUES
        ($1, $2), ($3, $4), ($5, $6)
      ON CONFLICT DO NOTHING
    `, [
      projSABIC, userMap['sk02'] || sk02,
      projAramco, userMap['sk03'] || sk03,
      projNEOM, userMap['sk04'] || sk04
    ]);
    log('Storekeepers assigned');

    // ─── 5. Assign requesters to projects ───────────────────────────────
    await client.query(`
      INSERT INTO project_requesters (project_id, user_id) VALUES
        ($1, $2), ($1, $3),
        ($4, $5), ($4, $6),
        ($7, $8), ($7, $9)
      ON CONFLICT DO NOTHING
    `, [
      projSABIC, userMap['EMP-4101'] || rq01, userMap['EMP-4102'] || rq02,
      projAramco, userMap['EMP-4103'] || rq03, userMap['EMP-4104'] || rq04,
      projNEOM, userMap['EMP-4105'] || rq05, userMap['EMP-4106'] || rq06
    ]);
    log('Requesters assigned');

    // ─── 6. Add Stock Items for new projects ─────────────────────────────
    const stockItems = [
      // SABIC Ethylene Plant
      { proj: projSABIC, num: '125A250001', d1: 'ALUMINUM REFORMER BOX', uom: 'EA', qty: 12, cat: 'SPARE' },
      { proj: projSABIC, num: '125H400001', d1: 'HYDROTEST MANIFOLD - INLET', uom: 'EA', qty: 6, cat: 'SPARE' },
      { proj: projSABIC, num: '125H400004', d1: 'HYDROTEST HAND PUMP 50 BAR', uom: 'EA', qty: 4, cat: 'SPARE' },
      { proj: projSABIC, num: '155E030001', d1: 'EARTHING CABLE WITH CLAMPS', uom: 'EA', qty: 50, cat: 'DC' },
      { proj: projSABIC, num: '115E110028', d1: 'DRILL MACHINE CORDLESS', uom: 'EA', qty: 8, cat: 'DC' },
      { proj: projSABIC, num: '125S130001', d1: 'SAND CATCHER', uom: 'EA', qty: 15, cat: 'SPARE' },
      { proj: projSABIC, num: '115L120003', d1: 'HAND TOOL LANYARD', uom: 'EA', qty: 120, cat: 'DC' },
      { proj: projSABIC, num: '125U100005', d1: 'SCOOP ALUMINUM SMALL/BIG', uom: 'EA', qty: 30, cat: 'SPARE' },
      { proj: projSABIC, num: '135P750002', d1: 'GARCO DOUBLE BALL PUMP', uom: 'EA', qty: 5, cat: 'SPARE' },
      { proj: projSABIC, num: '125B070003', d1: 'PERMIT BOX', uom: 'EA', qty: 10, cat: 'DC' },
      // Aramco Gas Processing
      { proj: projAramco, num: '125A250001', d1: 'ALUMINUM REFORMER BOX', uom: 'EA', qty: 8, cat: 'SPARE' },
      { proj: projAramco, num: '125H400001', d1: 'HYDROTEST MANIFOLD - INLET', uom: 'EA', qty: 10, cat: 'SPARE' },
      { proj: projAramco, num: '125H400004', d1: 'HYDROTEST HAND PUMP 50 BAR', uom: 'EA', qty: 6, cat: 'SPARE' },
      { proj: projAramco, num: '155B670005', d1: 'COPPER GROUND PLATE', uom: 'ST', qty: 25, cat: 'DC' },
      { proj: projAramco, num: '155E030001', d1: 'EARTHING CABLE WITH CLAMPS', uom: 'EA', qty: 80, cat: 'DC' },
      { proj: projAramco, num: '125L260003', d1: 'DRUM LIFTER', uom: 'EA', qty: 3, cat: 'SPARE' },
      { proj: projAramco, num: '115E110028', d1: 'DRILL MACHINE CORDLESS', uom: 'EA', qty: 12, cat: 'DC' },
      { proj: projAramco, num: '125U100006', d1: 'LOADING FUNNEL [VARIOUS TYPE]', uom: 'EA', qty: 20, cat: 'SPARE' },
      { proj: projAramco, num: '125B070004', d1: 'PSV WOODEN BOX', uom: 'EA', qty: 7, cat: 'DC' },
      { proj: projAramco, num: '125B070005', d1: 'PSV STEEL BOX', uom: 'EA', qty: 5, cat: 'SPARE' },
      // NEOM Infrastructure
      { proj: projNEOM, num: '125A250001', d1: 'ALUMINUM REFORMER BOX', uom: 'EA', qty: 20, cat: 'SPARE' },
      { proj: projNEOM, num: '115E110028', d1: 'DRILL MACHINE CORDLESS', uom: 'EA', qty: 15, cat: 'DC' },
      { proj: projNEOM, num: '115L120003', d1: 'HAND TOOL LANYARD', uom: 'EA', qty: 300, cat: 'DC' },
      { proj: projNEOM, num: '125H400004', d1: 'HYDROTEST HAND PUMP 50 BAR', uom: 'EA', qty: 8, cat: 'SPARE' },
      { proj: projNEOM, num: '155E030001', d1: 'EARTHING CABLE WITH CLAMPS', uom: 'EA', qty: 60, cat: 'DC' },
      { proj: projNEOM, num: '125L260003', d1: 'DRUM LIFTER', uom: 'EA', qty: 4, cat: 'SPARE' },
      { proj: projNEOM, num: '125S130001', d1: 'SAND CATCHER', uom: 'EA', qty: 25, cat: 'SPARE' },
      { proj: projNEOM, num: '125U100005', d1: 'SCOOP ALUMINUM SMALL/BIG', uom: 'EA', qty: 40, cat: 'SPARE' },
      { proj: projNEOM, num: '125B070003', d1: 'PERMIT BOX', uom: 'EA', qty: 14, cat: 'DC' },
      { proj: projNEOM, num: '155B670005', d1: 'COPPER GROUND PLATE', uom: 'ST', qty: 35, cat: 'DC' },
    ];

    const stockItemIds = {};
    for (const si of stockItems) {
      const id = randomUUID();
      await client.query(`
        INSERT INTO stock_items (id, project_id, project_number, item_number, description_1, uom, qty_on_hand, category, qty_requested, qty_issued, qty_returned, qty_pending_return)
        VALUES ($1,$2,(SELECT project_number FROM projects WHERE id=$2),$3,$4,$5,$6,$7,$6,0,0,0)
        ON CONFLICT (project_id, item_number) DO UPDATE SET qty_on_hand = EXCLUDED.qty_on_hand
        RETURNING id, item_number, project_id
      `, [id, si.proj, si.num, si.d1, si.uom, si.qty, si.cat]);
      stockItemIds[`${si.proj}:${si.num}`] = id;
    }
    log(`Stock items added: ${stockItems.length}`);

    // Refresh stockItemIds after upsert
    const { rows: actualStockItems } = await client.query(`
      SELECT id, project_id, item_number, description_1, uom, qty_on_hand
      FROM stock_items
      WHERE project_id IN ($1,$2,$3)
    `, [projSABIC, projAramco, projNEOM]);
    actualStockItems.forEach(s => { stockItemIds[`${s.project_id}:${s.item_number}`] = s.id; });

    // ─── 7. Material Requests ─────────────────────────────────────────────
    // Helper to get requester for project
    const getReq = (proj) => {
      if (proj === projSABIC) return userMap['EMP-4101'] || rq01;
      if (proj === projAramco) return userMap['EMP-4103'] || rq03;
      return userMap['EMP-4105'] || rq05;
    };
    const getReq2 = (proj) => {
      if (proj === projSABIC) return userMap['EMP-4102'] || rq02;
      if (proj === projAramco) return userMap['EMP-4104'] || rq04;
      return userMap['EMP-4106'] || rq06;
    };

    // Requests: mix of pending, issued, rejected, escalated
    const requests = [
      // SABIC — pending
      { id: randomUUID(), proj: projSABIC, req: getReq(projSABIC), status: 'pending', notes: 'Urgent — hydrotest scheduled next week', daysAgo: 2 },
      { id: randomUUID(), proj: projSABIC, req: getReq2(projSABIC), status: 'pending', notes: 'Routine monthly request', daysAgo: 1 },
      { id: randomUUID(), proj: projSABIC, req: getReq(projSABIC), status: 'issued', notes: 'Needed for catalyst loading', daysAgo: 7 },
      { id: randomUUID(), proj: projSABIC, req: getReq2(projSABIC), status: 'issued', notes: 'Pre-commissioning tools', daysAgo: 14 },
      { id: randomUUID(), proj: projSABIC, req: getReq(projSABIC), status: 'rejected', rejection_reason: 'Items not in approved project scope', notes: 'Off-scope request', daysAgo: 10 },
      // Aramco — mix
      { id: randomUUID(), proj: projAramco, req: getReq(projAramco), status: 'pending', notes: 'Flare test support equipment', daysAgo: 3 },
      { id: randomUUID(), proj: projAramco, req: getReq2(projAramco), status: 'pending', notes: 'Electrical grounding work', daysAgo: 1 },
      { id: randomUUID(), proj: projAramco, req: getReq(projAramco), status: 'issued', notes: 'Separator bypass installation', daysAgo: 5 },
      { id: randomUUID(), proj: projAramco, req: getReq2(projAramco), status: 'issued', notes: 'Emergency pump replacement', daysAgo: 12 },
      { id: randomUUID(), proj: projAramco, req: getReq(projAramco), status: 'issued', notes: 'Routine inspection tools', daysAgo: 20 },
      { id: randomUUID(), proj: projAramco, req: getReq2(projAramco), status: 'rejected', rejection_reason: 'Items already issued previously', notes: 'Duplicate request', daysAgo: 8 },
      // NEOM — mix
      { id: randomUUID(), proj: projNEOM, req: getReq(projNEOM), status: 'pending', notes: 'Site preparation equipment', daysAgo: 1 },
      { id: randomUUID(), proj: projNEOM, req: getReq2(projNEOM), status: 'pending', notes: 'Trenching support tools', daysAgo: 2 },
      { id: randomUUID(), proj: projNEOM, req: getReq(projNEOM), status: 'issued', notes: 'Cable installation batch 3', daysAgo: 6 },
      { id: randomUUID(), proj: projNEOM, req: getReq2(projNEOM), status: 'issued', notes: 'Foundation work tools', daysAgo: 18 },
      { id: randomUUID(), proj: projNEOM, req: getReq(projNEOM), status: 'issued', notes: 'Structural steel phase', daysAgo: 30 },
    ];

    for (const r of requests) {
      const createdAt = new Date(Date.now() - r.daysAgo * 86400000);
      await client.query(`
        INSERT INTO material_requests (id, project_id, requester_id, status, rejection_reason, notes, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
        ON CONFLICT DO NOTHING
      `, [r.id, r.proj, r.req, r.status, r.rejection_reason || null, r.notes, createdAt]);
    }
    log(`Material requests added: ${requests.length}`);

    // ─── 8. Request Items ─────────────────────────────────────────────────
    const reqItemsData = [
      // SABIC pending #1
      { reqIdx: 0, items: [
        { num: '125H400001', d1: 'HYDROTEST MANIFOLD - INLET', uom: 'EA', qty: 2 },
        { num: '125H400004', d1: 'HYDROTEST HAND PUMP 50 BAR', uom: 'EA', qty: 1 },
      ]},
      // SABIC pending #2
      { reqIdx: 1, items: [
        { num: '115L120003', d1: 'HAND TOOL LANYARD', uom: 'EA', qty: 20 },
        { num: '125B070003', d1: 'PERMIT BOX', uom: 'EA', qty: 3 },
      ]},
      // SABIC issued #3
      { reqIdx: 2, items: [
        { num: '125A250001', d1: 'ALUMINUM REFORMER BOX', uom: 'EA', qty: 4, issued: 4 },
        { num: '125S130001', d1: 'SAND CATCHER', uom: 'EA', qty: 5, issued: 5 },
      ]},
      // SABIC issued #4
      { reqIdx: 3, items: [
        { num: '115E110028', d1: 'DRILL MACHINE CORDLESS', uom: 'EA', qty: 2, issued: 2 },
        { num: '155E030001', d1: 'EARTHING CABLE WITH CLAMPS', uom: 'EA', qty: 10, issued: 10 },
      ]},
      // SABIC rejected #5
      { reqIdx: 4, items: [
        { num: '125U100005', d1: 'SCOOP ALUMINUM SMALL/BIG', uom: 'EA', qty: 15 },
      ]},
      // Aramco pending #6
      { reqIdx: 5, items: [
        { num: '125H400001', d1: 'HYDROTEST MANIFOLD - INLET', uom: 'EA', qty: 3 },
        { num: '155E030001', d1: 'EARTHING CABLE WITH CLAMPS', uom: 'EA', qty: 20 },
      ]},
      // Aramco pending #7
      { reqIdx: 6, items: [
        { num: '155B670005', d1: 'COPPER GROUND PLATE', uom: 'ST', qty: 10 },
        { num: '155E030001', d1: 'EARTHING CABLE WITH CLAMPS', uom: 'EA', qty: 15 },
      ]},
      // Aramco issued #8
      { reqIdx: 7, items: [
        { num: '125H400004', d1: 'HYDROTEST HAND PUMP 50 BAR', uom: 'EA', qty: 2, issued: 2 },
        { num: '125L260003', d1: 'DRUM LIFTER', uom: 'EA', qty: 1, issued: 1 },
      ]},
      // Aramco issued #9
      { reqIdx: 8, items: [
        { num: '115E110028', d1: 'DRILL MACHINE CORDLESS', uom: 'EA', qty: 4, issued: 4 },
        { num: '125B070004', d1: 'PSV WOODEN BOX', uom: 'EA', qty: 2, issued: 2 },
        { num: '125U100006', d1: 'LOADING FUNNEL [VARIOUS TYPE]', uom: 'EA', qty: 5, issued: 5 },
      ]},
      // Aramco issued #10
      { reqIdx: 9, items: [
        { num: '125A250001', d1: 'ALUMINUM REFORMER BOX', uom: 'EA', qty: 3, issued: 3 },
        { num: '125B070005', d1: 'PSV STEEL BOX', uom: 'EA', qty: 2, issued: 2 },
      ]},
      // Aramco rejected #11
      { reqIdx: 10, items: [
        { num: '115E110028', d1: 'DRILL MACHINE CORDLESS', uom: 'EA', qty: 3 },
      ]},
      // NEOM pending #12
      { reqIdx: 11, items: [
        { num: '125S130001', d1: 'SAND CATCHER', uom: 'EA', qty: 8 },
        { num: '125L260003', d1: 'DRUM LIFTER', uom: 'EA', qty: 2 },
      ]},
      // NEOM pending #13
      { reqIdx: 12, items: [
        { num: '115L120003', d1: 'HAND TOOL LANYARD', uom: 'EA', qty: 50 },
        { num: '125U100005', d1: 'SCOOP ALUMINUM SMALL/BIG', uom: 'EA', qty: 10 },
      ]},
      // NEOM issued #14
      { reqIdx: 13, items: [
        { num: '155E030001', d1: 'EARTHING CABLE WITH CLAMPS', uom: 'EA', qty: 20, issued: 20 },
        { num: '155B670005', d1: 'COPPER GROUND PLATE', uom: 'ST', qty: 8, issued: 8 },
      ]},
      // NEOM issued #15
      { reqIdx: 14, items: [
        { num: '115E110028', d1: 'DRILL MACHINE CORDLESS', uom: 'EA', qty: 5, issued: 5 },
        { num: '125B070003', d1: 'PERMIT BOX', uom: 'EA', qty: 4, issued: 4 },
        { num: '125A250001', d1: 'ALUMINUM REFORMER BOX', uom: 'EA', qty: 6, issued: 6 },
      ]},
      // NEOM issued #16
      { reqIdx: 15, items: [
        { num: '125H400004', d1: 'HYDROTEST HAND PUMP 50 BAR', uom: 'EA', qty: 3, issued: 3 },
        { num: '125L260003', d1: 'DRUM LIFTER', uom: 'EA', qty: 2, issued: 2 },
      ]},
    ];

    const requestItemIds = {};
    for (const ri of reqItemsData) {
      const req = requests[ri.reqIdx];
      for (const item of ri.items) {
        const riId = randomUUID();
        // Find stock item id
        const siId = stockItemIds[`${req.proj}:${item.num}`];
        await client.query(`
          INSERT INTO request_items (id, request_id, stock_item_id, item_number, description_1, uom, quantity_requested, quantity_issued)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT DO NOTHING
        `, [riId, req.id, siId || null, item.num, item.d1, item.uom, item.qty, item.issued || 0]);
        if (!requestItemIds[req.id]) requestItemIds[req.id] = [];
        requestItemIds[req.id].push({ riId, ...item, siId });
      }
    }
    log('Request items added');

    // ─── 9. Material Issues + Delivery Notes ──────────────────────────────
    const getSK = (proj) => {
      if (proj === projSABIC) return userMap['sk02'] || sk02;
      if (proj === projAramco) return userMap['sk03'] || sk03;
      return userMap['sk04'] || sk04;
    };

    let dnCounter = 10; // Start from DN-20260326-0010
    const issuedRequests = requests.filter(r => r.status === 'issued');
    for (const req of issuedRequests) {
      const issueId = randomUUID();
      const dnNumber = `DN-20260326-${String(dnCounter++).padStart(4,'0')}`;
      const issueDate = new Date(Date.now() - req.daysAgo * 86400000);

      await client.query(`
        INSERT INTO material_issues (id, request_id, project_id, storekeeper_id, receiver_id, issue_date, delivery_note_id, source, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'request',$8)
        ON CONFLICT DO NOTHING
      `, [issueId, req.id, req.proj, getSK(req.proj), req.req, issueDate, dnNumber, issueDate]);

      await client.query(`
        INSERT INTO delivery_notes (id, dn_number, issue_id, issued_by, created_at)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT DO NOTHING
      `, [randomUUID(), dnNumber, issueId, getSK(req.proj), issueDate]);

      // Insert issue_items
      const items = requestItemIds[req.id] || [];
      for (const item of items) {
        if (item.issued > 0) {
          await client.query(`
            INSERT INTO issue_items (id, issue_id, stock_item_id, item_number, description_1, uom, quantity_issued)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT DO NOTHING
          `, [randomUUID(), issueId, item.siId || null, item.num, item.d1, item.uom, item.issued]);
        }
      }
    }
    log(`Material issues + DNs added: ${issuedRequests.length}`);

    // ─── 10. Material Returns ─────────────────────────────────────────────
    // Get issue items to return
    const { rows: issueItemsToReturn } = await client.query(`
      SELECT ii.id, ii.issue_id, ii.stock_item_id, ii.item_number, ii.description_1, ii.uom, ii.quantity_issued, mi.project_id
      FROM issue_items ii
      JOIN material_issues mi ON mi.id = ii.issue_id
      WHERE mi.project_id IN ($1,$2,$3)
      ORDER BY RANDOM() LIMIT 8
    `, [projSABIC, projAramco, projNEOM]);

    for (let i = 0; i < Math.min(5, issueItemsToReturn.length); i++) {
      const item = issueItemsToReturn[i];
      const returnQty = Math.max(1, Math.floor(parseFloat(item.quantity_issued) / 2));
      await client.query(`
        INSERT INTO material_returns (id, issue_item_id, project_id, logged_by, quantity_returned, return_date, condition, notes, created_at)
        VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7,NOW())
        ON CONFLICT DO NOTHING
      `, [
        randomUUID(), item.id, item.project_id,
        getSK(item.project_id),
        returnQty,
        i % 3 === 0 ? 'damaged' : 'good',
        i % 3 === 0 ? 'Item returned with minor damage' : 'Good condition, cleaned and stored'
      ]);
    }
    log('Returns added');

    // ─── 11. WMS: More Dispatch Orders ────────────────────────────────────
    const { rows: bins } = await client.query(`SELECT id FROM wms_bins LIMIT 20`);
    const { rows: wmsItems } = await client.query(`SELECT id, item_number, description_1, uom FROM wms_item_master`);
    const { rows: wmUsers } = await client.query(`SELECT id FROM users WHERE role IN ('warehouse_manager','admin') LIMIT 2`);

    const doStatuses = ['draft','confirmed','dispatched','cancelled'];
    const destinations = ['Aramco X - Ras Tanura','SABIC Ethylene - Jubail','NEOM Site - Tabuk','Aramco Gas - Dhahran','Client Warehouse - Riyadh'];

    for (let i = 0; i < 12; i++) {
      const doId = randomUUID();
      const doNum = `DO-${5000 + i}`;
      const status = doStatuses[i % 4];
      const createdBy = wmUsers[0]?.id;
      const daysAgo = i * 3 + 1;
      const createdAt = new Date(Date.now() - daysAgo * 86400000);

      const doResult = await client.query(`
        INSERT INTO wms_dispatch_orders (id, order_number, destination, notes, status, created_by, confirmed_by, confirmed_at, dispatched_by, dispatched_at, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
        ON CONFLICT (order_number) DO UPDATE SET updated_at = NOW()
        RETURNING id
      `, [
        doId, doNum,
        destinations[i % destinations.length],
        `Dispatch batch ${i + 1} — ${doStatuses[i % 4]}`,
        status,
        createdBy,
        status !== 'draft' ? createdBy : null,
        status !== 'draft' ? new Date(createdAt.getTime() + 3600000) : null,
        status === 'dispatched' ? createdBy : null,
        status === 'dispatched' ? new Date(createdAt.getTime() + 7200000) : null,
        createdAt
      ]);
      const realDoId = doResult.rows[0].id;

      // Add 2-3 items per dispatch order
      const numItems = 2 + (i % 2);
      for (let j = 0; j < numItems; j++) {
        const wmsItem = wmsItems[(i + j) % wmsItems.length];
        const binId = bins.length > 0 ? bins[(i + j) % bins.length].id : null;
        await client.query(`
          INSERT INTO wms_dispatch_items (id, dispatch_order_id, item_master_id, bin_id, qty_requested, qty_dispatched)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT DO NOTHING
        `, [
          randomUUID(), realDoId, wmsItem.id, binId,
          5 + j * 2,
          status === 'dispatched' ? 5 + j * 2 : 0
        ]);
      }
    }
    log('WMS dispatch orders added: 12');

    // ─── 12. WMS: More Cycle Counts ───────────────────────────────────────
    const { rows: allBins } = await client.query(`SELECT id, code FROM wms_bins LIMIT 48`);
    const ccStatuses = ['open', 'counting', 'completed', 'completed'];

    for (let i = 0; i < 6; i++) {
      const ccId = randomUUID();
      const daysAgo = i * 5 + 2;
      const createdAt = new Date(Date.now() - daysAgo * 86400000);
      const status = ccStatuses[i % ccStatuses.length];

      await client.query(`
        INSERT INTO wms_cycle_counts (id, count_number, zone_id, status, created_by, completed_by, completed_at, notes, created_at)
        VALUES ($1,$2,(SELECT id FROM wms_zones LIMIT 1 OFFSET $3),$4,$5,$6,$7,$8,$9)
        ON CONFLICT DO NOTHING
      `, [
        ccId,
        `CC-${2000 + i}`,
        i % 4,
        status,
        wmUsers[0]?.id,
        status === 'completed' ? wmUsers[0]?.id : null,
        status === 'completed' ? new Date(createdAt.getTime() + 86400000) : null,
        `Zone ${String.fromCharCode(65 + (i % 4))} cycle count — Q${Math.ceil((i+1)/3)} 2026`,
        createdAt
      ]);

      // Add 4-6 items per cycle count
      const binsForCC = allBins.slice(i * 6, i * 6 + 6);
      for (const bin of binsForCC) {
        const wmsItem = wmsItems[Math.floor(Math.random() * wmsItems.length)];
        const systemQty = 20 + Math.floor(Math.random() * 30);
        const variance = status === 'completed' ? (Math.random() > 0.7 ? Math.floor(Math.random() * 5) - 2 : 0) : 0;
        const countedQty = status === 'completed' ? systemQty + variance : null;
        await client.query(`
          INSERT INTO wms_cycle_count_items (id, cycle_count_id, bin_id, item_master_id, expected_qty, counted_qty, notes, counted_by, counted_at, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT DO NOTHING
        `, [
          randomUUID(), ccId, bin.id, wmsItem.id,
          systemQty,
          countedQty,
          status === 'completed' ? (variance !== 0 ? `Variance of ${variance} found` : 'Matched system quantity') : null,
          status === 'completed' ? wmUsers[0]?.id : null,
          status === 'completed' ? new Date(createdAt.getTime() + 86400000) : null,
          createdAt
        ]);
      }
    }
    log('WMS cycle counts added: 6');

    await client.query('COMMIT');
    log('✓ All demo data committed successfully');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[demo_seed] ERROR:', err.message);
    console.error(err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
