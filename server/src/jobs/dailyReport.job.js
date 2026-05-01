const cron = require('node-cron');
const db = require('../config/db');
const dailyReportService = require('../services/dailyReport.service');

cron.schedule('* * * * *', async () => {
  try {
    const { rows: settings } = await db.query(`SELECT value FROM system_settings WHERE key = 'daily_report_time'`);
    const reportTime = settings[0]?.value || '08:00';
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    if (hhmm !== reportTime) return;

    await dailyReportService.generate({ date: now.toISOString().slice(0, 10), sendEmail: true });
  } catch (err) {
    console.error('Daily report job error:', err.message);
  }
});

console.log('✅ Daily report cron job started');
