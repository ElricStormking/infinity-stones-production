/**
 * Create Test Player Account
 * Creates a real (non-demo) player account for testing server balance sync
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Database connection (using same config as server)
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 54322,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: false
});

async function createTestPlayer() {
  const client = await pool.connect();

  try {
    const testUsername = 'testplayer';
    const testEmail = 'test@player.com';
    const testPassword = 'test123';
    const startingCredits = 10000.00;

    console.log('🎮 Creating test player account...');
    console.log(`   Username: ${testUsername}`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   Starting Credits: $${startingCredits}`);

    // Check if player already exists
    const checkQuery = `
      SELECT id, username, email, credits, is_demo 
      FROM players 
      WHERE username = $1 OR email = $2
    `;
    const checkResult = await client.query(checkQuery, [testUsername, testEmail]);

    if (checkResult.rows.length > 0) {
      const existing = checkResult.rows[0];
      console.log('\n✅ Test player already exists:');
      console.log(`   ID: ${existing.id}`);
      console.log(`   Username: ${existing.username}`);
      console.log(`   Email: ${existing.email}`);
      console.log(`   Credits: $${existing.credits}`);
      console.log(`   Is Demo: ${existing.is_demo}`);

      // Update to ensure it's not a demo player and reset credits
      await client.query(
        'UPDATE players SET is_demo = false, credits = $1 WHERE id = $2',
        [startingCredits, existing.id]
      );
      console.log(`\n✅ Updated player to be a REAL (non-demo) player with $${startingCredits} credits`);

      return existing;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Create new player (is_demo = false for real player)
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
      false, // is_demo = FALSE (real player)
      false, // is_admin
      'active'
    ]);

    const player = insertResult.rows[0];

    console.log('\n✅ Test player created successfully!');
    console.log(`   ID: ${player.id}`);
    console.log(`   Username: ${player.username}`);
    console.log(`   Email: ${player.email}`);
    console.log(`   Credits: $${player.credits}`);
    console.log(`   Is Demo: ${player.is_demo}`);

    console.log('\n📝 Login Credentials:');
    console.log(`   Username: ${testUsername}`);
    console.log(`   Password: ${testPassword}`);

    return player;

  } catch (error) {
    console.error('❌ Error creating test player:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
createTestPlayer()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Failed:', err);
    process.exit(1);
  });
