require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTableStructure() {
  try {
    console.log('📊 Checking players table structure...\n');
    
    // Get all columns of players table
    const { data, error } = await supabase.rpc('get_table_columns', {
      schema_name: 'public',
      table_name: 'players'
    });
    
    if (error) {
      // Try alternative method
      const { data: sampleData, error: sampleError } = await supabase
        .from('players')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.log('Error:', sampleError);
      } else {
        console.log('Sample row structure:', sampleData);
        if (sampleData.length === 0) {
          console.log('No existing players. Table is empty.');
        }
      }
    } else {
      console.log('Table columns:', data);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

checkTableStructure();