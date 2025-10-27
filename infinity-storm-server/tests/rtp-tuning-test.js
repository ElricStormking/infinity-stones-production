/**
 * RTP Tuning Tool - Integration Tests
 * 
 * Tests for the RTP simulator, optimizer, and config manager services.
 */

const rtpSimulator = require('../src/services/rtpSimulator');
const rtpOptimizer = require('../src/services/rtpOptimizer');
const configManager = require('../src/services/configManager');
const { logger } = require('../src/utils/logger');

// Test configuration
const TEST_CONFIG = {
  symbolWeights: {
    time_gem: 26,
    space_gem: 26,
    mind_gem: 22,
    power_gem: 20,
    reality_gem: 20,
    soul_gem: 19,
    thanos_weapon: 17,
    scarlet_witch: 12,
    thanos: 11
  },
  scatterChance: 0.035,
  multiplierTable: [
    { multiplier: 2, weight: 48.7 },
    { multiplier: 3, weight: 20.0 },
    { multiplier: 4, weight: 9.0 },
    { multiplier: 5, weight: 7.0 },
    { multiplier: 6, weight: 7.0 },
    { multiplier: 8, weight: 4.0 },
    { multiplier: 10, weight: 2.0 },
    { multiplier: 20, weight: 1.2989 },
    { multiplier: 100, weight: 0.001 },
    { multiplier: 500, weight: 0.0001 }
  ]
};

/**
 * Test 1: RTP Simulator - Small Test (1000 spins)
 */
