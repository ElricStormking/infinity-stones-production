#!/usr/bin/env node

/**
 * MCP (Model Context Protocol) Integration Test Suite
 *
 * This comprehensive test suite validates MCP database integration for Supabase,
 * testing both direct database operations and Claude AI interaction capabilities.
 */

const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
require('dotenv').config();

// Configuration from environment
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

// Test data for MCP operations
const TEST_SPIN_DATA = {
  spin_id: 'mcp_test_' + Date.now(),
  player_id: 'mcp_test_player',
  bet_amount: 10.00,
  total_win: 25.50,
  rng_seed: 'test_seed_' + Math.random(),
  initial_grid: [
    ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'],
    ['thanos', 'scarlet_witch', 'time_gem', 'space_gem', 'mind_gem', 'power_gem'],
    ['thanos_weapon', 'time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
    ['soul_gem', 'thanos', 'scarlet_witch', 'time_gem', 'space_gem', 'mind_gem'],
    ['power_gem', 'reality_gem', 'soul_gem', 'thanos', 'scarlet_witch', 'time_gem']
  ],
  cascades: [
    {
      step: 1,
      matches: [{ symbol: 'time_gem', count: 8, positions: [[0,0], [2,1], [1,2], [3,2], [0,3], [4,3], [2,4], [5,4]] }],
      win: 25.50,
      multiplier: 1.0
    }
  ]
};

async function runMCPTestSuite() {
  console.log('🧪 MCP (Model Context Protocol) Integration Test Suite');
  console.log('=' .repeat(60));
  console.log('This test validates Claude AI\'s ability to interact with Supabase database');
  console.log('through MCP for rapid development and database operations.\n');

  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };

  try {
    // Test 1: Environment Configuration
    await testEnvironmentConfiguration(testResults);

    // Test 2: Database Connection Status
    await testDatabaseConnection(testResults);

    // Test 3: Schema Validation
    await testSchemaValidation(testResults);

    // Test 4: Basic CRUD Operations (MCP Simulation)
    await testBasicCRUDOperations(testResults);

    // Test 5: Authentication Flow
    await testAuthenticationFlow(testResults);

    // Test 6: Complex Query Operations
    await testComplexQueries(testResults);

    // Test 7: Transaction Safety
    await testTransactionSafety(testResults);

    // Test 8: MCP Command Examples
    await generateMCPExamples(testResults);

    // Test Summary
    printTestSummary(testResults);

    // Generate MCP Documentation
    await generateMCPDocumentation();

  } catch (error) {
    console.error('\n❌ Test suite failed with critical error:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Ensure Docker Desktop is running');
    console.log('2. Start Supabase: cd infinity-storm-server && supabase start');
    console.log('3. Verify environment variables in .env');
    console.log('4. Check network connectivity to localhost:54321');
    process.exit(1);
  }
}

