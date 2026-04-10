const db = require('../config/db');

/**
 * GET /api/transactions/:ref
 * Accept any REQ-YYYY-NNNN, DN-YYYY-NNNN, or RET-YYYY-NNNN and return
 * the full linked chain: request → issue(s) → returns.
 */
exports.getHistory = async (req, res, next) => {
  try {
    const ref = (req.params.ref || '').toUpperCase().trim();

    if (ref.startsWith('REQ-')) {
      return res.json(await buildFromRequest({ request_number: ref }));
    }
    if (ref.startsWith('DN-')) {
      return res.json(await buildFromIssue({ delivery_note_id: ref }));
    }
    if (ref.startsWith('RET-')) {
      return res.json(await buildFromReturn({ return_number: ref }));
    }

    return res.status(400).json({ error: 'Invalid reference number format. Use REQ-YYYY-NNNN, DN-YYYY-NNNN, or RET-YYYY-NNNN' });
  } catch (err) { next(err); }
};

// ─── builders ───────────────────────────────────────────────────────────────

async function buildFromRequest(filter) {
  const { rows: reqs } = await db.query(
    `SELECT r.id, r.request_number, r.status, r.notes, r.created_at, r.updated_at,
            p.name as project_name,
            u.name as requester_name, u.position as requester_position
     FROM material_requests r
     JOIN projects p ON p.id = r.project_id
     JOIN users u ON u.id = r.requester_id
     WHERE r.request_number = $1`,
    [filter.request_number]
  );
  if (!reqs[0]) return null;

  const request = reqs[0];
  const { rows: reqItems } = await db.query(
    `SELECT item_number, description_1, description_2, uom, quantity_requested, quantity_issued
     FROM request_items WHERE request_id = $1 ORDER BY description_1`,
    [request.id]
  );

  const issues = await getIssuesForRequest(request.id);
  return { type: 'REQ', ref: request.request_number, request: { ...request, items: reqItems }, issues };
}

async function buildFromIssue(filter) {
  const { rows: iss } = await db.query(
    `SELECT i.id, i.delivery_note_id, i.issue_date, i.created_at,
            p.name as project_name,
            sk.name as storekeeper_name,
            rc.name as receiver_name, rc.position as receiver_position,
            mr.request_number
     FROM material_issues i
     JOIN projects p ON p.id = i.project_id
     JOIN users sk ON sk.id = i.storekeeper_id
     LEFT JOIN users rc ON rc.id = i.receiver_id
     LEFT JOIN material_requests mr ON mr.id = i.request_id
     WHERE i.delivery_note_id = $1`,
    [filter.delivery_note_id]
  );
  if (!iss[0]) return null;

  const issue = iss[0];
  const { rows: issItems } = await db.query(
    `SELECT ii.id, ii.item_number, ii.description_1, ii.description_2, ii.uom,
            ii.quantity_issued, ii.batch_number
     FROM issue_items ii WHERE ii.issue_id = $1 ORDER BY ii.description_1`,
    [issue.id]
  );

  const returns = await getReturnsForIssue(issue.id);

  let request = null;
  if (issue.request_number) {
    const { rows: reqs } = await db.query(
      `SELECT r.request_number, r.status, r.created_at, u.name as requester_name
       FROM material_requests r
       JOIN users u ON u.id = r.requester_id
       WHERE r.request_number = $1`,
      [issue.request_number]
    );
    request = reqs[0] || null;
  }

  return {
    type: 'DN',
    ref: issue.delivery_note_id,
    issue: { ...issue, items: issItems },
    request,
    returns,
  };
}

async function buildFromReturn(filter) {
  const { rows: rets } = await db.query(
    `SELECT r.id, r.return_number, r.quantity_returned, r.condition, r.notes, r.return_date, r.created_at,
            p.name as project_name,
            lb.name as logged_by_name,
            ii.item_number, ii.description_1, ii.description_2, ii.uom,
            i.delivery_note_id,
            mr.request_number
     FROM material_returns r
     JOIN projects p ON p.id = r.project_id
     JOIN users lb ON lb.id = r.logged_by
     JOIN issue_items ii ON ii.id = r.issue_item_id
     JOIN material_issues i ON i.id = ii.issue_id
     LEFT JOIN material_requests mr ON mr.id = i.request_id
     WHERE r.return_number = $1`,
    [filter.return_number]
  );
  if (!rets[0]) return null;

  const ret = rets[0];
  return {
    type: 'RET',
    ref: ret.return_number,
    return: ret,
    linked_dn: ret.delivery_note_id,
    linked_req: ret.request_number || null,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function getIssuesForRequest(requestId) {
  const { rows: issues } = await db.query(
    `SELECT i.id, i.delivery_note_id, i.issue_date,
            sk.name as storekeeper_name,
            rc.name as receiver_name
     FROM material_issues i
     JOIN users sk ON sk.id = i.storekeeper_id
     LEFT JOIN users rc ON rc.id = i.receiver_id
     WHERE i.request_id = $1`,
    [requestId]
  );

  for (const issue of issues) {
    const { rows: items } = await db.query(
      `SELECT item_number, description_1, uom, quantity_issued, batch_number
       FROM issue_items WHERE issue_id = $1`,
      [issue.id]
    );
    issue.items = items;
    issue.returns = await getReturnsForIssue(issue.id);
  }
  return issues;
}

async function getReturnsForIssue(issueId) {
  const { rows } = await db.query(
    `SELECT r.return_number, r.quantity_returned, r.condition, r.notes, r.return_date,
            lb.name as logged_by_name,
            ii.item_number, ii.description_1, ii.uom
     FROM material_returns r
     JOIN issue_items ii ON ii.id = r.issue_item_id
     JOIN users lb ON lb.id = r.logged_by
     WHERE ii.issue_id = $1
     ORDER BY r.return_date ASC`,
    [issueId]
  );
  return rows;
}
