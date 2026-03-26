/**
 * run_migration.js — applies pending migrations
 * Run:  node run_migration.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/site_inventory',
});

async function run() {
  const migrationsDir = path.join(__dirname, 'src/db/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  // Create tracking table if needed
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const { rows: applied } = await pool.query('SELECT filename FROM _migrations');
  const appliedSet = new Set(applied.map(r => r.filename));

  let ran = 0;
  for (const file of files) {
    if (appliedSet.has(file)) { console.log(`  skip  ${file}`); continue; }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      console.log(`  ✅ applied  ${file}`);
      ran++;
    } catch (err) {
      console.error(`  ❌ FAILED   ${file}: ${err.message}`);
      break;
    }
  }

  if (ran === 0) console.log('\nAll migrations already up to date.');
  else console.log(`\n${ran} migration(s) applied.`);
  await pool.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
