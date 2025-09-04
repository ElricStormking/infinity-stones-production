#!/usr/bin/env node

/**
 * Database Migration Script for Infinity Storm Casino
 *
 * This script applies database migrations and validates the schema
 * Supports both PostgreSQL and Supabase local instances
 */

const fs = require('fs').promises;
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL ||
    'postgresql://postgres:postgres@localhost:5432/postgres';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'db', 'migrations');

class DatabaseMigrator {
  constructor() {
    this.client = new Client(DATABASE_URL);
    this.migrations = [];
  }

  async connect() {
    console.log('🔗 Connecting to database...');
    await this.client.connect();
    console.log('✅ Connected to database');
  }

  async disconnect() {
    await this.client.end();
    console.log('🔌 Disconnected from database');
  }

  async loadMigrations() {
    console.log('\n📂 Loading migration files...');

    try {
      const files = await fs.readdir(MIGRATIONS_DIR);
      const sqlFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure proper order

      for (const file of sqlFiles) {
        const filePath = path.join(MIGRATIONS_DIR, file);
        const content = await fs.readFile(filePath, 'utf8');

        this.migrations.push({
          filename: file,
          path: filePath,
          content: content
        });

        console.log(`   📄 Loaded: ${file}`);
      }

      console.log(`\n✅ Loaded ${this.migrations.length} migration files`);
    } catch (error) {
      console.error('❌ Error loading migrations:', error.message);
      throw error;
    }
  }

  async ensureMigrationsTable() {
    console.log('\n🛠️  Ensuring schema_migrations table exists...');

    const createTableSQL = `
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(50) PRIMARY KEY,
                description TEXT,
                installed_at TIMESTAMP DEFAULT NOW()
            );
        `;

    await this.client.query(createTableSQL);
    console.log('✅ Schema migrations table ready');
  }

  async getAppliedMigrations() {
    const result = await this.client.query(
      'SELECT version FROM schema_migrations ORDER BY installed_at'
    );
    return result.rows.map(row => row.version);
  }

  async applyMigration(migration) {
    const migrationName = migration.filename.replace('.sql', '');

    console.log(`\n🚀 Applying migration: ${migrationName}`);

    try {
      // Begin transaction for migration
      await this.client.query('BEGIN');

      // Execute migration content
      await this.client.query(migration.content);

      // Record migration as applied (if not already recorded by migration itself)
      await this.client.query(`
                INSERT INTO schema_migrations (version, description) 
                VALUES ($1, $2)
                ON CONFLICT (version) DO UPDATE SET
                    description = EXCLUDED.description,
                    installed_at = NOW()
            `, [migrationName, `Migration from ${migration.filename}`]);

      // Commit transaction
      await this.client.query('COMMIT');

      console.log(`✅ Successfully applied: ${migrationName}`);
      return true;

    } catch (error) {
      // Rollback on error
      await this.client.query('ROLLBACK');
      console.error(`❌ Failed to apply migration ${migrationName}:`, error.message);
      throw error;
    }
  }

  async runMigrations() {
    console.log('\n🎯 Running database migrations...');

    const appliedMigrations = await this.getAppliedMigrations();
    console.log(`📊 Applied migrations: ${appliedMigrations.length}`);

    let appliedCount = 0;

    for (const migration of this.migrations) {
      const migrationName = migration.filename.replace('.sql', '');

      if (appliedMigrations.includes(migrationName)) {
        console.log(`⏭️  Skipping already applied: ${migrationName}`);
        continue;
      }

      await this.applyMigration(migration);
      appliedCount++;
    }

    if (appliedCount === 0) {
      console.log('\n🎉 Database is already up to date!');
    } else {
      console.log(`\n🎉 Successfully applied ${appliedCount} new migrations!`);
    }
  }

