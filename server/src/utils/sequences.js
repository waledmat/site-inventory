/**
 * Atomically advance a yearly-resetting PostgreSQL sequence and return a formatted ref.
 * Must be called within an open transaction (after BEGIN).
 *
 * @param {object} client   - pg PoolClient inside a transaction
 * @param {string} seqName  - PostgreSQL sequence name: 'req_seq' | 'ret_seq' | 'dn_seq'
 * @param {string} yearKey  - system_settings key: 'req_seq_year' | 'ret_seq_year'
 * @param {string} prefix   - 'REQ' | 'RET' | 'DN'
 * @returns {Promise<string>} e.g. 'REQ-2026-0001'
 */
async function nextRef(client, seqName, yearKey, prefix) {
  const year = new Date().getFullYear();

  // Lock the year-tracking row so concurrent requests can't double-reset
  const { rows } = await client.query(
    `SELECT value FROM system_settings WHERE key = $1 FOR UPDATE`,
    [yearKey]
  );

  const storedYear = rows[0] ? parseInt(rows[0].value, 10) : null;

  if (storedYear !== year) {
    await client.query(`ALTER SEQUENCE ${seqName} RESTART WITH 1`);
    await client.query(
      `INSERT INTO system_settings (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [yearKey, String(year)]
    );
  }

  const seq = await client.query(`SELECT nextval('${seqName}') AS n`);
  const n = String(seq.rows[0].n).padStart(4, '0');
  return `${prefix}-${year}-${n}`;
}

module.exports = { nextRef };
