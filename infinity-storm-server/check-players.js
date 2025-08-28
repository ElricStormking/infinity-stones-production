const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 54322,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres', 
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: false
});

async function checkPlayersTable() {
  try {
    const client = await pool.connect();
    
    const query = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'players' ORDER BY ordinal_position`;
    const result = await client.query(query);
    
    console.log('Players table structure:');
    console.table(result.rows);
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkPlayersTable();