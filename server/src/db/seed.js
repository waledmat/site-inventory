require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/site_inventory';

async function seed() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const password_hash = await bcrypt.hash('Admin@1234', 10);

  await client.query(`
    INSERT INTO users (name, employee_id, role, email, password_hash, position, is_active)
    VALUES ($1, $2, 'admin', $3, $4, 'System Administrator', true)
    ON CONFLICT (email) DO UPDATE SET employee_id = EXCLUDED.employee_id, password_hash = EXCLUDED.password_hash
  `, ['Admin User', '73106302', 'admin@siteinventory.com', password_hash]);

  console.log('✅ Seed complete');
  console.log('   Employee ID: 73106302');
  console.log('   Password:    Admin@1234');

  await client.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