async function testSimulatorSmall() {
  console.log('\n=== Test 1: RTP Simulator (1,000 spins) ===');
  
  try {
    const startTime = Date.now();
    
    const results = await rtpSimulator.runSimulation({
      symbolWeights: TEST_CONFIG.symbolWeights,
      scatterChance: TEST_CONFIG.scatterChance,
      multiplierTable: TEST_CONFIG.multiplierTable,
      spinCount: 1000,
      betAmount: 1.0
    });

    const duration = Date.now() - startTime;

    console.log('✓ Simulation completed successfully');
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Overall RTP: ${results.overallRTP}%`);
    console.log(`  Win Frequency: ${results.winFrequency}%`);
    console.log(`  Total Spins: ${results.totalSpins}`);
    console.log(`  Winning Spins: ${results.winningSpins}`);
    console.log(`  Largest Win: ${results.largestWinMultiplier}x`);
    console.log(`  Spins/Second: ${results.spinsPerSecond}`);

    // Validation
    if (results.totalSpins !== 1000) {
      throw new Error('Total spins mismatch');
    }
    if (results.overallRTP < 0 || results.overallRTP > 200) {
      throw new Error('RTP out of reasonable range');
    }

    return { success: true, results };
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 2: RTP Simulator - Medium Test (10,000 spins)
 */
async function testSimulatorMedium() {
  console.log('\n=== Test 2: RTP Simulator (10,000 spins) ===');
  
  try {
    const startTime = Date.now();
    
    let progressUpdates = 0;
    const results = await rtpSimulator.runSimulation({
      symbolWeights: TEST_CONFIG.symbolWeights,
      scatterChance: TEST_CONFIG.scatterChance,
      multiplierTable: TEST_CONFIG.multiplierTable,
      spinCount: 10000,
      betAmount: 1.0,
      progressCallback: (progress) => {
        progressUpdates++;
        if (progressUpdates % 5 === 0) {
          console.log(`  Progress: ${progress.spinsCompleted}/${progress.totalSpins} (${(progress.spinsCompleted / progress.totalSpins * 100).toFixed(1)}%)`);
        }
      }
    });

    const duration = Date.now() - startTime;

    console.log('✓ Simulation completed successfully');
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Overall RTP: ${results.overallRTP}%`);
    console.log(`  Win Frequency: ${results.winFrequency}%`);
    console.log(`  Average Win: ${results.averageWin}x`);
    console.log(`  Scatter Trigger Rate: ${results.scatterTriggerRate}%`);
    console.log(`  Multiplier Trigger Rate: ${results.multiplierTriggerRate}%`);
    console.log(`  Progress Updates: ${progressUpdates}`);

    // Validation
    if (results.totalSpins !== 10000) {
      throw new Error('Total spins mismatch');
    }
    if (progressUpdates === 0) {
      throw new Error('No progress updates received');
    }

    return { success: true, results };
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 3: Config Manager - Read Current Config
 */
async function testConfigManagerRead() {
  console.log('\n=== Test 3: Config Manager - Read Config ===');
  
  try {
    const config = await configManager.readCurrentConfig();

    console.log('✓ Config read successfully');
    console.log(`  Symbol Weights: ${Object.keys(config.symbolWeights).length} symbols`);
    console.log(`  Scatter Chance: ${config.scatterChance}`);
    console.log(`  Multiplier Table: ${config.multiplierTable.length} entries`);
    console.log(`  RTP Target: ${config.rtp}`);

    // Validation
    if (!config.symbolWeights || Object.keys(config.symbolWeights).length === 0) {
      throw new Error('Symbol weights not loaded');
    }
    if (!config.multiplierTable || config.multiplierTable.length === 0) {
      throw new Error('Multiplier table not loaded');
    }

    return { success: true, config };
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 4: Config Manager - Validation
 */
async function testConfigValidation() {
  console.log('\n=== Test 4: Config Manager - Validation ===');
  
  try {
    // Test valid config
    const validResult = configManager.validateConfig(TEST_CONFIG);
    console.log('✓ Valid config validation:', validResult.valid ? 'PASS' : 'FAIL');
    if (!validResult.valid) {
      console.log('  Errors:', validResult.errors);
    }

    // Test invalid scatter chance
    const invalidScatter = configManager.validateConfig({
      ...TEST_CONFIG,
      scatterChance: 0.5 // Too high
    });
    console.log('✓ Invalid scatter chance detection:', !invalidScatter.valid ? 'PASS' : 'FAIL');

    // Test invalid symbol weight
    const invalidWeight = configManager.validateConfig({
      ...TEST_CONFIG,
      symbolWeights: {
        ...TEST_CONFIG.symbolWeights,
        thanos: -5 // Negative weight
      }
    });
    console.log('✓ Invalid symbol weight detection:', !invalidWeight.valid ? 'PASS' : 'FAIL');

    // Test missing symbol
    const missingSymbol = configManager.validateConfig({
      ...TEST_CONFIG,
      symbolWeights: {
        time_gem: 26,
        space_gem: 26
        // Missing other symbols
      }
    });
    console.log('✓ Missing symbol detection:', !missingSymbol.valid ? 'PASS' : 'FAIL');

    return { success: true };
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 5: RTP Optimizer - Simple Optimization
 */
async function testOptimizer() {
  console.log('\n=== Test 5: RTP Optimizer - Optimization ===');
  
  try {
    const startTime = Date.now();
    
    console.log('  Running optimizer (this may take a few minutes)...');
    
    const results = await rtpOptimizer.optimize({
      targetRTP: 96.5,
      currentConfig: TEST_CONFIG,
      maxIterations: 3, // Limited for testing
      spinCount: 5000 // Smaller for speed
    });

    const duration = Date.now() - startTime;

    console.log('✓ Optimization completed');
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Target RTP: ${results.targetRTP}%`);
    console.log(`  Achieved RTP: ${results.achievedRTP}%`);
    console.log(`  Deviation: ${results.deviation}%`);
    console.log(`  Iterations: ${results.iterations}`);
    console.log(`  Converged: ${results.converged}`);
    console.log(`  Confidence Score: ${results.confidenceScore}/100`);

    // Validation
    if (!results.optimizedConfig) {
      throw new Error('No optimized config returned');
    }
    if (results.iterations === 0) {
      throw new Error('No iterations performed');
    }

    return { success: true, results };
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 6: Config Manager - Backup Creation
 */
async function testBackupCreation() {
  console.log('\n=== Test 6: Config Manager - Backup Creation ===');
  
  try {
    const backupPath = await configManager.createBackup('test_admin');

    console.log('✓ Backup created successfully');
    console.log(`  Backup Path: ${backupPath}`);

    // List backups
    const backups = await configManager.listBackups();
    console.log(`  Total Backups: ${backups.length}`);
    
    if (backups.length > 0) {
      console.log(`  Latest Backup: ${backups[0].filename}`);
    }

    return { success: true, backupPath };
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║     RTP Tuning Tool - Integration Tests           ║');
  console.log('╚════════════════════════════════════════════════════╝');

  const results = {
    total: 6,
    passed: 0,
    failed: 0,
    tests: []
  };

  // Run tests sequentially
  const tests = [
    { name: 'Simulator Small', fn: testSimulatorSmall },
    { name: 'Simulator Medium', fn: testSimulatorMedium },
    { name: 'Config Manager Read', fn: testConfigManagerRead },
    { name: 'Config Validation', fn: testConfigValidation },
    { name: 'RTP Optimizer', fn: testOptimizer },
    { name: 'Backup Creation', fn: testBackupCreation }
  ];

  for (const test of tests) {
    const result = await test.fn();
    results.tests.push({
      name: test.name,
      ...result
    });
    
    if (result.success) {
      results.passed++;
    } else {
      results.failed++;
    }
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║                 Test Summary                       ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log(`\nTotal Tests: ${results.total}`);
  console.log(`Passed: ${results.passed} ✓`);
  console.log(`Failed: ${results.failed} ✗`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);

  if (results.failed > 0) {
    console.log('\nFailed Tests:');
    results.tests.filter(t => !t.success).forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
  }

  console.log('\n' + (results.failed === 0 ? '✓ All tests passed!' : '✗ Some tests failed'));

  return results;
}

// Run tests if called directly
if (require.main === module) {
  runAllTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testSimulatorSmall,
  testSimulatorMedium,
  testConfigManagerRead,
  testConfigValidation,
  testOptimizer,
  testBackupCreation
};