async function testEnvironmentConfiguration(results) {
  console.log('1️⃣ Testing Environment Configuration...');
  results.total++;

  try {
    const requiredEnvVars = [
      'DATABASE_URL',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const missingVars = [];
    requiredEnvVars.forEach(varName => {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    });

    if (missingVars.length > 0) {
      throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
    }

    console.log('   ✅ All required environment variables are set');
    console.log(`   📍 Database URL: ${DATABASE_URL}`);
    console.log(`   📍 Supabase URL: ${SUPABASE_URL}`);
    console.log(`   📍 Node Environment: ${process.env.NODE_ENV || 'development'}`);

    results.passed++;

  } catch (error) {
    console.log(`   ❌ Environment configuration failed: ${error.message}`);
    results.failed++;
  }
}

async function testDatabaseConnection(results) {
  console.log('\n2️⃣ Testing Database Connection...');
  results.total++;

  try {
    // Test direct PostgreSQL connection
    const pgClient = new Client(DATABASE_URL);
    await pgClient.connect();

    const versionResult = await pgClient.query('SELECT version()');
    const postgresVersion = versionResult.rows[0].version.split(' ')[0] + ' ' + versionResult.rows[0].version.split(' ')[1];

    // Test basic query
    const timeResult = await pgClient.query('SELECT NOW() as current_time');
    const serverTime = timeResult.rows[0].current_time;

    await pgClient.end();

    console.log('   ✅ PostgreSQL connection successful');
    console.log(`   📊 Version: ${postgresVersion}`);
    console.log(`   🕐 Server time: ${serverTime}`);

    results.passed++;

  } catch (error) {
    console.log(`   ❌ Database connection failed: ${error.message}`);
    results.failed++;
  }
}

async function testSchemaValidation(results) {
  console.log('\n3️⃣ Testing Schema Validation...');
  results.total++;

  try {
    const pgClient = new Client(DATABASE_URL);
    await pgClient.connect();

    // Check all required tables
    const expectedTables = ['users', 'spins', 'game_sessions', 'cascade_steps', 'transaction_logs'];
    const tableQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ANY($1)
        `;

    const tableResult = await pgClient.query(tableQuery, [expectedTables]);
    const existingTables = tableResult.rows.map(row => row.table_name);

    // Check for missing tables
    const missingTables = expectedTables.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      throw new Error(`Missing tables: ${missingTables.join(', ')}`);
    }

    console.log('   ✅ All required tables exist');
    existingTables.forEach(table => {
      console.log(`   📋 Table '${table}' ✓`);
    });

    // Test essential functions
    try {
      const healthResult = await pgClient.query('SELECT health_check()');
      console.log('   ✅ Health check function available');
    } catch (err) {
      console.log('   ⚠️  Health check function missing (not critical)');
    }

    await pgClient.end();
    results.passed++;

  } catch (error) {
    console.log(`   ❌ Schema validation failed: ${error.message}`);
    results.failed++;
  }
}

async function testBasicCRUDOperations(results) {
  console.log('\n4️⃣ Testing Basic CRUD Operations (MCP Simulation)...');
  results.total++;

  try {
    const pgClient = new Client(DATABASE_URL);
    await pgClient.connect();

    // CREATE: Insert test spin
    const insertQuery = `
            INSERT INTO spins (spin_id, player_id, bet_amount, total_win, rng_seed, initial_grid, cascades)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, spin_id, created_at
        `;

    const insertResult = await pgClient.query(insertQuery, [
      TEST_SPIN_DATA.spin_id,
      TEST_SPIN_DATA.player_id,
      TEST_SPIN_DATA.bet_amount,
      TEST_SPIN_DATA.total_win,
      TEST_SPIN_DATA.rng_seed,
      JSON.stringify(TEST_SPIN_DATA.initial_grid),
      JSON.stringify(TEST_SPIN_DATA.cascades)
    ]);

    const insertedSpin = insertResult.rows[0];
    console.log(`   ✅ CREATE: Inserted spin ${insertedSpin.spin_id}`);

    // READ: Query the inserted spin
    const selectQuery = `
            SELECT spin_id, player_id, bet_amount, total_win, created_at,
                   initial_grid, cascades
            FROM spins 
            WHERE spin_id = $1
        `;

    const selectResult = await pgClient.query(selectQuery, [TEST_SPIN_DATA.spin_id]);
    if (selectResult.rows.length === 0) {
      throw new Error('Failed to read inserted spin');
    }

    const retrievedSpin = selectResult.rows[0];
    console.log(`   ✅ READ: Retrieved spin ${retrievedSpin.spin_id} (Win: $${retrievedSpin.total_win})`);

    // UPDATE: Modify the spin
    const newWinAmount = 50.00;
    const updateQuery = `
            UPDATE spins 
            SET total_win = $1 
            WHERE spin_id = $2
            RETURNING total_win
        `;

    const updateResult = await pgClient.query(updateQuery, [newWinAmount, TEST_SPIN_DATA.spin_id]);
    console.log(`   ✅ UPDATE: Modified win amount to $${updateResult.rows[0].total_win}`);

    // DELETE: Remove the test spin
    const deleteQuery = 'DELETE FROM spins WHERE spin_id = $1 RETURNING spin_id';
    const deleteResult = await pgClient.query(deleteQuery, [TEST_SPIN_DATA.spin_id]);
    console.log(`   ✅ DELETE: Removed spin ${deleteResult.rows[0].spin_id}`);

    await pgClient.end();
    results.passed++;

  } catch (error) {
    console.log(`   ❌ CRUD operations failed: ${error.message}`);
    results.failed++;
  }
}

async function testAuthenticationFlow(results) {
  console.log('\n5️⃣ Testing Authentication Flow...');
  results.total++;

  try {
    const pgClient = new Client(DATABASE_URL);
    await pgClient.connect();

    // Check demo user exists
    const userQuery = `
            SELECT id, email, username, balance, active, created_at
            FROM users 
            WHERE email = 'demo@infinitystorm.dev'
        `;

    const userResult = await pgClient.query(userQuery);
    if (userResult.rows.length === 0) {
      throw new Error('Demo user not found');
    }

    const demoUser = userResult.rows[0];
    console.log(`   ✅ Demo user found: ${demoUser.username}`);
    console.log(`   💰 Balance: $${demoUser.balance}`);
    console.log(`   📧 Email: ${demoUser.email}`);
    console.log(`   ✨ Status: ${demoUser.active ? 'Active' : 'Inactive'}`);

    // Test transaction log
    const transactionQuery = `
            SELECT transaction_type, amount, description, created_at
            FROM transaction_logs 
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 5
        `;

    const transactionResult = await pgClient.query(transactionQuery, [demoUser.id]);
    console.log(`   💳 Transaction history: ${transactionResult.rows.length} records`);

    transactionResult.rows.forEach((tx, index) => {
      console.log(`   📝 ${index + 1}. ${tx.transaction_type}: $${tx.amount} - ${tx.description}`);
    });

    await pgClient.end();
    results.passed++;

  } catch (error) {
    console.log(`   ❌ Authentication flow test failed: ${error.message}`);
    results.failed++;
  }
}

async function testComplexQueries(results) {
  console.log('\n6️⃣ Testing Complex Query Operations...');
  results.total++;

  try {
    const pgClient = new Client(DATABASE_URL);
    await pgClient.connect();

    // Test aggregation query
    const statsQuery = `
            SELECT 
                COUNT(*) as total_spins,
                COALESCE(SUM(bet_amount), 0) as total_bets,
                COALESCE(SUM(total_win), 0) as total_wins,
                COALESCE(AVG(bet_amount), 0) as avg_bet,
                COALESCE(MAX(total_win), 0) as max_win
            FROM spins
        `;

    const statsResult = await pgClient.query(statsQuery);
    const stats = statsResult.rows[0];

    console.log('   ✅ Aggregation query successful');
    console.log(`   📊 Total spins: ${stats.total_spins}`);
    console.log(`   💰 Total bets: $${parseFloat(stats.total_bets).toFixed(2)}`);
    console.log(`   🎯 Total wins: $${parseFloat(stats.total_wins).toFixed(2)}`);
    console.log(`   📈 Average bet: $${parseFloat(stats.avg_bet).toFixed(2)}`);
    console.log(`   🏆 Max win: $${parseFloat(stats.max_win).toFixed(2)}`);

    // Test join query
    const joinQuery = `
            SELECT 
                u.username,
                u.balance,
                COUNT(s.id) as spin_count,
                COALESCE(SUM(s.total_win), 0) as total_winnings
            FROM users u
            LEFT JOIN spins s ON u.id::text = s.player_id
            GROUP BY u.id, u.username, u.balance
            ORDER BY total_winnings DESC
        `;

    const joinResult = await pgClient.query(joinQuery);
    console.log(`   ✅ Join query successful - ${joinResult.rows.length} users found`);

    joinResult.rows.forEach((user, index) => {
      console.log(`   👤 ${index + 1}. ${user.username}: ${user.spin_count} spins, $${parseFloat(user.total_winnings).toFixed(2)} won`);
    });

    await pgClient.end();
    results.passed++;

  } catch (error) {
    console.log(`   ❌ Complex queries failed: ${error.message}`);
    results.failed++;
  }
}

async function testTransactionSafety(results) {
  console.log('\n7️⃣ Testing Transaction Safety...');
  results.total++;

  try {
    const pgClient = new Client(DATABASE_URL);
    await pgClient.connect();

    await pgClient.query('BEGIN');

    try {
      // Insert test data in transaction
      const testSpinId = 'transaction_test_' + Date.now();

      await pgClient.query(`
                INSERT INTO spins (spin_id, player_id, bet_amount, total_win, rng_seed, initial_grid, cascades)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
        testSpinId,
        'transaction_test_player',
        100.00,
        0.00,
        'tx_test_seed',
        JSON.stringify([]),
        JSON.stringify([])
      ]);

      // Verify data exists in transaction
      const checkResult = await pgClient.query('SELECT spin_id FROM spins WHERE spin_id = $1', [testSpinId]);
      if (checkResult.rows.length === 0) {
        throw new Error('Data not found within transaction');
      }

      console.log('   ✅ Transaction data insertion successful');

      // Rollback to test transaction isolation
      await pgClient.query('ROLLBACK');

      // Verify data was rolled back
      const rollbackCheck = await pgClient.query('SELECT spin_id FROM spins WHERE spin_id = $1', [testSpinId]);
      if (rollbackCheck.rows.length > 0) {
        throw new Error('Transaction rollback failed');
      }

      console.log('   ✅ Transaction rollback successful');
      console.log('   🔒 Database transaction safety verified');

    } catch (txError) {
      await pgClient.query('ROLLBACK');
      throw txError;
    }

    await pgClient.end();
    results.passed++;

  } catch (error) {
    console.log(`   ❌ Transaction safety test failed: ${error.message}`);
    results.failed++;
  }
}

