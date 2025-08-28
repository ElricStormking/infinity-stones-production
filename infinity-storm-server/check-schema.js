const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 54322,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres', 
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: false
});

async function checkTables() {
  try {
    const client = await pool.connect();
    
    // Check sessions table structure
    const query = `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'sessions' ORDER BY ordinal_position`;
    const sessionsResult = await client.query(query);
    
    console.log('Sessions table structure:');
    console.table(sessionsResult.rows);
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTables();