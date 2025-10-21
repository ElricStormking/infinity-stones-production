#!/usr/bin/env node
/**
 * Export selected tables to JSON
 * Usage: node src/db/export.js players sessions spin_results > dump.json
 */
require('dotenv').config({ quiet: true });
const { Client } = require('pg');

function dsn() {
  const raw = process.env.DATABASE_URL || '';
  const trimmed = raw.trim().replace(/^"|"$/g, '');
  return trimmed || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
}

async function main() {
  const tables = process.argv.slice(2);
  if (tables.length === 0) {
    console.error('Usage: export.js <table> [table2 ...]');
    process.exit(1);
  }
  const client = new Client({ connectionString: dsn() });
  await client.connect();
  const out = {};
  for (const t of tables) {
    const { rows } = await client.query(`select * from ${t}`);
    out[t] = rows;
  }
  await client.end();
  process.stdout.write(JSON.stringify(out, null, 2));
}

main();


