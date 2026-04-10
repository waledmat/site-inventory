const XLSX = require('xlsx');
const bcrypt = require('bcrypt');
const db = require('../config/db');

const VALID_ROLES = ['admin', 'storekeeper', 'requester', 'superuser', 'coordinator'];

function generatePassword() {
  // Satisfies: min 8 chars, 1 uppercase, 1 number
  const letters = Array.from({ length: 5 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26))
  ).join('');
  const digits = String(Math.floor(10 + Math.random() * 90));
  return `P${letters}${digits}`;
}

function nextAvailableId(taken) {
  const nums = [...taken].map(id => parseInt(id, 10)).filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 1000;
  let candidate = max + 1;
  while (taken.has(String(candidate))) candidate++;
  return String(candidate);
}

exports.parseUserImport = async (buffer) => {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });

  const { rows: existing } = await db.query('SELECT employee_id FROM users WHERE employee_id IS NOT NULL');
  const takenIds = new Set(existing.map(u => String(u.employee_id).trim()));
  const batchIds = new Set();

  const valid = [], errors = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const errs = [];

    const name     = String(row['NAME'] || row['Name'] || '').trim();
    let empId      = String(row['EMPLOYEE ID'] || row['Employee ID'] || row['employee_id'] || '').trim();
    const roleRaw  = String(row['ROLE'] || row['Role'] || '').trim().toLowerCase();
    const position = String(row['POSITION'] || row['Position'] || '').trim() || null;
    let password   = String(row['PASSWORD'] || row['Password'] || '').trim();

    if (!name) errs.push('NAME is required');

    if (!roleRaw) {
      errs.push('ROLE is required');
    } else if (!VALID_ROLES.includes(roleRaw)) {
      errs.push(`ROLE must be one of: ${VALID_ROLES.join(', ')}`);
    }

    // Employee ID: auto-generate if blank, reject if duplicate
    let generatedId = false;
    if (!empId) {
      empId = nextAvailableId(new Set([...takenIds, ...batchIds]));
      generatedId = true;
    } else if (takenIds.has(empId) || batchIds.has(empId)) {
      errs.push(`Employee ID "${empId}" is already taken`);
    }

    // Password: auto-generate if blank, validate if provided
    let generatedPassword = null;
    if (!password) {
      generatedPassword = generatePassword();
      password = generatedPassword;
    } else if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      errs.push('Password must be at least 8 chars with 1 uppercase letter and 1 number');
    }

    const entry = {
      name,
      employee_id: empId,
      role: roleRaw,
      position,
      password,
      generated_id: generatedId,
      generated_password: generatedPassword !== null,
    };

    if (errs.length) {
      errors.push({ row: rowNum, errors: errs, data: { name, employee_id: empId, role: roleRaw } });
    } else {
      batchIds.add(empId);
      if (generatedId) takenIds.add(empId);
      valid.push(entry);
    }
  });

  return { valid, errors };
};

exports.confirmUserImport = async (validRows) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const created = [];
    for (const row of validRows) {
      const hash = await bcrypt.hash(row.password, 10);
      const { rows } = await client.query(
        `INSERT INTO users (name, employee_id, role, position, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (employee_id) DO NOTHING
         RETURNING id, employee_id, name, role, position`,
        [row.name, row.employee_id, row.role, row.position, hash]
      );
      if (rows[0]) created.push(rows[0]);
    }
    await client.query('COMMIT');
    return created;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
