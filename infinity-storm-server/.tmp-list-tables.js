const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query('select table_schema, table_name from information_schema.tables where table_schema not in (\'pg_catalog\',\'information_schema\') order by 1,2');
  console.log(r.rows);
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });

