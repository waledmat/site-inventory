/**
 * reset_test_passwords.js
 * Lists all users and resets every password to:  Test@1234
 * Run:  node reset_test_passwords.js
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/site_inventory',
});

const TEST_PASSWORD = 'Test@1234';

async function run() {
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);

  const { rows: users } = await pool.query(
    `SELECT id, employee_id, name, role, position, is_active FROM users ORDER BY role, name`
  );

  if (!users.length) {
    console.log('No users found in the database.');
    await pool.end();
    return;
  }

  // Reset all passwords
  await pool.query(`UPDATE users SET password_hash = $1`, [hash]);

  console.log('\n========================================');
  console.log('  ALL USERS — Test Password: Test@1234  ');
  console.log('========================================\n');
  console.log(
    'Employee ID'.padEnd(16) +
    'Name'.padEnd(25) +
    'Role'.padEnd(14) +
    'Position'.padEnd(25) +
    'Active'
  );
  console.log('-'.repeat(90));

  for (const u of users) {
    console.log(
      String(u.employee_id || '—').padEnd(16) +
      String(u.name).padEnd(25) +
      String(u.role).padEnd(14) +
      String(u.position || '—').padEnd(25) +
      (u.is_active ? 'Yes' : 'No')
    );
  }

  console.log('\n----------------------------------------');
  console.log(`Total: ${users.length} users`);
  console.log(`Password reset to: ${TEST_PASSWORD}`);
  console.log('----------------------------------------\n');

  await pool.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