  async validateSchema() {
    console.log('\n🔍 Validating database schema...');

    // List of expected tables from the complete casino schema
    const expectedTables = [
      'players',
      'sessions',
      'game_states',
      'spin_results',
      'transactions',
      'jackpots',
      'jackpot_contributions',
      'admin_logs',
      'rtp_metrics',
      'schema_migrations'
    ];

    // Check if tables exist
    for (const table of expectedTables) {
      const result = await this.client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = $1
                )
            `, [table]);

      if (result.rows[0].exists) {
        console.log(`   ✅ Table '${table}' exists`);
      } else {
        console.log(`   ❌ Table '${table}' missing`);
      }
    }

    // Check critical indexes
    const criticalIndexes = [
      'idx_players_email',
      'idx_sessions_player_active',
      'idx_spin_results_player_time',
      'idx_transactions_player_time',
      'idx_one_active_session_per_player'
    ];

    console.log('\n🔍 Checking critical indexes...');
    for (const indexName of criticalIndexes) {
      const result = await this.client.query(`
                SELECT EXISTS (
                    SELECT FROM pg_class c 
                    JOIN pg_namespace n ON n.oid = c.relnamespace 
                    WHERE c.relname = $1 AND n.nspname = 'public'
                )
            `, [indexName]);

      if (result.rows[0].exists) {
        console.log(`   ✅ Index '${indexName}' exists`);
      } else {
        console.log(`   ⚠️  Index '${indexName}' missing`);
      }
    }

    // Test stored procedures
    console.log('\n🔍 Checking stored procedures...');
    const procedures = ['health_check', 'process_bet_transaction', 'process_win_transaction'];

    for (const proc of procedures) {
      const result = await this.client.query(`
                SELECT EXISTS (
                    SELECT FROM pg_proc 
                    WHERE proname = $1
                )
            `, [proc]);

      if (result.rows[0].exists) {
        console.log(`   ✅ Function '${proc}' exists`);
      } else {
        console.log(`   ⚠️  Function '${proc}' missing`);
      }
    }
  }

  async testBasicOperations() {
    console.log('\n🧪 Testing basic database operations...');

    try {
      // Test health check function
      const healthResult = await this.client.query('SELECT health_check() as health');
      console.log('   ✅ Health check function working');
      console.log('   📊 Health data:', JSON.stringify(healthResult.rows[0].health, null, 2));

      // Test player balance function (should fail with non-existent player)
      try {
        await this.client.query('SELECT get_player_balance($1)', ['00000000-0000-0000-0000-000000000000']);
        console.log('   ⚠️  Expected error for non-existent player not thrown');
      } catch (error) {
        if (error.message.includes('Active player not found')) {
          console.log('   ✅ Player balance function correctly handles missing player');
        } else {
          console.log('   ⚠️  Unexpected error in player balance function:', error.message);
        }
      }

      // Test basic queries
      const tableCountsResult = await this.client.query(`
                SELECT 
                    (SELECT COUNT(*) FROM players) as players_count,
                    (SELECT COUNT(*) FROM sessions) as sessions_count,
                    (SELECT COUNT(*) FROM transactions) as transactions_count
            `);

      const counts = tableCountsResult.rows[0];
      console.log('   📊 Table counts:', counts);

    } catch (error) {
      console.error('   ❌ Basic operations test failed:', error.message);
    }
  }

  async run() {
    try {
      await this.connect();
      await this.ensureMigrationsTable();
      await this.loadMigrations();
      await this.runMigrations();
      await this.validateSchema();
      await this.testBasicOperations();

      console.log('\n🎉 Database migration completed successfully!');

    } catch (error) {
      console.error('\n💥 Migration failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Command line interface
async function main() {
  console.log('🎰 Infinity Storm Casino - Database Migration');
  console.log('===============================================\n');

  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node migrate-database.js [options]');
    console.log('\nOptions:');
    console.log('  --help, -h     Show this help message');
    console.log('  --validate     Only validate schema (no migrations)');
    console.log('\nEnvironment Variables:');
    console.log('  DATABASE_URL   PostgreSQL connection string');
    console.log('  SUPABASE_DB_URL  Supabase database connection string');
    console.log('\nExample:');
    console.log('  DATABASE_URL="postgresql://user:pass@localhost:5432/db" node migrate-database.js');
    return;
  }

  const migrator = new DatabaseMigrator();

  if (args.includes('--validate')) {
    console.log('🔍 Validation-only mode\n');
    try {
      await migrator.connect();
      await migrator.validateSchema();
      await migrator.testBasicOperations();
    } catch (error) {
      console.error('Validation failed:', error.message);
      process.exit(1);
    } finally {
      await migrator.disconnect();
    }
  } else {
    await migrator.run();
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { DatabaseMigrator };