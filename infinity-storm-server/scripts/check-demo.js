require('dotenv').config({ path: __dirname + '/../.env' });
const { getDemoPlayer, supabaseAdmin } = require('../src/db/supabaseClient');

(async () => {
  try {
    const demo = await getDemoPlayer();
    console.log('Demo player:', demo);
    if (!demo || !demo.id) process.exit(2);

    const { data, error } = await supabaseAdmin
      .from('spin_results')
      .select('*')
      .eq('player_id', demo.id)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    console.log('Recent spin_results rows for demo:', data);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();

