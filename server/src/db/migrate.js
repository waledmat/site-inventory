require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/site_inventory';

async function migrate() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await client.query(sql);
    console.log(`  ✅ ${file} done`);
  }

  await client.end();
  console.log('\n✅ All migrations complete');
}

migrate().catch(err => { console.error(err); process.exit(1); });
