#!/usr/bin/env node
/**
 * Simple migration runner
 * Usage:
 *   node src/db/migrate.js up   # apply latest schema
 *   node src/db/migrate.js down # drop public schema (dev only)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function resolveDsn() {
  const raw = process.env.DATABASE_URL || '';
  const trimmed = raw.trim().replace(/^"|"$/g, '');
  if (trimmed) {return trimmed;}
  return 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
}

async function runSql(sql) {
  const client = new Client({ connectionString: resolveDsn() });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
}

async function main() {
  const dir = path.join(__dirname, 'migrations');
  const mode = (process.argv[2] || 'up').toLowerCase();

  if (mode === 'down') {
    console.warn('[migrate] dropping public schema (DEV ONLY)');
    await runSql('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    console.log('[migrate] reset public schema');
    return;
  }

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  console.log('[migrate] applying', files.length, 'files');
  for (const f of files) {
    const p = path.join(dir, f);
    const sql = fs.readFileSync(p, 'utf8');
    console.log('[migrate] →', f);
    await runSql(sql);
  }
  console.log('[migrate] complete');
}

main().catch(err => {
  console.error('[migrate] failed:', err.message);
  process.exit(1);
});
