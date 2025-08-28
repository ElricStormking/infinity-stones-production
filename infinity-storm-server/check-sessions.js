const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 54322,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres', 
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: false
});

async function checkSessions() {
  try {
    const client = await pool.connect();
    
    // Check what columns actually exist
    const columnsQuery = `
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      ORDER BY ordinal_position
    `;
    const result = await client.query(columnsQuery);
    
    console.log('Sessions table columns:');
    console.table(result.rows);
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSessions();