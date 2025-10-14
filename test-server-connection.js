/**
 * Test Server Connection and Create Test Player
 * Verifies the server is running and creates/logs in test player
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testServerConnection() {
  console.log('🔍 Testing server connection...\n');
  
  // 1. Check if server is running
  try {
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Server is running');
    console.log('   Health:', healthResponse.data);
  } catch (error) {
    console.error('❌ Server is not responding!');
    console.error('   Please start the server first:');
    console.error('   cd infinity-storm-server');
    console.error('   npm run dev\n');
    process.exit(1);
  }
  
  // 2. Try to register test player
  const credentials = {
    username: 'testplayer',
    email: 'test@player.com',
    password: 'test123',
    confirmPassword: 'test123'
  };
  
  console.log('\n📝 Registering test player...');
  console.log(`   Username: ${credentials.username}`);
  console.log(`   Password: ${credentials.password}`);
  
  try {
    const registerResponse = await axios.post(`${API_BASE}/auth/register`, credentials);
    console.log('✅ Test player registered successfully!');
    console.log('   Response:', registerResponse.data);
  } catch (registerError) {
    if (registerError.response && registerError.response.status === 409) {
      console.log('ℹ️  Test player already exists (this is fine)');
    } else if (registerError.response) {
      console.log('⚠️  Registration error:', registerError.response.status, registerError.response.data);
    } else {
      console.error('❌ Registration failed:', registerError.message);
    }
  }
  
  // 3. Login to get token
  console.log('\n🔐 Logging in as test player...');
  
  try {
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      username: credentials.username,
      password: credentials.password
    });
    
    console.log('✅ Login successful!');
    console.log('   Player ID:', loginResponse.data.player.id);
    console.log('   Username:', loginResponse.data.player.username);
    console.log('   Credits: $' + loginResponse.data.player.credits);
    console.log('   Is Demo:', loginResponse.data.player.is_demo);
    console.log('   Token:', loginResponse.data.token.substring(0, 20) + '...');
    
    // Save to file for easy access
    const fs = require('fs');
    const credentials_file = {
      username: credentials.username,
      password: credentials.password,
      token: loginResponse.data.token,
      playerId: loginResponse.data.player.id,
      credits: loginResponse.data.player.credits,
      isDemo: loginResponse.data.player.is_demo,
      loginCommand: `localStorage.setItem('authToken', '${loginResponse.data.token}');`
    };
    
    fs.writeFileSync('test-player-credentials.json', JSON.stringify(credentials_file, null, 2));
    console.log('\n💾 Credentials saved to: test-player-credentials.json');
    
    console.log('\n📋 To use this account:');
    console.log('   1. Open: http://localhost:3000?debug=true');
    console.log('   2. Open browser console (F12)');
    console.log('   3. Run: ' + credentials_file.loginCommand);
    console.log('   4. Refresh the page');
    console.log('\n   OR');
    console.log('   1. Open: test-player-login.html in your browser');
    console.log('   2. Click "Login as Test Player"');
    
  } catch (loginError) {
    if (loginError.response) {
      console.error('❌ Login failed:', loginError.response.status, loginError.response.data);
    } else {
      console.error('❌ Login error:', loginError.message);
    }
    process.exit(1);
  }
}

testServerConnection()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  });

