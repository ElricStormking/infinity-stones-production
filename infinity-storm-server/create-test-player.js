require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestPlayer() {
  try {
    console.log('🎮 Creating test player account...');
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    // Create test player
    const testPlayer = {
      username: 'test_player',
      email: 'test@infinitystorm.com',
      password_hash: hashedPassword,
      credits: 5000.00,
      status: 'active',
      is_demo: false,  // This is NOT a demo player
      is_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Insert player into database
    const { data, error } = await supabase
      .from('players')
      .insert([testPlayer])
      .select();
    
    if (error) {
      console.error('❌ Error creating test player:', error);
      return;
    }
    
    console.log('✅ Test player created successfully!');
    console.log('📧 Email: test@infinitystorm.com');
    console.log('🔑 Password: test123');
    console.log('💰 Credits: $5000.00');
    console.log('🆔 Player ID:', data[0].id);
    
    // Create initial session for the player
    const sessionData = {
      id: 'test-session-' + Date.now(),
      player_id: data[0].id,
      token: 'test-token-' + Math.random().toString(36).substring(2),
      ip_address: '127.0.0.1',
      user_agent: 'Test Client',
      is_active: true,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };
    
    const { data: sessionResult, error: sessionError } = await supabase
      .from('sessions')
      .insert([sessionData])
      .select();
    
    if (sessionError) {
      console.error('❌ Error creating session:', sessionError);
    } else {
      console.log('✅ Session created for test player');
      console.log('🎫 Session Token:', sessionData.token);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create test player:', error);
    process.exit(1);
  }
}

createTestPlayer();