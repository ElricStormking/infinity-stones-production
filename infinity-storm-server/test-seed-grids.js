const axios = require('axios');

const seed = '5e2c374303286be25468207e77d5798a7cb67df345eb4e7a3a017ef27645623802';

axios.post('http://localhost:3000/api/demo-spin', {
  betAmount: 1.0,
  rngSeed: seed
}).then(r => {
  const d = r.data.data;
  console.log('=== TESTING SEED ===');
  console.log('Seed:', seed.substring(0, 16) + '...');
  console.log('Cascade Steps:', d.cascadeSteps.length);
  console.log('');

  d.cascadeSteps.forEach((step, i) => {
    console.log(`Step ${i + 1}:`);
    console.log('  gridStateBefore:', step.gridStateBefore ? 'EXISTS' : 'MISSING');
    console.log('  gridBefore:', step.gridBefore ? 'EXISTS' : 'MISSING');
    console.log('  gridAfterRemoval:', step.gridAfterRemoval ? 'EXISTS' : 'MISSING');
    console.log('  gridStateAfter:', step.gridStateAfter ? 'EXISTS' : 'MISSING');
    console.log('  gridAfter:', step.gridAfter ? 'EXISTS' : 'MISSING');
    console.log('  newGrid:', step.newGrid ? 'EXISTS' : 'MISSING');

    // Check if ANY grid field exists
    const hasAnyGrid = step.gridStateBefore || step.gridBefore || step.grid ||
                          step.gridStateAfter || step.gridAfter || step.newGrid ||
                          step.gridAfterRemoval || step.gridMid;

    if (!hasAnyGrid) {
      console.log('  ⚠️ WARNING: NO GRID FIELDS FOUND');
    }
    console.log('');
  });
}).catch(e => {
  console.error('Error:', e.message);
  if (e.response) {
    console.error('Status:', e.response.status);
    console.error('Data:', e.response.data);
  }
});