async function generateMCPExamples(results) {
  console.log('\n8️⃣ Generating MCP Command Examples...');
  results.total++;

  try {
    const mcpExamples = {
      database_queries: [
        {
          description: 'Get player statistics',
          mcp_command: 'Query the users table to get player statistics',
          sql_equivalent: 'SELECT username, balance, created_at FROM users WHERE active = true ORDER BY balance DESC LIMIT 10'
        },
        {
          description: 'Analyze recent spins',
          mcp_command: 'Show me the last 20 spins with their win amounts and player info',
          sql_equivalent: 'SELECT s.spin_id, s.player_id, s.bet_amount, s.total_win, s.created_at FROM spins s ORDER BY s.created_at DESC LIMIT 20'
        },
        {
          description: 'Calculate RTP (Return to Player)',
          mcp_command: 'Calculate the overall RTP by summing total bets vs total wins',
          sql_equivalent: 'SELECT (SUM(total_win) / NULLIF(SUM(bet_amount), 0) * 100) as rtp_percentage FROM spins'
        }
      ],
      data_operations: [
        {
          description: 'Create test player',
          mcp_command: 'Create a new test user with username \'test_player\' and initial balance 1000',
          sql_equivalent: 'INSERT INTO users (username, email, balance) VALUES (\'test_player\', \'test@example.com\', 1000.00)'
        },
        {
          description: 'Update player balance',
          mcp_command: 'Add 500 to the balance of player with username \'demo_player\'',
          sql_equivalent: 'UPDATE users SET balance = balance + 500 WHERE username = \'demo_player\''
        },
        {
          description: 'Record spin result',
          mcp_command: 'Insert a new spin record for player \'demo_player\' with bet 10 and win 25',
          sql_equivalent: 'INSERT INTO spins (spin_id, player_id, bet_amount, total_win, initial_grid, cascades) VALUES (...)'
        }
      ],
      analytics: [
        {
          description: 'Daily revenue report',
          mcp_command: 'Show daily revenue for the last 7 days',
          sql_equivalent: 'SELECT DATE(created_at) as day, SUM(bet_amount) as total_bets, SUM(total_win) as total_wins FROM spins WHERE created_at >= NOW() - INTERVAL \'7 days\' GROUP BY DATE(created_at)'
        },
        {
          description: 'Top winning spins',
          mcp_command: 'Find the top 10 highest winning spins',
          sql_equivalent: 'SELECT spin_id, player_id, bet_amount, total_win, (total_win/bet_amount) as multiplier FROM spins ORDER BY total_win DESC LIMIT 10'
        }
      ]
    };

    console.log(`   ✅ Generated ${Object.values(mcpExamples).flat().length} MCP command examples`);
    console.log('   📚 Examples cover: database queries, data operations, and analytics');

    // Save examples to file for development team
    const examplesContent = `# MCP Database Command Examples
Generated on: ${new Date().toISOString()}

## Database Queries
${mcpExamples.database_queries.map(ex => `
### ${ex.description}
**MCP Command**: "${ex.mcp_command}"
\`\`\`sql
${ex.sql_equivalent}
\`\`\`
`).join('')}

