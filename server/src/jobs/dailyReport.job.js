const cron = require('node-cron');
const db = require('../config/db');
const emailService = require('../services/email.service');

cron.schedule('* * * * *', async () => {
  try {
    const { rows: settings } = await db.query(`SELECT value FROM system_settings WHERE key = 'daily_report_time'`);
    const reportTime = settings[0]?.value || '08:00';
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    if (hhmm !== reportTime) return;

    const today = now.toISOString().slice(0, 10);
    const { rows: projects } = await db.query(`SELECT id, name FROM projects WHERE is_active = true`);

    for (const project of projects) {
      const issued = await db.query(
        `SELECT COUNT(*) as c FROM material_issues WHERE project_id = $1 AND issue_date = $2`,
        [project.id, today]
      );
      const returned = await db.query(
        `SELECT COUNT(*) as c FROM material_returns WHERE project_id = $1 AND return_date = $2`,
        [project.id, today]
      );
      const pending = await db.query(
        `SELECT COUNT(*) as c FROM issue_items ii JOIN material_issues i ON i.id = ii.issue_id
         WHERE i.project_id = $1 AND ii.quantity_issued > COALESCE(
           (SELECT SUM(r.quantity_returned) FROM material_returns r WHERE r.issue_item_id = ii.id),0)`,
        [project.id]
      );

      const report = {
        date: today, project_name: project.name,
        issued_count: parseInt(issued.rows[0].c),
        returned_count: parseInt(returned.rows[0].c),
        pending_count: parseInt(pending.rows[0].c),
        overdue_count: 0
      };

      if (report.issued_count === 0 && report.returned_count === 0) continue;

      // Get storekeepers + superusers to notify
      const { rows: users } = await db.query(
        `SELECT u.id, u.name, u.email FROM users u
         JOIN project_storekeepers ps ON ps.user_id = u.id
         WHERE ps.project_id = $1 AND u.notify_email = true AND u.is_active = true
         UNION
         SELECT id, name, email FROM users WHERE role = 'superuser' AND notify_email = true AND is_active = true`,
        [project.id]
      );

      for (const user of users) {
        await emailService.sendDailyReport(user, report);
      }

      await db.query(
        `INSERT INTO daily_reports (report_date, project_id, issued_count, returned_count, pending_count, overdue_count, sent_at, channel)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),'email')`,
        [today, project.id, report.issued_count, report.returned_count, report.pending_count, report.overdue_count]
      );
    }
  } catch (err) {
    console.error('Daily report job error:', err.message);
  }
});

console.log('✅ Daily report cron job started');
