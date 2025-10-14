/**
 * Verify Authentication Fix
 * Tests that token hashing is working correctly
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function verifyAuthFix() {
  console.log('🔍 Verifying authentication fix...\n');
  
  try {
    // Step 1: Register/Login
    console.log('1️⃣ Testing login...');
    let loginResponse;
    try {
      loginResponse = await axios.post(`${API_BASE}/auth/login`, {
        username: 'testplayer',
        password: 'test123'
      });
      console.log('✅ Login successful!');
      console.log('   Token:', loginResponse.data.token.substring(0, 30) + '...');
      console.log('   Player:', loginResponse.data.player.username);
      console.log('   Is Demo:', loginResponse.data.player.is_demo);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('❌ Login failed with 401');
        console.log('   This might be expected if password changed');
      } else {
        throw error;
      }
      return;
    }
    
    const token = loginResponse.data.token;
    
    // Step 2: Test authenticated request
    console.log('\n2️⃣ Testing authenticated API request...');
    try {
      const stateResponse = await axios.get(`${API_BASE}/game-state`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Game state request successful!');
      console.log('   Balance:', stateResponse.data.gameState?.balance || 'N/A');
      console.log('   Game Mode:', stateResponse.data.gameMode);
      
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('❌ STILL GETTING 401 ERROR!');
        console.log('   Token hash might still be mismatched');
        console.log('   Error:', error.response.data);
        return false;
      }
      throw error;
    }
    
    // Step 3: Test spin request
    console.log('\n3️⃣ Testing spin request...');
    try {
      const spinResponse = await axios.post(`${API_BASE}/spin`, {
        betAmount: 1.00
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Spin request successful!');
      console.log('   Total Win:', spinResponse.data.data?.totalWin || 0);
      console.log('   Balance:', spinResponse.data.data?.balance || 'N/A');
      
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('❌ Spin request returned 401');
        return false;
      }
      // Other errors are okay (might be game state issues)
      console.log('⚠️  Spin request failed (might be normal):', error.response?.data?.error || error.message);
    }
    
    console.log('\n✅ ✅ ✅ AUTHENTICATION FIX VERIFIED! ✅ ✅ ✅');
    console.log('\nThe token hashing is now working correctly.');
    console.log('You can proceed with testing in the browser.');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Server is not running!');
      console.error('   Please start the server: cd infinity-storm-server && npm run dev');
    }
    return false;
  }
}

// Run verification
console.log('═══════════════════════════════════════════════════════');
console.log('    Authentication Fix Verification');
console.log('═══════════════════════════════════════════════════════\n');

verifyAuthFix()
  .then(success => {
    if (success) {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('✅ ALL TESTS PASSED!');
      console.log('═══════════════════════════════════════════════════════');
      console.log('\n📋 Next Steps:');
      console.log('1. Clear browser localStorage');
      console.log('2. Login at: http://localhost:3000/test-player-login.html');
      console.log('3. Play game at: http://localhost:3000?debug=true');
      process.exit(0);
    } else {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('❌ TESTS FAILED - Authentication still broken');
      console.log('═══════════════════════════════════════════════════════');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('\n💥 Unexpected error:', err);
    process.exit(1);
  });