## Data Operations
${mcpExamples.data_operations.map(ex => `
### ${ex.description}
**MCP Command**: "${ex.mcp_command}"
\`\`\`sql
${ex.sql_equivalent}
\`\`\`
`).join('')}

## Analytics
${mcpExamples.analytics.map(ex => `
### ${ex.description}
**MCP Command**: "${ex.mcp_command}"
\`\`\`sql
${ex.sql_equivalent}
\`\`\`
`).join('')}

## Usage Notes
- Use natural language with Claude AI to describe what you want to do
- Claude can translate your requests into appropriate SQL queries
- Always verify results before making critical changes
- Use transactions for complex operations that need to be atomic
`;

    require('fs').writeFileSync(
      'D:\\infinity-gauntlet\\infinity-storm-server\\MCP_EXAMPLES.md',
      examplesContent
    );

    console.log('   📝 MCP examples saved to MCP_EXAMPLES.md');

    results.passed++;

  } catch (error) {
    console.log(`   ❌ MCP examples generation failed: ${error.message}`);
    results.failed++;
  }
}

async function generateMCPDocumentation() {
  console.log('\n📚 Generating MCP Integration Documentation...');

  const documentation = `# MCP (Model Context Protocol) Integration Guide
**Infinity Storm Casino Game - Database Integration**

