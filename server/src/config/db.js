require('dotenv').config();
const { Pool, types } = require('pg');

// Return DATE columns as plain "YYYY-MM-DD" strings instead of JS Date objects
// which shift dates back by the UTC offset (e.g. +3 → shows yesterday)
types.setTypeParser(1082, val => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/site_inventory',
});

module.exports = pool;
