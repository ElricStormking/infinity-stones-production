const { Pool } = require('pg');

function resolveConnectionString() {
  const raw = process.env.DATABASE_URL;
  if (raw && typeof raw === 'string') {
    const trimmed = raw.trim().replace(/^"|"$/g, '');
    if (trimmed && trimmed.toLowerCase() !== 'base') {
      return trimmed;
    }
  }
  return 'postgresql://postgres:postgres@localhost:54321/postgres';
}

const connectionString = resolveConnectionString();

const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30000 });

async function health() {
  try {
    const res = await pool.query('select 1 as ok');
    return { ok: true, result: res.rows[0] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { pool, health };



