require('dotenv').config({path: __dirname + '/../.env'});
const c = require('../src/db/supabaseClient');
(async()=>{
  const d = await c.getDemoPlayer();
  console.log('demo id', d && d.id);
  const r = await c.processBet(d.id, 1.23);
  console.log('bet', r);
  const w = await c.processWin(d.id, 0.5);
  console.log('win', w);
  const s = await c.saveSpinResult(d.id, {bet:1.23,initialGrid:{g:1},cascades:[],totalWin:0.5,multipliers:[],rngSeed:'test',freeSpinsActive:false});
  console.log('save', s);
})();
