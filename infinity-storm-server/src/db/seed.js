#!/usr/bin/env node
/**
 * Seed minimal demo data
 */
require('dotenv').config();
const { Client } = require('pg');

function dsn() {
  const raw = process.env.DATABASE_URL || '';
  const trimmed = raw.trim().replace(/^"|"$/g, '');
  return trimmed || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
}

async function main() {
  const client = new Client({ connectionString: dsn() });
  await client.connect();
  try {
    await client.query('BEGIN');
    const demo = await client.query("select id from players where username='demo_player'");
    if (demo.rowCount === 0) {
      await client.query("insert into players (username,email,password_hash,credits,is_demo) values ('demo_player','demo@example.com','$2b$10$demo',10000,true)");
    }
    await client.query('COMMIT');
    console.log('[seed] ok');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[seed] failed:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();







