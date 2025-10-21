#!/usr/bin/env node
/**
 * Import JSON dump (produced by export.js)
 * Usage: node src/db/import.js dump.json
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const { Client } = require('pg');

function dsn() {
  const raw = process.env.DATABASE_URL || '';
  const trimmed = raw.trim().replace(/^"|"$/g, '');
  return trimmed || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
}

async function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: import.js <dump.json>');
    process.exit(1);
  }
  // Strip any leading non-JSON noise (e.g., dotenv logs accidentally captured)
  let raw = fs.readFileSync(file, 'utf8');
  // Remove any leading dotenv banner line if present
  raw = raw.replace(/^\[dotenv[^\n]*\n/, '');
  // Find the first JSON object/array that starts at a line-begin as fallback
  const match = raw.match(/^[\t ]*[\{\[]/m);
  if (match && typeof match.index === 'number') {
    raw = raw.slice(match.index);
  }
  const data = JSON.parse(raw);
  const client = new Client({ connectionString: dsn() });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const [table, rows] of Object.entries(data)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const cols = Object.keys(rows[0]);
      for (const r of rows) {
        const values = cols.map(c => r[c]);
        const placeholders = cols.map((_, i) => `$${i+1}`).join(',');
        const sql = `insert into ${table} (${cols.join(',')}) values (${placeholders}) on conflict do nothing`;
        await client.query(sql, values);
      }
    }
    await client.query('COMMIT');
    console.log('[import] ok');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[import] failed:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();


