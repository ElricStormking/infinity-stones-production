const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { pool } = require('./pool');

async function ensureCryptoExt() {
  try {
    await pool.query('create extension if not exists pgcrypto');
    console.log('pgcrypto extension ensured');
  } catch (err) {
    console.warn('Could not create pgcrypto extension:', err.message);
    console.warn('Continuing without pgcrypto - some features may be limited');
  }
}

async function run() {
  // Sanity: ensure we actually have a DB to talk to
  if (!process.env.DATABASE_URL) {
    console.warn('[migrate] WARNING: DATABASE_URL is not set. Using pool default (likely localhost:54321).');
  }
  await ensureCryptoExt();
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.match(/^\d+_.*\.sql$/)).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    console.log('Applying migration', f);
    await pool.query(sql);
  }
  console.log('Migrations complete');
  await pool.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});



