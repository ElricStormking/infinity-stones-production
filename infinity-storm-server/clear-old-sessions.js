/**
 * Clear Old Sessions - Fix Token Hash Mismatch
 *
 * This script clears all sessions from the database to fix the
 * bcrypt -> SHA256 hash mismatch issue.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 54322,
  database: process.env.DB_NAME || 'infinity_storm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function clearSessions() {
  console.log('🗑️  Clearing all sessions from database...\n');

  try {
    // First, check how many sessions exist
    const countResult = await pool.query('SELECT COUNT(*) FROM sessions');
    const sessionCount = parseInt(countResult.rows[0].count);

    console.log(`Found ${sessionCount} sessions in database`);

    if (sessionCount === 0) {
      console.log('✅ No sessions to clear!');
      return;
    }

    // Delete all sessions
    const deleteResult = await pool.query('DELETE FROM sessions');
    console.log(`✅ Deleted ${deleteResult.rowCount} sessions`);

    // Verify they're gone
    const verifyResult = await pool.query('SELECT COUNT(*) FROM sessions');
    const remaining = parseInt(verifyResult.rows[0].count);

    if (remaining === 0) {
      console.log('\n✅ ✅ ✅ ALL SESSIONS CLEARED! ✅ ✅ ✅');
      console.log('\n📋 Next Steps:');
      console.log('1. Server is already running with fixed code');
      console.log('2. Go to: http://localhost:3000/test-player-login.html');
      console.log('3. Login again (will create new session with SHA256 hash)');
      console.log('4. Test the game!');
    } else {
      console.log(`⚠️  Warning: ${remaining} sessions remain`);
    }

  } catch (error) {
    console.error('❌ Error clearing sessions:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

clearSessions();

