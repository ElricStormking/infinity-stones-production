#!/usr/bin/env node
/* Simple local DB CLI using pg. Usage:
 *   node src/db/cli.js                       # list tables in non-system schemas
 *   node src/db/cli.js "select now()"       # run custom SQL
 */
require('dotenv').config();
const { Client } = require('pg');

function resolveDsn() {
  const raw = process.env.DATABASE_URL || '';
  const trimmed = raw.trim().replace(/^"|"$/g, '');
  if (trimmed && trimmed.toLowerCase() !== 'base') return trimmed;
  return 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
}

async function main() {
  const sql = process.argv[2] ||
    "select table_schema, table_name from information_schema.tables where table_schema not in ('pg_catalog','information_schema') order by 1,2";

  const client = new Client({ connectionString: resolveDsn() });
  await client.connect();
  const res = await client.query(sql);
  if (Array.isArray(res.rows)) {
    // Pretty print rows
    const columns = Object.keys(res.rows[0] || {});
    console.log(JSON.stringify({ columns, rows: res.rows }, null, 2));
  } else {
    console.log(JSON.stringify(res, null, 2));
  }
  await client.end();
}

main().catch((err) => {
  console.error('[db:cli] Error:', err.message);
  process.exit(1);
});


