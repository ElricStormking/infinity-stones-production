const fetch = require('node-fetch');

async function testLogin() {
  try {
    console.log('Testing login with qaplayer23...');
    
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'qaplayer23',
        password: 'test123'
      })
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Login successful!');
      console.log('Player ID:', data.player?.id);
      console.log('Username:', data.player?.username);
      console.log('Token received:', data.token ? 'Yes' : 'No');
    } else {
      console.log('❌ Login failed');
      console.log('Error:', data.error);
      console.log('Message:', data.message);
    }
    
    return data;
  } catch (error) {
    console.error('❌ Login test failed with exception:', error.message);
    console.error('Stack:', error.stack);
  }
}

testLogin();

