#!/usr/bin/env node

/**
 * Supabase Local Connection Test Script
 * 
 * This script tests the connection to the local Supabase instance
 * and validates the database setup for the casino game.
 */

const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

async function testSupabaseConnection() {
    console.log('🧪 Testing Supabase Local Connection...\n');
    
    try {
        // Test 1: Direct PostgreSQL Connection
        console.log('1. Testing direct PostgreSQL connection...');
        const pgClient = new Client(DATABASE_URL);
        await pgClient.connect();
        
        const result = await pgClient.query('SELECT version()');
        console.log(`   ✅ PostgreSQL connected: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
        
        // Test health check function
        try {
            const healthResult = await pgClient.query('SELECT health_check()');
            console.log(`   ✅ Health check: ${JSON.stringify(healthResult.rows[0].health_check)}`);
        } catch (err) {
            console.log(`   ⚠️  Health check function not available: ${err.message}`);
        }
        
        await pgClient.end();
        
        // Test 2: Supabase Client Connection (Anonymous)
        console.log('\n2. Testing Supabase client connection (anonymous)...');
        const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        const { data: authData, error: authError } = await supabaseAnon.auth.getSession();
        if (authError) {
            console.log(`   ⚠️  Auth check: ${authError.message}`);
        } else {
            console.log(`   ✅ Supabase auth system connected`);
        }
        
        // Test 3: Supabase Service Role Connection
        console.log('\n3. Testing Supabase service role connection...');
        const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        // Test table access
        const { count: spinsCount, error: tableError } = await supabaseService
            .from('spins')
            .select('*', { count: 'exact', head: true });
        
        if (tableError) {
            console.log(`   ⚠️  Table access error: ${tableError.message}`);
        } else {
            console.log(`   ✅ Service role can access tables (spins count: ${spinsCount ?? 0})`);
        }
        
        // Test 4: Database Schema Validation
        console.log('\n4. Validating database schema...');
        const pgTestClient = new Client(DATABASE_URL);
        await pgTestClient.connect();
        
        const tables = ['players', 'spins', 'sessions', 'game_states', 'spin_results', 'transactions'];
        const tableChecks = await Promise.all(tables.map(async (table) => {
            try {
                const result = await pgTestClient.query(`SELECT COUNT(*) FROM information_schema.tables WHERE table_name = $1`, [table]);
                return { table, exists: result.rows[0].count > 0 };
            } catch (error) {
                return { table, exists: false, error: error.message };
            }
        }));
        
        tableChecks.forEach(({ table, exists, error }) => {
            if (exists) {
                console.log(`   ✅ Table '${table}' exists`);
            } else {
                console.log(`   ❌ Table '${table}' missing${error ? `: ${error}` : ''}`);
            }
        });
        
        await pgTestClient.end();
        
        // Test 5: Demo User Access
        console.log('\n5. Testing demo user access...');
        try {
            const demoClient = new Client(DATABASE_URL);
            await demoClient.connect();
            
            const userResult = await demoClient.query(`
                SELECT id, email, username, credits, is_demo, status 
                FROM players 
                WHERE email = 'demo@infinitystorm.dev'
            `);
            
            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                console.log(`   ✅ Demo user found: ${user.username} (Credits: $${user.credits})`);
            } else {
                console.log(`   ⚠️  Demo user not found in database`);
            }
            
            await demoClient.end();
        } catch (error) {
            console.log(`   ❌ Demo user test failed: ${error.message}`);
        }
        
        console.log('\n🎉 Supabase connection test completed!');
        console.log('\nNext steps:');
        console.log('1. Start Supabase local development: supabase start');
        console.log('2. Run database migrations: supabase db reset');
        console.log('3. Access Supabase Studio: http://127.0.0.1:54323');
        console.log('4. Test game server integration');
        
    } catch (error) {
        console.error('\n❌ Connection test failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Ensure Docker is running');
        console.log('2. Check if PostgreSQL is running on port 54321');
        console.log('3. Run: supabase start');
        console.log('4. Verify environment variables in .env file');
        process.exit(1);
    }
}

// Configuration Summary
function printConfiguration() {
    console.log('📋 Configuration Summary:');
    console.log(`   Supabase URL: ${SUPABASE_URL}`);
    console.log(`   Database URL: ${DATABASE_URL}`);
    console.log(`   Node Environment: ${process.env.NODE_ENV}`);
    console.log(`   Game Server Port: ${process.env.GAME_SERVER_PORT || 3000}`);
    console.log(`   Web Portal Port: ${process.env.WEB_PORTAL_PORT || 3001}`);
    console.log('');
}

if (require.main === module) {
    printConfiguration();
    testSupabaseConnection().catch(console.error);
}

module.exports = { testSupabaseConnection };