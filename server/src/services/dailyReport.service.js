const db = require('../config/db');
const emailService = require('./email.service');

async function buildReport(projectId, date) {
  const issued = await db.query(
    `SELECT COUNT(*)::int AS c FROM material_issues WHERE project_id = $1 AND issue_date = $2`,
    [projectId, date]
  );
  const returned = await db.query(
    `SELECT COUNT(*)::int AS c FROM material_returns WHERE project_id = $1 AND return_date = $2`,
    [projectId, date]
  );
  const pending = await db.query(
    `SELECT COUNT(*)::int AS c FROM issue_items ii JOIN material_issues i ON i.id = ii.issue_id
     WHERE i.project_id = $1 AND ii.quantity_issued > COALESCE(
       (SELECT SUM(r.quantity_returned) FROM material_returns r WHERE r.issue_item_id = ii.id), 0)`,
    [projectId]
  );
  return {
    issued_count: issued.rows[0].c,
    returned_count: returned.rows[0].c,
    pending_count: pending.rows[0].c,
    overdue_count: 0,
  };
}

async function recipientsFor(projectId) {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email FROM users u
     JOIN project_storekeepers ps ON ps.user_id = u.id
     WHERE ps.project_id = $1 AND u.notify_email = true AND u.is_active = true
     UNION
     SELECT id, name, email FROM users WHERE role = 'superuser' AND notify_email = true AND is_active = true`,
    [projectId]
  );
  return rows;
}

/**
 * Generate the daily report for every active project on `date` (YYYY-MM-DD).
 * - Skips projects with no issue/return activity that day.
 * - Sends emails when `sendEmail` is true.
 * - Upserts into daily_reports so re-runs update the row in place.
 * Returns a summary { processed, skipped, projects: [...] }.
 */
exports.generate = async ({ date, sendEmail = true } = {}) => {
  if (!date) date = new Date().toISOString().slice(0, 10);

  const { rows: projects } = await db.query(
    `SELECT id, name FROM projects WHERE is_active = true`
  );

  const summary = { date, processed: 0, skipped: 0, projects: [] };

  for (const project of projects) {
    const counts = await buildReport(project.id, date);

    if (counts.issued_count === 0 && counts.returned_count === 0) {
      summary.skipped++;
      continue;
    }

    if (sendEmail) {
      const users = await recipientsFor(project.id);
      const emailReport = { date, project_name: project.name, ...counts };
      for (const user of users) {
        try { await emailService.sendDailyReport(user, emailReport); }
        catch (err) { console.error(`Daily report email failed for ${user.email}:`, err.message); }
      }
    }

    await db.query(
      `INSERT INTO daily_reports
         (report_date, project_id, issued_count, returned_count, pending_count, overdue_count, sent_at, channel)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7)
       ON CONFLICT (report_date, project_id) DO UPDATE SET
         issued_count   = EXCLUDED.issued_count,
         returned_count = EXCLUDED.returned_count,
         pending_count  = EXCLUDED.pending_count,
         overdue_count  = EXCLUDED.overdue_count,
         sent_at        = EXCLUDED.sent_at,
         channel        = EXCLUDED.channel`,
      [date, project.id, counts.issued_count, counts.returned_count,
       counts.pending_count, counts.overdue_count, sendEmail ? 'email' : 'manual']
    );

    summary.processed++;
    summary.projects.push({ project_id: project.id, project_name: project.name, ...counts });
  }

  return summary;
};
