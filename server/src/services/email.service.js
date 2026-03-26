const nodemailer = require('nodemailer');
const db = require('../config/db');

async function getTransport() {
  const { rows } = await db.query('SELECT key, value FROM system_settings WHERE key LIKE $1', ['smtp%']);
  const cfg = {};
  rows.forEach(r => { cfg[r.key] = r.value; });
  return nodemailer.createTransport({
    host: cfg.smtp_host || 'smtp.gmail.com',
    port: parseInt(cfg.smtp_port || '587'),
    secure: false,
    auth: { user: cfg.smtp_user, pass: cfg.smtp_pass }
  });
}

exports.sendDailyReport = async (user, report) => {
  try {
    const { rows: fromRows } = await db.query(`SELECT value FROM system_settings WHERE key = 'report_from_email'`);
    const from = fromRows[0]?.value || 'reports@siteinventory.com';
    const transport = await getTransport();

    const html = `
      <h2>📋 Daily Site Material Report — ${report.date}</h2>
      <h3>🏗️ Project: ${report.project_name}</h3>
      <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
        <tr><th>Metric</th><th>Count</th></tr>
        <tr><td>📤 Issued Today</td><td>${report.issued_count}</td></tr>
        <tr><td>📥 Returned Today</td><td>${report.returned_count}</td></tr>
        <tr><td>⏳ Pending Returns</td><td>${report.pending_count}</td></tr>
        <tr><td style="color:red">⚠️ Overdue</td><td style="color:red">${report.overdue_count}</td></tr>
      </table>
    `;

    await transport.sendMail({
      from, to: user.email,
      subject: `Daily Material Report — ${report.date} — ${report.project_name}`,
      html
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
};