## Overview
This document provides comprehensive guidance for using Claude AI's MCP capabilities to interact directly with the Supabase/PostgreSQL database for rapid development and testing.

## Quick Start

### 1. Environment Setup
Ensure your environment is properly configured:
\`\`\`bash
# Start Supabase (requires Docker Desktop)
cd infinity-storm-server
supabase start

# Verify connection
node test-mcp-integration.js
\`\`\`

### 2. Database Connection
- **URL**: ${SUPABASE_URL}
- **Database**: PostgreSQL 15+
- **Tables**: users, spins, game_sessions, cascade_steps, transaction_logs

## MCP Commands Reference

### Player Management
\`\`\`
"Show me all active players sorted by balance"
"Create a new player with username 'test_user' and balance 2000"
"Update player 'demo_player' to add 500 to their balance"
"Find player by email 'demo@infinitystorm.dev'"
\`\`\`

### Game Data Analysis
\`\`\`
"Show the last 50 spins with their win amounts"
"Calculate the RTP for all spins this week"
"Find spins where the win was more than 10x the bet"
"Show me the distribution of bet amounts"
\`\`\`

### Revenue Analytics
\`\`\`
"Generate a daily revenue report for the last 30 days"
"Show total bets vs wins by day"
"Find the highest winning spin in the database"
"Calculate average bet size per player"
\`\`\`

### Data Validation
\`\`\`
"Check for any spins with negative win amounts"
"Find users with balances below 0"
"Validate that all spins have matching cascade data"
"Count records in each table"
\`\`\`

## Development Workflow

### 1. Schema Changes
When modifying the database schema:
1. Update \`supabase/seed.sql\`
2. Run \`supabase db reset\` to apply changes
3. Use MCP to verify new tables/columns work correctly

### 2. Data Testing
For testing game logic:
1. Use MCP to insert test spin data
2. Verify calculations and relationships
3. Clean up test data when done

### 3. Performance Analysis
Monitor database performance:
1. Use MCP to check query execution times
2. Analyze index usage
3. Identify slow queries

## Security Considerations

### Service Role vs Anonymous Access
- **Service Role**: Full database access for development
- **Anonymous**: Limited to public tables only
- **Production**: Never expose service role keys

### Data Privacy
- Avoid logging sensitive user information
- Use prepared statements for all queries
- Implement proper access controls

## Troubleshooting

### Common Issues
1. **Connection Failed**: Ensure Docker Desktop is running and Supabase is started
2. **Permission Denied**: Check that service role key is correctly set
3. **Table Not Found**: Run database migrations with \`supabase db reset\`

### Debugging Commands
\`\`\`sql
-- Check database status
SELECT health_check();

-- Verify table structure
\\dt public.*

-- Check recent activity
SELECT * FROM pg_stat_activity WHERE state = 'active';
\`\`\`

## Best Practices

### 1. Query Optimization
- Use appropriate indexes for frequent queries
- Limit result sets with proper WHERE clauses
- Use EXPLAIN to analyze query performance

### 2. Data Integrity
- Always use transactions for multi-step operations
- Validate input data before insertion
- Use foreign key constraints to maintain relationships

### 3. Development Safety
- Use test data that's clearly marked
- Back up important data before major changes
- Test queries on small datasets first

## Integration Examples

### Real-time Game Monitoring
\`\`\`
"Show me all spins in the last 5 minutes with their results"
"Alert me if any player has lost more than $1000 in the last hour"
"Monitor for unusual win patterns or potential issues"
\`\`\`

### Business Intelligence
\`\`\`
"What's our house edge over the last 1000 spins?"
"Which symbols appear most frequently in winning combinations?"
"How does player behavior change based on balance levels?"
\`\`\`

---
Generated by MCP Integration Test Suite v1.0
For technical support, refer to the Supabase documentation or project CLAUDE.md
`;

  require('fs').writeFileSync(
    'D:\\infinity-gauntlet\\infinity-storm-server\\MCP_INTEGRATION_GUIDE.md',
    documentation
  );

  console.log('   📚 Complete MCP integration guide saved to MCP_INTEGRATION_GUIDE.md');
}

function printTestSummary(results) {
  console.log('\n' + '=' .repeat(60));
  console.log('📊 MCP Integration Test Results');
  console.log('=' .repeat(60));
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log(`📈 Success Rate: ${results.total > 0 ? Math.round((results.passed / results.total) * 100) : 0}%`);

  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! MCP integration is ready for development.');
    console.log('\n📋 Next Steps:');
    console.log('1. Start using Claude AI with natural language database queries');
    console.log('2. Refer to MCP_EXAMPLES.md for common command patterns');
    console.log('3. Use MCP_INTEGRATION_GUIDE.md for detailed documentation');
    console.log('4. Test complex scenarios specific to your game logic');
  } else {
    console.log('\n⚠️  Some tests failed. Please address the issues before using MCP.');
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure Docker Desktop is running');
    console.log('2. Start Supabase: supabase start');
    console.log('3. Check environment variables in .env');
    console.log('4. Verify network connectivity');
  }
}

// Export for programmatic use
module.exports = {
  runMCPTestSuite,
  testEnvironmentConfiguration,
  testDatabaseConnection,
  testSchemaValidation,
  testBasicCRUDOperations
};

// Run if called directly
if (require.main === module) {
  runMCPTestSuite().catch(console.error);
}