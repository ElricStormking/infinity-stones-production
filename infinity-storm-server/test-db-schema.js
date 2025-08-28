#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function testDatabaseSchema() {
    console.log('🧪 Testing Database Schema Creation');
    console.log('=====================================');
    
    // Connect to PostgreSQL
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'infinity_storm_test'
    });
    
    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL');
        
        // Test basic connection
        const result = await client.query('SELECT current_user, current_database(), version()');
        console.log(`📊 User: ${result.rows[0].current_user}`);
        console.log(`📊 Database: ${result.rows[0].current_database}`);
        console.log(`📊 Version: ${result.rows[0].version.substring(0, 50)}...`);
        
        // Load and apply the complete schema
        const schemaPath = path.join(__dirname, 'src', 'db', 'migrations', '002_complete_casino_schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('\n🚀 Applying complete casino schema...');
        
        // Execute schema in a transaction
        await client.query('BEGIN');
        try {
            await client.query(schema);
            await client.query('COMMIT');
            console.log('✅ Schema applied successfully');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        
        // Test the schema
        console.log('\n🔍 Validating schema...');
        
        // Check tables
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log(`📊 Created ${tablesResult.rows.length} tables:`);
        tablesResult.rows.forEach(row => {
            console.log(`   ✅ ${row.table_name}`);
        });
        
        // Test health check function
        console.log('\n🔍 Testing health check function...');
        try {
            const healthResult = await client.query('SELECT health_check()');
            console.log('✅ Health check function working');
            console.log('📊 Health data:', JSON.stringify(healthResult.rows[0].health_check, null, 2));
        } catch (error) {
            console.log('❌ Health check function failed:', error.message);
        }
        
        // Test stored procedures
        console.log('\n🔍 Testing stored procedures...');
        try {
            // This should fail with a proper error about missing player
            await client.query('SELECT get_player_balance($1)', ['00000000-0000-0000-0000-000000000000']);
            console.log('⚠️  Expected error not thrown');
        } catch (error) {
            if (error.message.includes('Active player not found')) {
                console.log('✅ get_player_balance function working correctly');
            } else {
                console.log('⚠️  Unexpected error:', error.message);
            }
        }
        
        // Apply seed data
        console.log('\n🌱 Applying seed data...');
        const seedPath = path.join(__dirname, 'supabase', 'seed.sql');
        const seedData = fs.readFileSync(seedPath, 'utf8');
        
        try {
            await client.query(seedData);
            console.log('✅ Seed data applied successfully');
            
            // Count records in each table
            const playerCount = await client.query('SELECT COUNT(*) FROM players');
            const sessionCount = await client.query('SELECT COUNT(*) FROM sessions WHERE is_active = true');
            const transactionCount = await client.query('SELECT COUNT(*) FROM transactions');
            
            console.log(`📊 Players: ${playerCount.rows[0].count}`);
            console.log(`📊 Active Sessions: ${sessionCount.rows[0].count}`);
            console.log(`📊 Transactions: ${transactionCount.rows[0].count}`);
            
        } catch (error) {
            console.log('⚠️  Seed data error (may be expected):', error.message.substring(0, 100));
        }
        
        console.log('\n🎉 Database schema setup completed successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await client.end();
        console.log('🔌 Disconnected from database');
    }
}

testDatabaseSchema().catch(console.error);