/**
 * Reset Test Player Password
 * Deletes and recreates the test player with correct credentials
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 54322,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: false
});

async function resetTestPlayer() {
  const client = await pool.connect();
  
  try {
    const testUsername = 'testplayer';
    const testEmail = 'test@player.com';
    const testPassword = 'test123';
    const startingCredits = 10000.00;
    
    console.log('🔄 Resetting test player...');
    console.log(`   Username: ${testUsername}`);
    console.log(`   Password: ${testPassword}`);
    
    // Delete existing test player
    const deleteQuery = 'DELETE FROM players WHERE username = $1 OR email = $2';
    const deleteResult = await client.query(deleteQuery, [testUsername, testEmail]);
    
    if (deleteResult.rowCount > 0) {
      console.log(`✅ Deleted existing test player`);
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(testPassword, 10);
    
    // Create new player with correct password
    const insertQuery = `
      INSERT INTO players (
        username, email, password_hash, credits, 
        is_demo, is_admin, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, username, email, credits, is_demo
    `;
    
    const insertResult = await client.query(insertQuery, [
      testUsername,
      testEmail,
      passwordHash,
      startingCredits,
      false, // is_demo = FALSE (real player for testing)
      false, // is_admin
      'active'
    ]);
    
    const player = insertResult.rows[0];
    
    console.log('\n✅ Test player reset successfully!');
    console.log(`   ID: ${player.id}`);
    console.log(`   Username: ${player.username}`);
    console.log(`   Email: ${player.email}`);
    console.log(`   Credits: $${player.credits}`);
    console.log(`   Is Demo: ${player.is_demo}`);
    
    console.log('\n📝 Login Credentials:');
    console.log(`   Username: ${testUsername}`);
    console.log(`   Password: ${testPassword}`);
    console.log('\n🌐 Open: http://localhost:3000/test-player-login.html');
    
  } catch (error) {
    console.error('❌ Error resetting test player:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

resetTestPlayer()
  .then(() => {
    console.log('\n✅ Done! You can now login.');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  });

