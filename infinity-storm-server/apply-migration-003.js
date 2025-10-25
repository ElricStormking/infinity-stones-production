/**
 * Apply migration 003: Add UNIQUE constraint to game_states.player_id
 *
 * Run this with: node apply-migration-003.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function applyMigration() {
  console.log('🔧 Applying migration 003: Add UNIQUE constraint to game_states.player_id');

  // Create PostgreSQL connection
  const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 54322,
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  });

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'src', 'db', 'migrations', '003_add_game_states_unique_player.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');

    // Execute migration
    await pool.query(migrationSQL);

    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log('Verifying constraint...');

    // Verify constraint was added
    const result = await pool.query(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'game_states' AND constraint_type = 'UNIQUE'
    `);

    if (result.rows.length > 0) {
      console.log('✅ UNIQUE constraint verified:', result.rows[0].constraint_name);
    } else {
      console.warn('⚠️ Could not verify UNIQUE constraint');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();

