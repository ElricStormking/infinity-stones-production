const { pool } = require('../../src/db/pool');

describe('Smoke: DB insert conditionally', () => {
  it('inserts and selects a row in spins when DATABASE_URL is set', async () => {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set; skipping DB insert smoke');
      return;
    }
    await pool.query('create table if not exists spins_test (id serial primary key, note text)');
    await pool.query('insert into spins_test (note) values ($1)', ['smoke']);
    const { rows } = await pool.query('select count(*)::int as c from spins_test');
    expect(rows[0].c).toBeGreaterThan(0);
  });
});


