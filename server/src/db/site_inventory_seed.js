/**
 * site_inventory_seed.js — Demo data for Site Inventory (no WMS)
 * Run: node src/db/site_inventory_seed.js
 */
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost/site_inventory' });
const log = (msg) => console.log(`[site_seed] ${msg}`);

const DN_PREFIX = 'DN-20260407';
let dnCounter = 1;
const nextDN = () => `${DN_PREFIX}-${String(dnCounter++).padStart(4, '0')}`;

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Load existing projects + their storekeepers / requesters ──────────
    const { rows: projects } = await client.query(`
      SELECT p.id, p.name, p.project_number,
        array_agg(DISTINCT ps.user_id) FILTER (WHERE ps.user_id IS NOT NULL) AS storekeepers,
        array_agg(DISTINCT pr.user_id) FILTER (WHERE pr.user_id IS NOT NULL) AS requesters
      FROM projects p
      LEFT JOIN project_storekeepers ps ON ps.project_id = p.id
      LEFT JOIN project_requesters   pr ON pr.project_id = p.id
      GROUP BY p.id
    `);

    log(`Loaded ${projects.length} projects`);
    const projMap = {};
    projects.forEach(p => { projMap[p.project_number] = p; });

    const P = {
      aramcoX:  projMap['4500'],
      sabic:    projMap['5600'],
      aramcoG:  projMap['6200'],
      neom:     projMap['7800'],
    };

    // Helper: get first SK / requester for a project
    const sk  = (p) => p.storekeepers?.[0];
    const req = (p, i = 0) => p.requesters?.[i % (p.requesters?.length || 1)];

    // ── Load stock items per project ──────────────────────────────────────
    const { rows: allStock } = await client.query(`
      SELECT id, project_id, item_number, description_1, uom, qty_on_hand
      FROM stock_items
      WHERE qty_on_hand > 3
      ORDER BY project_id, qty_on_hand DESC
    `);

    // Group by project
    const stockByProj = {};
    allStock.forEach(s => {
      if (!stockByProj[s.project_id]) stockByProj[s.project_id] = [];
      stockByProj[s.project_id].push(s);
    });

    const pickStockItems = (projId, count = 3) => {
      const items = stockByProj[projId] || [];
      const result = [];
      for (let i = 0; i < count && i < items.length; i++) {
        result.push(items[i]);
      }
      return result;
    };

    // ── Material Requests ──────────────────────────────────────────────────
    // 40 requests across 4 projects — mix of pending / issued / rejected / escalated
    const requestDefs = [
      // ── ARAMCO X (project 4500) ─────────────────────────────────────────
      { proj: P.aramcoX, reqIdx: 0, status: 'issued',   days: 35, notes: 'Pre-commissioning inspection tools' },
      { proj: P.aramcoX, reqIdx: 0, status: 'issued',   days: 28, notes: 'Catalyst loading equipment batch 1' },
      { proj: P.aramcoX, reqIdx: 0, status: 'issued',   days: 21, notes: 'Hydrotest support — header section' },
      { proj: P.aramcoX, reqIdx: 0, status: 'issued',   days: 15, notes: 'Earthing works package A' },
      { proj: P.aramcoX, reqIdx: 0, status: 'issued',   days: 12, notes: 'Safety barrier installation' },
      { proj: P.aramcoX, reqIdx: 0, status: 'issued',   days: 8,  notes: 'Control valve installation tools' },
      { proj: P.aramcoX, reqIdx: 0, status: 'rejected', days: 18, notes: 'Non-standard item — not in BOM', rejection_reason: 'Item not in approved project scope' },
      { proj: P.aramcoX, reqIdx: 0, status: 'escalated',days: 5,  notes: 'URGENT — flare tip replacement support' },
      { proj: P.aramcoX, reqIdx: 0, status: 'pending',  days: 3,  notes: 'Routine tool replenishment — week 14' },
      { proj: P.aramcoX, reqIdx: 0, status: 'pending',  days: 1,  notes: 'Pipe flushing equipment — final phase' },

      // ── SABIC ETHYLENE (project 5600) ───────────────────────────────────
      { proj: P.sabic, reqIdx: 0, status: 'issued',   days: 40, notes: 'Reformer box installation batch A' },
      { proj: P.sabic, reqIdx: 0, status: 'issued',   days: 32, notes: 'Hydrotest manifold setup' },
      { proj: P.sabic, reqIdx: 1, status: 'issued',   days: 25, notes: 'Earthing cable installation phase 2' },
      { proj: P.sabic, reqIdx: 0, status: 'issued',   days: 19, notes: 'Permit box allocation — new work areas' },
      { proj: P.sabic, reqIdx: 1, status: 'issued',   days: 13, notes: 'Drill machines for structural phase' },
      { proj: P.sabic, reqIdx: 0, status: 'issued',   days: 7,  notes: 'Sand catcher installation — tank farm' },
      { proj: P.sabic, reqIdx: 1, status: 'rejected', days: 22, notes: 'Qty exceeds project allocation', rejection_reason: 'Requested quantity exceeds approved project limit' },
      { proj: P.sabic, reqIdx: 0, status: 'rejected', days: 14, notes: 'Duplicate request already issued', rejection_reason: 'Items already issued under DN-20260326-0011' },
      { proj: P.sabic, reqIdx: 1, status: 'escalated',days: 4,  notes: 'Reformer box — additional qty required for scope change' },
      { proj: P.sabic, reqIdx: 0, status: 'pending',  days: 2,  notes: 'Weekly tool request — maintenance crew' },

      // ── ARAMCO GAS PROCESSING (project 6200) ────────────────────────────
      { proj: P.aramcoG, reqIdx: 0, status: 'issued',   days: 38, notes: 'Gas separator installation — first batch' },
      { proj: P.aramcoG, reqIdx: 1, status: 'issued',   days: 30, notes: 'Copper grounding works phase 1' },
      { proj: P.aramcoG, reqIdx: 0, status: 'issued',   days: 22, notes: 'Drum lifter for heavy equipment bay' },
      { proj: P.aramcoG, reqIdx: 1, status: 'issued',   days: 16, notes: 'PSV box installation — compressor area' },
      { proj: P.aramcoG, reqIdx: 0, status: 'issued',   days: 10, notes: 'Loading funnel set — tank filling station' },
      { proj: P.aramcoG, reqIdx: 1, status: 'issued',   days: 6,  notes: 'Hydrotest pump — piping integrity check' },
      { proj: P.aramcoG, reqIdx: 0, status: 'rejected', days: 20, notes: 'Item not on approved vendor list', rejection_reason: 'Vendor not on approved vendor list' },
      { proj: P.aramcoG, reqIdx: 1, status: 'escalated',days: 3,  notes: 'CRITICAL — earthing cables damaged in storage, urgent replacement' },
      { proj: P.aramcoG, reqIdx: 0, status: 'pending',  days: 2,  notes: 'Monthly replenishment — electrical department' },
      { proj: P.aramcoG, reqIdx: 1, status: 'pending',  days: 1,  notes: 'Pipe flushing kit — LPG section' },

      // ── NEOM INFRASTRUCTURE (project 7800) ──────────────────────────────
      { proj: P.neom, reqIdx: 0, status: 'issued',   days: 42, notes: 'Initial site setup — tool kit batch 1' },
      { proj: P.neom, reqIdx: 1, status: 'issued',   days: 33, notes: 'Earthing cable — solar farm section A' },
      { proj: P.neom, reqIdx: 0, status: 'issued',   days: 26, notes: 'Hand tool lanyards — height work crew' },
      { proj: P.neom, reqIdx: 1, status: 'issued',   days: 18, notes: 'Copper ground plates — substation 3' },
      { proj: P.neom, reqIdx: 0, status: 'issued',   days: 11, notes: 'Drill machines for concrete anchoring' },
      { proj: P.neom, reqIdx: 1, status: 'issued',   days: 6,  notes: 'Scoop aluminum set — excavation team' },
      { proj: P.neom, reqIdx: 0, status: 'rejected', days: 17, notes: 'Wrong project code on request', rejection_reason: 'Incorrect project number — resubmit with correct reference' },
      { proj: P.neom, reqIdx: 1, status: 'escalated',days: 4,  notes: 'Hand lanyards running low — 80 workers on-site need replacements' },
      { proj: P.neom, reqIdx: 0, status: 'pending',  days: 2,  notes: 'Infrastructure phase 3 preparation tools' },
      { proj: P.neom, reqIdx: 1, status: 'pending',  days: 1,  notes: 'Permit boxes — new work zones opening' },
    ];

    // Insert requests and collect IDs
    const insertedRequests = [];
    for (const def of requestDefs) {
      if (!def.proj) { log(`SKIP: missing project`); continue; }
      const requester = req(def.proj, def.reqIdx);
      if (!requester) { log(`SKIP: no requester for project ${def.proj.name}`); continue; }

      const id = randomUUID();
      const createdAt = daysAgo(def.days);
      await client.query(`
        INSERT INTO material_requests (id, project_id, requester_id, status, rejection_reason, notes, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
        ON CONFLICT DO NOTHING
      `, [id, def.proj.id, requester, def.status, def.rejection_reason || null, def.notes, createdAt]);

      insertedRequests.push({ id, ...def, requester });
    }
    log(`Requests inserted: ${insertedRequests.length}`);

    // ── Request Items ──────────────────────────────────────────────────────
    const insertedRequestItems = {}; // requestId → [{riId, stockItem, qty, issued}]

    for (const r of insertedRequests) {
      const stockItems = pickStockItems(r.proj.id, 2 + Math.floor(Math.random() * 2));
      if (!stockItems.length) continue;

      insertedRequestItems[r.id] = [];
      for (const si of stockItems) {
        const qty = Math.min(Math.floor(parseFloat(si.qty_on_hand) * 0.15) + 2, 15);
        const issuedQty = r.status === 'issued' ? qty : 0;
        const riId = randomUUID();

        await client.query(`
          INSERT INTO request_items (id, request_id, stock_item_id, item_number, description_1, uom, quantity_requested, quantity_issued)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT DO NOTHING
        `, [riId, r.id, si.id, si.item_number, si.description_1, si.uom, qty, issuedQty || null]);

        insertedRequestItems[r.id].push({ riId, stockItem: si, qty, issued: issuedQty });
      }
    }
    log('Request items inserted');

    // ── Material Issues + Delivery Notes + Issue Items ─────────────────────
    const issuedRequests = insertedRequests.filter(r => r.status === 'issued');
    const insertedIssueItems = []; // [{id, issueId, stockItem, qty, projId}]

    for (const r of issuedRequests) {
      const issueId = randomUUID();
      const dnNumber = nextDN();
      const issueDate = daysAgo(r.days - 1); // issued a day after request

      await client.query(`
        INSERT INTO material_issues (id, request_id, project_id, storekeeper_id, receiver_id, issue_date, delivery_note_id, source, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'request',$8)
        ON CONFLICT DO NOTHING
      `, [issueId, r.id, r.proj.id, sk(r.proj), r.requester, issueDate, dnNumber, issueDate]);

      await client.query(`
        INSERT INTO delivery_notes (id, dn_number, issue_id, issued_by, created_at)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT DO NOTHING
      `, [randomUUID(), dnNumber, issueId, sk(r.proj), issueDate]);

      const items = insertedRequestItems[r.id] || [];
      for (const item of items) {
        if (!item.issued) continue;
        const iiId = randomUUID();
        await client.query(`
          INSERT INTO issue_items (id, issue_id, stock_item_id, item_number, description_1, uom, quantity_issued)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT DO NOTHING
        `, [iiId, issueId, item.stockItem.id, item.stockItem.item_number, item.stockItem.description_1, item.stockItem.uom, item.issued]);

        insertedIssueItems.push({ id: iiId, issueId, stockItem: item.stockItem, qty: item.issued, projId: r.proj.id, sk: sk(r.proj) });
      }
    }
    log(`Issues + DNs inserted: ${issuedRequests.length}`);

    // ── Material Returns ───────────────────────────────────────────────────
    // Return ~30% of issued items (mix of good / damaged / lost)
    const conditions = ['good', 'good', 'good', 'damaged', 'lost'];
    const returnNotes = [
      'Cleaned and returned to storage',
      'Good condition, ready for reuse',
      'Returned after work completion',
      'Minor surface damage, still functional',
      'Item lost on-site — replacement required',
      'Returned with full inventory check',
    ];

    let returnCount = 0;
    for (let i = 0; i < insertedIssueItems.length; i++) {
      if (i % 3 !== 0) continue; // return every 3rd issue item
      const ii = insertedIssueItems[i];
      const returnQty = Math.max(1, Math.ceil(ii.qty * 0.5));
      const cond = conditions[i % conditions.length];

      await client.query(`
        INSERT INTO material_returns (id, issue_item_id, project_id, logged_by, quantity_returned, return_date, condition, notes, created_at)
        VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7,NOW())
        ON CONFLICT DO NOTHING
      `, [
        randomUUID(), ii.id, ii.projId, ii.sk,
        returnQty, cond,
        returnNotes[i % returnNotes.length]
      ]);
      returnCount++;
    }
    log(`Returns inserted: ${returnCount}`);

    await client.query('COMMIT');
    log('✓ Site inventory demo data committed successfully');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[site_seed] ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
