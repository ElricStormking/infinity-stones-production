/**
 * Debug Sessions - Check what's in the database
 */

require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  host: '127.0.0.1', // Force localhost for local Supabase
  port: parseInt(process.env.DB_PORT) || 54322,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'test_password_123'
});

async function debugSessions() {
  console.log('🔍 Debugging sessions in database...\n');
  
  try {
    // Get all sessions
    const sessionsResult = await pool.query(`
      SELECT 
        s.id,
        s.player_id,
        s.token_hash,
        s.is_active,
        s.expires_at,
        s.created_at,
        p.username
      FROM sessions s
      LEFT JOIN players p ON s.player_id = p.id
      ORDER BY s.created_at DESC
      LIMIT 5
    `);
    
    console.log(`Found ${sessionsResult.rows.length} session(s):\n`);
    
    for (const session of sessionsResult.rows) {
      console.log(`📝 Session ID: ${session.id}`);
      console.log(`   Player: ${session.username} (${session.player_id})`);
      console.log(`   Token Hash: ${session.token_hash.substring(0, 20)}...`);
      console.log(`   Hash Length: ${session.token_hash.length}`);
      console.log(`   Active: ${session.is_active}`);
      console.log(`   Expires: ${session.expires_at}`);
      console.log(`   Created: ${session.created_at}`);
      console.log('');
    }
    
    // Try to login and check the token hash
    const axios = require('axios');
    console.log('🔐 Testing login...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'testplayer',
      password: 'test123'
    });
    
    const token = loginResponse.data.token;
    console.log(`✅ Login successful, got token: ${token.substring(0, 30)}...\n`);
    
    // Calculate what the hash should be
    const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
    console.log(`🔐 Expected SHA256 hash: ${expectedHash.substring(0, 40)}...`);
    console.log(`   Full length: ${expectedHash.length}`);
    
    // Check if this hash exists in database
    const hashCheckResult = await pool.query(
      'SELECT * FROM sessions WHERE token_hash = $1',
      [expectedHash]
    );
    
    if (hashCheckResult.rows.length > 0) {
      console.log('\n✅ Token hash FOUND in database!');
      console.log('   Session ID:', hashCheckResult.rows[0].id);
      console.log('   Is Active:', hashCheckResult.rows[0].is_active);
      console.log('   Expires:', hashCheckResult.rows[0].expires_at);
    } else {
      console.log('\n❌ Token hash NOT FOUND in database!');
      console.log('   This is the problem!');
      
      // Show what hashes are actually in DB
      console.log('\n📋 Actual hashes in database:');
      for (const session of sessionsResult.rows) {
        const matches = session.token_hash === expectedHash;
        console.log(`   ${session.token_hash.substring(0, 40)}... ${matches ? '✅ MATCH' : '❌ no match'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  } finally {
    await pool.end();
  }
}

debugSessions();

