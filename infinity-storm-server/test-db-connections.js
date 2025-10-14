const { Pool } = require('pg');

async function testDatabases() {
  const configs = [
    {
      name: 'Supabase Local (54322)',
      host: '127.0.0.1',
      port: 54322,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres'
    },
    {
      name: 'Local PostgreSQL (5432)',
      host: '127.0.0.1',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres'
    },
    {
      name: '.env Config (5439)',
      host: '127.0.0.1',
      port: 5439,
      database: 'infinity_storm_test',
      user: 'postgres',
      password: 'test_password_123'
    }
  ];

  console.log('Testing database connections...\n');

  for (const cfg of configs) {
    try {
      const pool = new Pool(cfg);
      const sessionResult = await pool.query('SELECT COUNT(*) FROM sessions WHERE is_active = true');
      const playerResult = await pool.query('SELECT COUNT(*) FROM players WHERE username = \'testplayer\'');
      
      console.log(`✅ ${cfg.name}`);
      console.log(`   Host: ${cfg.host}:${cfg.port}`);
      console.log(`   Active sessions: ${sessionResult.rows[0].count}`);
      console.log(`   Testplayer exists: ${playerResult.rows[0].count > 0 ? 'Yes' : 'No'}`);
      console.log('');
      
      await pool.end();
    } catch (e) {
      console.log(`❌ ${cfg.name}`);
      console.log(`   Error: ${e.message}`);
      console.log('');
    }
  }
}

testDatabases();

